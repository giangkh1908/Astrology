import Link from 'next/link';
import { notFound } from 'next/navigation';
import { viPalace } from '@/lib/vn/terms';
import { generateChart } from '@/lib/ziwei/algorithm';
import type { BirthInfo } from '@/lib/ziwei/types';
import { getChatStore } from '@/lib/store';
import { UUID_RE, type ChatStore } from '@/lib/store/chat-store';
import { describeBirth, formatDateTime, threadLabel } from '@/app/admin/format';
import { requireAdminPage } from '@/app/admin/guard';
import { DbDisabled, DbError, StatusBadge } from '@/app/admin/ui';
import s from '@/app/admin/admin.module.css';

export const dynamic = 'force-dynamic';

/** Tra tên cung theo địa chi bằng cách lập lại lá số từ birthInfo đã lưu; lỗi thì bỏ qua. */
function palaceNamesOf(birthInfo: unknown): (branch: number) => string | undefined {
  try {
    const chart = generateChart(birthInfo as BirthInfo);
    const names = new Map(chart.palaces.map(p => [p.branch, viPalace(p.name)]));
    return b => names.get(b);
  } catch {
    return () => undefined;
  }
}

export default async function AdminChartDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdminPage('/admin/charts');
  if (!UUID_RE.test(id)) notFound();
  const store = getChatStore();
  if (!store.enabled) return <DbDisabled />;

  let data: Awaited<ReturnType<ChatStore['getChart']>>;
  try {
    data = await store.getChart(id);
  } catch (error) {
    console.error('getChart failed:', error instanceof Error ? error.message : 'unknown error');
    return <DbError />;
  }
  if (!data) notFound();

  const { chart, conversations } = data;
  const palaceName = palaceNamesOf(chart.birthInfo);

  return (
    <div className={s.stack}>
      <Link href="/admin/charts" className={s.link}>← Danh sách lá số</Link>
      <section className={s.card}>
        <h2 className={s.h2}>{describeBirth(chart.birthInfo)}</h2>
        <p className={s.small}>
          {conversations.length} luồng chat · tạo {formatDateTime(chart.createdAt)} · hoạt động cuối {formatDateTime(chart.lastActivityAt)}
        </p>
      </section>

      {conversations.length === 0 && <div className={s.card}><p className={s.muted}>Chưa có cuộc trò chuyện nào.</p></div>}

      {conversations.map(c => (
        <section key={c.id} className={s.convo}>
          <div className={s.convoHead}>
            <strong>{threadLabel(c.threadKey, c.kind === 'interpret' ? palaceName : undefined)}</strong>
            {c.kind === 'heming' && <span className={s.small}>với {describeBirth(c.partner?.birthInfo)}</span>}
            <span className={s.small}>{c.messages.length} tin</span>
          </div>
          {c.messages.map(m => (
            <article key={m.id} className={m.role === 'user' ? s.msgUser : s.msg}>
              <div className={s.msgMeta}>
                <strong>{m.role === 'user' ? 'Người hỏi' : 'AI'}</strong>
                <span>{formatDateTime(m.createdAt)}</span>
                {m.role === 'assistant' && m.promptVersion && <span className={s.badge}>{m.promptVersion}</span>}
                {m.role === 'assistant' && <StatusBadge status={m.status} />}
              </div>
              <p className={s.text}>{m.content || '(trống)'}</p>
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
