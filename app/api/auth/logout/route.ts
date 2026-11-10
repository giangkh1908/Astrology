import { NextResponse } from 'next/server';
import { sameOrigin } from '@/lib/auth/guard';
import { SESSION_COOKIE } from '@/lib/auth/session';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  // Chỉ nhận yêu cầu cùng nguồn: trang khác không ép đăng xuất được.
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Yêu cầu không hợp lệ.' }, { status: 403 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return response;
}
