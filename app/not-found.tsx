import type { Metadata } from 'next';
import ErrorScreen from '@/components/ErrorScreen';

export const metadata: Metadata = { title: 'Không tìm thấy trang', robots: { index: false } };

export default function NotFound() {
  return (
    <ErrorScreen
      code="404"
      title="Không tìm thấy trang"
      message="Đường dẫn này không tồn tại hoặc đã được đổi. Bạn kiểm tra lại địa chỉ, hoặc về trang chủ để bắt đầu lại."
    />
  );
}
