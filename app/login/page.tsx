import { LoginScreen } from '@/components/LoginScreen';

export default function LoginPage() {
  return <LoginScreen endpoint="/api/auth/login" title="Đăng nhập" subtitle="Đăng nhập để xem lá số và hỏi AI." registerHref="/register" />;
}
