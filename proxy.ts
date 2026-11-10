import { NextResponse, type NextRequest } from 'next/server';
import { readAuthConfig, safeNextPath, SESSION_COOKIE, verifySessionToken } from '@/lib/auth/session';

/** Chặn toàn bộ trang và API khi chưa đăng nhập; chỉ /login và /api/auth/* mở. */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === '/login' || pathname.startsWith('/api/auth/')) return NextResponse.next();

  const ok = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, readAuthConfig());
  if (ok) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 });
  }
  const url = new URL('/login', request.url);
  url.searchParams.set('next', safeNextPath(pathname + search));
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Bỏ qua file tĩnh và ảnh tối ưu để CSS/JS/icon của trang login vẫn tải được.
    '/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml|woff2?)$).*)',
  ],
};
