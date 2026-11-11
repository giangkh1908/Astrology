import { handleRegister } from '@/lib/auth/user-handlers';

export const runtime = 'nodejs';

/** Tự đăng ký tài khoản (chờ admin duyệt). Tên trùng tài khoản env bị chặn. */
export async function POST(request: Request) {
  const reserved = [process.env.AUTH_USERNAME, process.env.ADMIN_USERNAME, 'admin'].filter((n): n is string => !!n);
  return handleRegister(request, reserved);
}
