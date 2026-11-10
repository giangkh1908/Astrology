/**
 * Kiểm tra quyền admin ngay trong route handler / trang (lớp thứ hai sau proxy.ts).
 * Thao tác ghi còn phải cùng nguồn: Origin của request khớp với host đang phục vụ (chống CSRF).
 */
import { readAuthConfig, SESSION_COOKIE, verifySessionToken } from './session';

function cookieValue(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return undefined;
}

export async function isAuthenticated(cookieHeaderOrToken: { cookieHeader?: string | null; token?: string }): Promise<boolean> {
  const token = cookieHeaderOrToken.token ?? cookieValue(cookieHeaderOrToken.cookieHeader ?? null, SESSION_COOKIE);
  return verifySessionToken(token, readAuthConfig());
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
  if (!(await isAuthenticated({ cookieHeader: request.headers.get('cookie') }))) {
    return Response.json({ error: 'Chưa đăng nhập.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  if (write && !sameOrigin(request)) {
    return Response.json({ error: 'Yêu cầu không hợp lệ.' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }
  return null;
}
