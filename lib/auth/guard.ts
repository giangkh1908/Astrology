/**
 * Kiểm tra quyền admin ngay trong route handler / trang (lớp thứ hai sau proxy.ts).
 * Chỉ chấp nhận phiên của tài khoản admin (cookie tv_admin, scope 'admin'); phiên tài khoản thường không đủ.
 * Thao tác ghi còn phải cùng nguồn: Origin của request khớp với host đang phục vụ (chống CSRF).
 */
import { ADMIN_COOKIE, readAdminConfig, verifySessionToken } from './session';

export function cookieValue(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return undefined;
}

export async function isAdminAuthenticated(cookieHeaderOrToken: { cookieHeader?: string | null; token?: string }): Promise<boolean> {
  const token = cookieHeaderOrToken.token ?? cookieValue(cookieHeaderOrToken.cookieHeader ?? null, ADMIN_COOKIE);
  return verifySessionToken(token, readAdminConfig());
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const target = new URL(request.url);
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? target.host;
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Trả về Response lỗi nếu không được phép, null nếu hợp lệ. */
export async function requireAdmin(request: Request, { write = false } = {}): Promise<Response | null> {
  if (!(await isAdminAuthenticated({ cookieHeader: request.headers.get('cookie') }))) {
    return Response.json({ error: 'Chưa đăng nhập tài khoản admin.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  if (write && !sameOrigin(request)) {
    return Response.json({ error: 'Yêu cầu không hợp lệ.' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }
  return null;
}
