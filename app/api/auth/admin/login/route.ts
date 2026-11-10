import { handleLogin } from '@/lib/auth/handlers';
import { ADMIN_COOKIE, readAdminConfig } from '@/lib/auth/session';

export const runtime = 'nodejs';

/** Đăng nhập tài khoản admin (khác tài khoản trang chính). */
export async function POST(request: Request) {
  return handleLogin(request, readAdminConfig(), ADMIN_COOKIE);
}
