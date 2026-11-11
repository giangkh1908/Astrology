/** Phiên đăng nhập giả cho test gọi route AI (route giờ yêu cầu đăng nhập và trừ lượt). */
import { createSessionToken, readAuthConfig, SESSION_COOKIE } from '../../../lib/auth/session';

/** Đặt tài khoản env giả (không giới hạn lượt) và trả về header Cookie hợp lệ. */
export async function envUserCookie(): Promise<string> {
  process.env.AUTH_USERNAME ??= 'tester';
  process.env.AUTH_PASSWORD ??= 'fake-password-123';
  process.env.AUTH_SECRET ??= 'x'.repeat(40);
  return `${SESSION_COOKIE}=${await createSessionToken(readAuthConfig()!)}`;
}
