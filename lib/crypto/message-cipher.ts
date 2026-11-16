/**
 * Mã hoá nội dung tin nhắn trước khi ghi DB (AES-256-GCM, Web Crypto). Chỉ dùng phía server.
 *
 * - Khoá: MESSAGE_ENCRYPTION_KEY = 32 byte ngẫu nhiên dạng base64url. Mỗi tin có IV 12 byte ngẫu nhiên riêng,
 *   GCM kèm tag xác thực nên dữ liệu bị sửa sẽ không giải mã được (không ra chữ rác).
 * - Định dạng lưu: "enc:v1:" + base64url(iv ‖ ciphertext ‖ tag). Chuỗi không có tiền tố = dữ liệu cũ chữ thường.
 * - Không có khoá (máy local chạy DB thử): ghi chữ thường. Production bắt buộc có khoá (requireKeyInProduction).
 * - Không giải mã được (thiếu/sai khoá) → trả chuỗi rỗng (tin bị ẩn, không hiện chữ báo lỗi cho người dùng) và log lỗi
 *   phía server (không log nội dung).
 * - Trang admin hiện ADMIN_HIDDEN thay cho nội dung, trừ khi chạy ở máy local (ngoài Vercel) và .env.local
 *   có ADMIN_SHOW_MESSAGES=1 (canRevealToAdmin). Trên Vercel bật biến đó cũng không có tác dụng.
 */

const PREFIX = 'enc:v1:';
const IV_BYTES = 12;
const KEY_BYTES = 32;

export const ADMIN_HIDDEN = '•••';

type Env = Record<string, string | undefined>;

export interface MessageCipher {
  /** true nếu seal thật sự mã hoá (có khoá). */
  readonly encrypting: boolean;
  seal(text: string): Promise<string>;
  /** Giải mã; chuỗi cũ chữ thường trả nguyên văn; lỗi trả '' (không bao giờ ném lỗi). */
  open(stored: string): Promise<string>;
}

export const isEncrypted = (s: string) => s.startsWith(PREFIX);

const toB64 = (b: Uint8Array) => Buffer.from(b).toString('base64url');
const fromB64 = (s: string) => new Uint8Array(Buffer.from(s, 'base64url'));

export function createMessageCipher(keyB64: string | undefined): MessageCipher {
  const raw = keyB64?.trim();
  if (!raw) {
    return {
      encrypting: false,
      async seal(text) { return text; },
      async open(stored) {
        if (!isEncrypted(stored)) return stored;
        console.error('message-cipher: có tin đã mã hoá nhưng thiếu MESSAGE_ENCRYPTION_KEY');
        return '';
      },
    };
  }
  const keyBytes = fromB64(raw);
  if (keyBytes.length !== KEY_BYTES) throw new Error(`MESSAGE_ENCRYPTION_KEY phải là ${KEY_BYTES} byte (base64url).`);
  const key = crypto.subtle.importKey('raw', keyBytes as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  return {
    encrypting: true,
    async seal(text) {
      const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
      const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key, enc.encode(text)));
      const out = new Uint8Array(IV_BYTES + ct.length);
      out.set(iv);
      out.set(ct, IV_BYTES);
      return PREFIX + toB64(out);
    },
    async open(stored) {
      if (!isEncrypted(stored)) return stored;
      try {
        const buf = fromB64(stored.slice(PREFIX.length));
        const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, IV_BYTES) }, await key, buf.slice(IV_BYTES));
        return dec.decode(pt);
      } catch {
        console.error('message-cipher: không giải mã được một tin (sai khoá hoặc dữ liệu hỏng)');
        return '';
      }
    },
  };
}

/** Production (Vercel) thiếu khoá → ném lỗi, để không bao giờ ghi chữ thường lên prod. */
export function requireKeyInProduction(env: Env = process.env): void {
  if (env.VERCEL_ENV === 'production' && !env.MESSAGE_ENCRYPTION_KEY?.trim()) {
    throw new Error('Thiếu MESSAGE_ENCRYPTION_KEY trên production: không lưu tin nhắn dạng chữ thường.');
  }
}

/** Admin chỉ xem được nội dung khi chạy ở máy local (không phải Vercel) và tự bật ADMIN_SHOW_MESSAGES=1. */
export function canRevealToAdmin(env: Env = process.env): boolean {
  return !env.VERCEL && env.ADMIN_SHOW_MESSAGES === '1';
}

let instance: MessageCipher | null = null;

export function getMessageCipher(): MessageCipher {
  if (!instance) {
    requireKeyInProduction();
    instance = createMessageCipher(process.env.MESSAGE_ENCRYPTION_KEY);
  }
  return instance;
}
