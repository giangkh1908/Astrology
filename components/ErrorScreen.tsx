'use client';
/** Màn hình báo lỗi dùng chung cho app/error.tsx, app/global-error.tsx và app/not-found.tsx. */
import Link from 'next/link';

interface Props {
  /** Chữ lớn, vd "500" hoặc "404". */
  code: string;
  title: string;
  message: string;
  /** Mã lỗi Next.js (digest) để đối chiếu log server; chỉ có ở lỗi phía server. */
  digest?: string;
  /** Có thì hiện nút "Thử lại" (render lại đoạn bị lỗi). */
  onRetry?: () => void;
}

const btn: React.CSSProperties = {
  borderRadius: 999, padding: '9px 18px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
  border: '1px solid var(--bdr-med)', background: 'transparent', color: 'var(--tx-1)', textDecoration: 'none',
};

export default function ErrorScreen({ code, title, message, digest, onRetry }: Props) {
  return (
    <main
      role="alert"
      style={{
        minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '32px 16px', background: 'var(--bg-0)', color: 'var(--tx-1)',
      }}
    >
      <div style={{ maxWidth: 440, width: '100%', textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-serif-vi), serif', fontSize: 64, lineHeight: 1, color: 'var(--ac)', letterSpacing: '0.08em' }}>
          {code}
        </div>
        <h1 style={{ marginTop: 16, fontSize: 20, fontWeight: 600, color: 'var(--tx-0)' }}>{title}</h1>
        <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.7, color: 'var(--tx-2)' }}>{message}</p>
        {digest && (
          <p style={{ marginTop: 12, fontSize: 12, color: 'var(--tx-3)' }}>
            Mã lỗi: <code style={{ userSelect: 'all' }}>{digest}</code> — gửi mã này cho admin nếu lỗi lặp lại.
          </p>
        )}
        <div style={{ marginTop: 24, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          {onRetry && (
            <button type="button" onClick={onRetry} style={{ ...btn, background: 'var(--ac)', borderColor: 'var(--ac)', color: 'var(--bg-0)' }}>
              Thử lại
            </button>
          )}
          <button type="button" onClick={() => history.length > 1 ? history.back() : location.assign('/')} style={btn}>
            Quay lại trang trước
          </button>
          <Link href="/" style={btn}>Về trang chủ</Link>
        </div>
      </div>
    </main>
  );
}
