/**
 * Băm mật khẩu bằng PBKDF2-SHA256 (Web Crypto, không cần thư viện ngoài).
 * Định dạng lưu: `pbkdf2$<số vòng>$<salt base64url>$<hash base64url>`.
 */
const ITERATIONS = 120_000;
const KEY_BITS = 256;
const encoder = new TextEncoder();

function toB64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, KEY_BITS);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string, iterations = ITERATIONS): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${iterations}$${toB64(salt)}$${toB64(await derive(password, salt, iterations))}`;
}

/** Sai định dạng → false. So sánh không rò rỉ thời gian theo vị trí byte khác nhau. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, iterRaw, saltRaw, hashRaw] = stored.split('$');
  const iterations = Number(iterRaw);
  if (algo !== 'pbkdf2' || !Number.isInteger(iterations) || iterations < 1 || iterations > 10_000_000 || !saltRaw || !hashRaw) return false;
  let expected: Uint8Array;
  let actual: Uint8Array;
  try {
    expected = fromB64(hashRaw);
    actual = await derive(password, fromB64(saltRaw), iterations);
  } catch {
    return false;
  }
  let diff = expected.length ^ actual.length;
  for (let i = 0; i < Math.max(expected.length, actual.length); i++) diff |= (expected[i] ?? 0) ^ (actual[i] ?? 0);
  return diff === 0;
}

/** Hash giả để kiểm tra khi tên đăng nhập không tồn tại: thời gian phản hồi như khi có tài khoản. */
let dummy: Promise<string> | null = null;
export function dummyPasswordHash(): Promise<string> {
  dummy ??= hashPassword('không-có-tài-khoản-này');
  return dummy;
}

export const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

/** Chuẩn hóa tên đăng nhập (chữ thường, bỏ khoảng trắng hai đầu). */
export function normalizeUsername(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

/** Lỗi đầu vào khi đăng ký; null nếu hợp lệ. */
export function registrationError(username: string, password: unknown): string | null {
  if (!USERNAME_RE.test(username)) return 'Tên đăng nhập 3–32 ký tự, chỉ gồm chữ thường không dấu, số và . _ -';
  if (typeof password !== 'string' || password.length < PASSWORD_MIN) return `Mật khẩu tối thiểu ${PASSWORD_MIN} ký tự.`;
  if (password.length > PASSWORD_MAX) return `Mật khẩu tối đa ${PASSWORD_MAX} ký tự.`;
  return null;
}
