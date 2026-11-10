import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { isAdminAuthenticated } from '@/lib/auth/guard';
import { ADMIN_COOKIE } from '@/lib/auth/session';

/** Lớp kiểm tra thứ hai cho mọi trang /admin (sau proxy.ts): chưa đăng nhập admin → về /admin/login. */
export async function requireAdminPage(next = '/admin'): Promise<void> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!(await isAdminAuthenticated({ token }))) redirect(`/admin/login?next=${encodeURIComponent(next)}`);
}
