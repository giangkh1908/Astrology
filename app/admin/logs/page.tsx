import Link from 'next/link';
import { PROMPT_VERSIONS } from '@/lib/prompts';
import { getChatStore } from '@/lib/store';
import { PAGE_SIZE, type LogFilter, type RequestLog } from '@/lib/store/chat-store';
import { formatDateTime } from '../format';
import { requireAdminPage } from '../guard';
import { DbDisabled, DbError, Pager, pageOf } from '../ui';
import { LogRow } from './LogRow';
import s from '../admin.module.css';

export const dynamic = 'force-dynamic';

type Params = Record<string, string | string[] | undefined>;

const ROUTES = [{ id: 'interpret', label: 'Luận giải' }, { id: 'heming', label: 'Hợp bàn' }];
const STATUSES = [{ id: 'ok', label: 'Xong' }, { id: 'error', label: 'Lỗi' }, { id: 'aborted', label: 'Bị hủy' }, { id: 'pending', label: 'Đang chạy' }];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

/** Chỉ nhận giá trị lọc trong danh sách đã biết; còn lại bỏ qua. */
function filterOf(p: Params): LogFilter {
  const pick = (v: string, allowed: readonly { id: string }[]) => (allowed.some(a => a.id === v) ? v : undefined);
  const from = one(p.from), to = one(p.to);
  return {
    from: DATE_RE.test(from) ? from : undefined,
    to: DATE_RE.test(to) ? to : undefined,
    route: pick(one(p.route), ROUTES),
    promptVersion: pick(one(p.version), PROMPT_VERSIONS),
    status: pick(one(p.status), STATUSES),
    page: pageOf(p.page),
  };
}

function hrefOf(f: LogFilter, page: number): string {
  const q = new URLSearchParams();
  if (f.from) q.set('from', f.from);
  if (f.to) q.set('to', f.to);
  if (f.route) q.set('route', f.route);
  if (f.promptVersion) q.set('version', f.promptVersion);
  if (f.status) q.set('status', f.status);
  if (page > 0) q.set('page', String(page));
  const qs = q.toString();
  return qs ? `/admin/logs?${qs}` : '/admin/logs';
}

function Select({ name, label, value, options }: { name: string; label: string; value?: string; options: readonly { id: string; label: string }[] }) {
  return (
    <label className={s.field}>
      {label}
      <select name={name} defaultValue={value ?? ''} className={s.input}>
        <option value="">Tất cả</option>
        {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </label>
  );
}

export default async function AdminLogsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireAdminPage('/admin/logs');
  const store = getChatStore();
  if (!store.enabled) return <DbDisabled />;

  const f = filterOf(await searchParams);
  let logs: RequestLog[];
  try {
    logs = await store.listRequests(f);
  } catch (error) {
    console.error('listRequests failed:', error instanceof Error ? error.message : 'unknown error');
    return <DbError />;
  }

  return (
    <div>
      <form method="get" action="/admin/logs" className={s.filters}>
        <label className={s.field}>Từ ngày<input type="date" name="from" defaultValue={f.from} className={s.input} /></label>
        <label className={s.field}>Đến ngày<input type="date" name="to" defaultValue={f.to} className={s.input} /></label>
        <Select name="route" label="Loại" value={f.route} options={ROUTES} />
        <Select name="version" label="Version" value={f.promptVersion} options={PROMPT_VERSIONS.map(v => ({ id: v.id, label: v.id }))} />
        <Select name="status" label="Trạng thái" value={f.status} options={STATUSES} />
        <button type="submit" className={s.button}>Lọc</button>
        <Link href="/admin/logs" className={s.buttonGhost} style={{ textDecoration: 'none' }}>Xóa lọc</Link>
      </form>

      {logs.length === 0 ? (
        <div className={s.card}><p className={s.muted}>Không có lượt hỏi nào khớp bộ lọc.</p></div>
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Thời gian</th><th className={s.hideSm}>Loại</th><th>Câu hỏi</th><th>Ver.</th>
                <th className={s.hideSm}>Model</th><th className={s.hideSm}>Chữ đầu / tổng</th><th className={s.hideSm}>Token · chi phí</th><th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(l => <LogRow key={l.id} log={l} time={formatDateTime(l.createdAt)} />)}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={f.page ?? 0} hasNext={logs.length === PAGE_SIZE} href={p => hrefOf(f, p)} />
    </div>
  );
}
