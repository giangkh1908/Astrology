import Link from 'next/link';
import { getChatStore } from '@/lib/store';
import { PAGE_SIZE, type ChartSummary } from '@/lib/store/chat-store';
import { describeBirth, formatDateTime } from '@/app/admin/format';
import { requireAdminPage } from '@/app/admin/guard';
import { DbDisabled, DbError, Pager, pageOf } from '@/app/admin/ui';
import s from '@/app/admin/admin.module.css';

export const dynamic = 'force-dynamic';

export default async function AdminChartsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminPage('/admin/charts');
  const store = getChatStore();
  if (!store.enabled) return <DbDisabled />;

  const page = pageOf((await searchParams).page);
  let charts: ChartSummary[];
  try {
    charts = await store.listCharts(page);
  } catch (error) {
    console.error('listCharts failed:', error instanceof Error ? error.message : 'unknown error');
    return <DbError />;
  }

  return (
    <div>
      <p className={s.muted} style={{ marginBottom: 12 }}>Mỗi lá số đã từng hỏi AI, mới hoạt động nhất trước. Bấm để xem toàn bộ nội dung chat.</p>
      {charts.length === 0 ? (
        <div className={s.card}><p className={s.muted}>Chưa có lá số nào.</p></div>
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr><th>Lá số</th><th>Luồng chat</th><th>Hoạt động cuối</th><th className={s.hideSm}>Tạo lúc</th></tr>
            </thead>
            <tbody>
              {charts.map(c => (
                <tr key={c.id}>
                  <td><Link className={s.link} href={`/admin/charts/${c.id}`}>{describeBirth(c.birthInfo)}</Link></td>
                  <td>{c.conversationCount}</td>
                  <td>{formatDateTime(c.lastActivityAt)}</td>
                  <td className={s.hideSm}>{formatDateTime(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} hasNext={charts.length === PAGE_SIZE} href={p => `/admin/charts?page=${p}`} />
    </div>
  );
}
