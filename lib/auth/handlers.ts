/** Xử lý đăng nhập / đăng xuất dùng chung cho tài khoản thường và tài khoản admin. */
import { NextResponse } from 'next/server';
import { sameOrigin } from './guard';
import { checkCredentials, createSessionToken, SESSION_TTL_SECONDS, type AuthConfig } from './session';

const FAIL_DELAY_MS = 800;

export async function handleLogin(request: Request, config: AuthConfig | null, cookieName: string): Promise<Response> {
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
  response.cookies.set(cookieName, await createSessionToken(config), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  return response;
}

export function handleLogout(request: Request, cookieName: string): Response {
  // Chỉ nhận yêu cầu cùng nguồn: trang khác không ép đăng xuất được.
  if (!sameOrigin(request)) return NextResponse.json({ error: 'Yêu cầu không hợp lệ.' }, { status: 403 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookieName, '', { httpOnly: true, path: '/', maxAge: 0 });
  return response;
}
