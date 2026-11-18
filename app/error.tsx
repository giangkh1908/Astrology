'use client';
/** Lỗi khi render bất kỳ trang nào bên dưới layout gốc: hiện trang báo lỗi thay cho màn hình mặc định của Next.js. */
import { useEffect } from 'react';
import ErrorScreen from '@/components/ErrorScreen';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <ErrorScreen
      code="500"
      title="Trang này đang gặp lỗi"
      message="Có sự cố khi tải trang. Bạn thử lại, hoặc quay về trang chủ; dữ liệu đã lưu của bạn không bị mất."
      digest={error.digest}
      onRetry={reset}
    />
  );
}
