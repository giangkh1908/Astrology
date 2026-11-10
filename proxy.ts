import { NextResponse, type NextRequest } from 'next/server';
import { ADMIN_COOKIE, readAdminConfig, readAuthConfig, safeNextPath, SESSION_COOKIE, verifySessionToken } from '@/lib/auth/session';

const isAdminPath = (p: string) => p === '/admin' || p.startsWith('/admin/') || p === '/api/admin' || p.startsWith('/api/admin/');

/**
 * Chặn toàn bộ trang và API khi chưa đăng nhập. Mở: /login, /admin/login, /api/auth/*.
 * Khu /admin và /api/admin chỉ nhận tài khoản admin; phần còn lại nhận tài khoản thường.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === '/login' || pathname === '/admin/login' || pathname.startsWith('/api/auth/')) return NextResponse.next();

  const admin = isAdminPath(pathname);
  const ok = admin
    ? await verifySessionToken(request.cookies.get(ADMIN_COOKIE)?.value, readAdminConfig())
    : await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, readAuthConfig());
  if (ok) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
  }
  const url = new URL(admin ? '/admin/login' : '/login', request.url);
  url.searchParams.set('next', safeNextPath(pathname + search));
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Bỏ qua file tĩnh và ảnh tối ưu để CSS/JS/icon của trang login vẫn tải được.
    '/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml|woff2?)$).*)',
  ],
};
