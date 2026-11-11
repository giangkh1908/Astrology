/**
 * Đăng nhập bằng tài khoản lấy từ biến môi trường. Có hai tài khoản tách biệt:
 *
 * AUTH_USERNAME / AUTH_PASSWORD: tài khoản dùng trang chính (scope 'user', cookie tv_session).
 * ADMIN_USERNAME / ADMIN_PASSWORD: tài khoản trang quản trị /admin (scope 'admin', cookie tv_admin).
 * Scope nằm trong phần được ký nên cookie của tài khoản này không dùng được cho tài khoản kia.
 * AUTH_SECRET: chuỗi ngẫu nhiên (>= 32 ký tự) để ký cookie phiên bằng HMAC-SHA256.
 * Thiếu biến nào thì từ chối mọi đăng nhập (fail closed).
 * Tài khoản tự đăng ký (bảng users) dùng chung cookie tv_session, chủ thể là `member:<id>`.
 * Chỉ dùng Web Crypto nên chạy được cả trong proxy lẫn route handler.
 */
export const SESSION_COOKIE = 'tv_session';
export const ADMIN_COOKIE = 'tv_admin';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 ngày

export type AuthScope = 'user' | 'admin';

export interface AuthConfig {
  scope: AuthScope;
  username: string;
  password: string;
  secret: string;
}

export function readAuthConfig(env: Record<string, string | undefined> = process.env): AuthConfig | null {
  const username = env.AUTH_USERNAME?.trim();
  const password = env.AUTH_PASSWORD;
  const secret = env.AUTH_SECRET;
  if (!username || !password || !secret || secret.length < 32) return null;
  return { scope: 'user', username, password, secret };
}

/** Tài khoản admin: ADMIN_USERNAME / ADMIN_PASSWORD, ký bằng cùng AUTH_SECRET. Thiếu → không ai vào được /admin. */
export function readAdminConfig(env: Record<string, string | undefined> = process.env): AuthConfig | null {
  const username = env.ADMIN_USERNAME?.trim();
  const password = env.ADMIN_PASSWORD;
  const secret = env.AUTH_SECRET;
  if (!username || !password || !secret || secret.length < 32) return null;
  return { scope: 'admin', username, password, secret };
}

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** So sánh không rò rỉ thời gian theo vị trí ký tự khác nhau. */
function constantTimeEqual(a: string, b: string): boolean {
  const ab = encoder.encode(a);
  const bb = encoder.encode(b);
  let diff = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

const encodeSubject = (subject: string) => toBase64Url(encoder.encode(subject));
const encodeUser = (config: AuthConfig) => encodeSubject(`${config.scope}:${config.username}`);

function fromBase64Url(s: string): string | null {
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
  } catch {
    return null;
  }
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return toBase64Url(new Uint8Array(mac));
}

export function checkCredentials(username: unknown, password: unknown, config: AuthConfig): boolean {
  if (typeof username !== 'string' || typeof password !== 'string') return false;
  // Kiểm cả hai rồi mới gộp kết quả, để thời gian không lộ là sai tên hay sai mật khẩu.
  const userOk = constantTimeEqual(username.trim(), config.username);
  const passOk = constantTimeEqual(password, config.password);
  return userOk && passOk;
}

/** Token dạng `<base64url(scope:username)>.<hạn unix giây>.<chữ ký>` (base64url không chứa dấu chấm). */
export async function createSessionToken(config: AuthConfig, nowMs = Date.now()): Promise<string> {
  const exp = Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS;
  const payload = `${encodeUser(config)}.${exp}`;
  return `${payload}.${await sign(payload, config.secret)}`;
}

export async function verifySessionToken(token: string | undefined, config: AuthConfig | null, nowMs = Date.now()): Promise<boolean> {
  if (!token || !config) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [user, expRaw, mac] = parts;
  const exp = Number(expRaw);
  if (!Number.isInteger(exp) || exp * 1000 <= nowMs) return false;
  // Đổi AUTH_USERNAME thì phiên cũ hết hiệu lực; đổi AUTH_SECRET thì mọi phiên hết hiệu lực.
  if (!constantTimeEqual(user, encodeUser(config))) return false;
  return constantTimeEqual(mac, await sign(`${user}.${expRaw}`, config.secret));
}

/** Khóa ký phiên; thiếu hoặc quá ngắn → null (không ai đăng nhập được). */
export function readSessionSecret(env: Record<string, string | undefined> = process.env): string | null {
  const secret = env.AUTH_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

const MEMBER_PREFIX = 'member:';
const MEMBER_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Phiên của tài khoản tự đăng ký: cùng định dạng token, chủ thể `member:<uuid>`. */
export async function createMemberToken(userId: string, secret: string, nowMs = Date.now()): Promise<string> {
  const exp = Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS;
  const payload = `${encodeSubject(`${MEMBER_PREFIX}${userId}`)}.${exp}`;
  return `${payload}.${await sign(payload, secret)}`;
}

/** Trả về id tài khoản nếu chữ ký và hạn hợp lệ; không thì null. Không kiểm DB (trạng thái tài khoản kiểm ở route). */
export async function verifyMemberToken(token: string | undefined, secret: string | null, nowMs = Date.now()): Promise<string | null> {
  if (!token || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [subjectRaw, expRaw, mac] = parts;
  const exp = Number(expRaw);
  if (!Number.isInteger(exp) || exp * 1000 <= nowMs) return null;
  if (!constantTimeEqual(mac, await sign(`${subjectRaw}.${expRaw}`, secret))) return null;
  const subject = fromBase64Url(subjectRaw);
  if (!subject?.startsWith(MEMBER_PREFIX)) return null;
  const id = subject.slice(MEMBER_PREFIX.length);
  return MEMBER_ID_RE.test(id) ? id.toLowerCase() : null;
}

/** Phiên trang chính hợp lệ: tài khoản env hoặc tài khoản tự đăng ký. */
export async function verifyUserSession(token: string | undefined, env: Record<string, string | undefined> = process.env): Promise<boolean> {
  if (await verifySessionToken(token, readAuthConfig(env))) return true;
  return (await verifyMemberToken(token, readSessionSecret(env))) !== null;
}

export { safeNextPath } from './next-path';
