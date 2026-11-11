import type { Metadata } from 'next';
import { RegisterScreen } from '@/components/RegisterScreen';

export const metadata: Metadata = {
  title: 'Đăng ký tài khoản',
  robots: { index: false },
};

export default function RegisterPage() {
  return <RegisterScreen />;
}
