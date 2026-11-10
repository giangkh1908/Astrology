import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth/guard';
import { SESSION_COOKIE } from '@/lib/auth/session';

/** Lớp kiểm tra thứ hai cho mọi trang /admin (sau proxy.ts): chưa đăng nhập → về /login. */
export async function requireAdminPage(next = '/admin'): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!(await isAuthenticated({ token }))) redirect(`/login?next=${encodeURIComponent(next)}`);
}
