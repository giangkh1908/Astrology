import { handleUserLogin } from '@/lib/auth/user-handlers';
import { readAuthConfig, SESSION_COOKIE } from '@/lib/auth/session';

export const runtime = 'nodejs';

/** Đăng nhập trang chính: tài khoản env hoặc tài khoản tự đăng ký đã được duyệt. */
export async function POST(request: Request) {
  return handleUserLogin(request, readAuthConfig(), SESSION_COOKIE);
}
