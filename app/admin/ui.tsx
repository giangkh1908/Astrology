import Link from 'next/link';
import s from './admin.module.css';

/** Khối hướng dẫn khi chưa cấu hình cơ sở dữ liệu. */
export function DbDisabled() {
  return (
    <div className={s.card}>
      <h2 className={s.h2}>Chưa bật lưu trữ</h2>
      <p className={s.muted}>
        Đặt biến môi trường <code>DATABASE_URL</code> (chuỗi kết nối Neon Postgres) rồi chạy <code>npm run db:migrate</code> để tạo bảng.
        Sau đó khởi động lại ứng dụng. Khi chưa có DB, chat vẫn chạy bình thường nhưng không được ghi lại và version prompt dùng mặc định.
      </p>
    </div>
  );
}

export function DbError() {
  return <div className={s.card}><p className={s.error}>Không đọc được dữ liệu từ cơ sở dữ liệu. Thử tải lại sau.</p></div>;
}

/** Trang hiện tại từ query `?page=` (0-based, giới hạn hợp lý). */
export function pageOf(raw: string | string[] | undefined): number {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(n) && n >= 0 && n <= 10_000 ? n : 0;
}

/** Phân trang đơn giản: có trang trước nếu page > 0, có trang sau nếu trang này đầy. */
export function Pager({ page, hasNext, href }: { page: number; hasNext: boolean; href: (page: number) => string }) {
  if (page === 0 && !hasNext) return null;
  return (
    <nav className={s.pager} aria-label="Phân trang">
      {page > 0 ? <Link className={s.link} href={href(page - 1)}>← Trước</Link> : <span className={s.muted}>← Trước</span>}
      <span>Trang {page + 1}</span>
      {hasNext ? <Link className={s.link} href={href(page + 1)}>Sau →</Link> : <span className={s.muted}>Sau →</span>}
    </nav>
  );
}

export function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const label = { ok: 'xong', error: 'lỗi', aborted: 'bị hủy', pending: 'đang chạy' }[status] ?? status;
  const cls = status === 'ok' ? s.badgeOk : status === 'error' ? s.badgeErr : s.badge;
  return <span className={cls}>{label}</span>;
}
