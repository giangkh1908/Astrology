import { NextResponse } from 'next/server';
import { checkCredentials, createSessionToken, readAuthConfig, SESSION_COOKIE, SESSION_TTL_SECONDS } from '@/lib/auth/session';

export const runtime = 'nodejs';

const FAIL_DELAY_MS = 800;

export async function POST(request: Request) {
  const config = readAuthConfig();
  if (!config) {
    return NextResponse.json({ error: 'Máy chủ chưa cấu hình tài khoản đăng nhập.' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Dữ liệu không hợp lệ.' }, { status: 400 });
  }
  const { username, password } = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;

  if (!checkCredentials(username, password, config)) {
    // Làm chậm thử mật khẩu hàng loạt.
    await new Promise(resolve => setTimeout(resolve, FAIL_DELAY_MS));
    return NextResponse.json({ error: 'Sai tên đăng nhập hoặc mật khẩu.' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(config), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}
