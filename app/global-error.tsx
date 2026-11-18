'use client';
/** Lỗi ngay ở layout gốc (error.tsx không bắt được): phải tự dựng <html>/<body>. */
import { useEffect } from 'react';
import './globals.css';
import ErrorScreen from '@/components/ErrorScreen';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <html lang="vi" data-theme="light">
      <body>
        <ErrorScreen
          code="500"
          title="Ứng dụng đang gặp lỗi"
          message="Có sự cố khi tải ứng dụng. Bạn thử lại sau ít phút; dữ liệu đã lưu của bạn không bị mất."
          digest={error.digest}
          onRetry={reset}
        />
      </body>
    </html>
  );
}
