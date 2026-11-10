import type { Metadata } from 'next';
import { LoginScreen } from '@/components/LoginScreen';

export const metadata: Metadata = { title: 'Đăng nhập quản trị', robots: { index: false, follow: false } };

export default function AdminLoginPage() {
  return (
    <LoginScreen
      endpoint="/api/auth/admin/login"
      title="Đăng nhập quản trị"
      subtitle="Dùng tài khoản admin, khác tài khoản trang chính."
      nextPrefix="/admin"
      fallback="/admin"
    />
  );
}
