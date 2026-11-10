import { LoginScreen } from '@/components/LoginScreen';

export default function LoginPage() {
  return <LoginScreen endpoint="/api/auth/login" title="Đăng nhập" subtitle="Trang này chỉ dành cho tài khoản được cấp." />;
}
