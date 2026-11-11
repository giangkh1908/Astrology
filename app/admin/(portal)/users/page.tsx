import Link from 'next/link';
import { getUserStore } from '@/lib/users';
import { USER_STATUSES, type PublicUser, type UserStatus } from '@/lib/users/user-store';
import { formatDateTime } from '@/app/admin/format';
import { requireAdminPage } from '@/app/admin/guard';
import { DbDisabled, DbError } from '@/app/admin/ui';
import { UserActions } from './UserActions';
import s from '@/app/admin/admin.module.css';

export const dynamic = 'force-dynamic';

const LABELS: Record<UserStatus, string> = { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối', locked: 'Bị khóa' };
const ORDER: UserStatus[] = ['pending', 'approved', 'rejected', 'locked'];

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminPage('/admin/users');
  const store = getUserStore();
  if (!store.enabled) return <DbDisabled />;

  const raw = (await searchParams).status;
  const q = Array.isArray(raw) ? raw[0] : raw;
  const all = q === 'all';
  const status: UserStatus = USER_STATUSES.includes(q as UserStatus) ? (q as UserStatus) : 'pending';

  let users: PublicUser[];
  let counts: Record<UserStatus, number>;
  try {
    [users, counts] = await Promise.all([store.listUsers(all ? undefined : status), store.countByStatus()]);
  } catch (error) {
    console.error('listUsers failed:', error instanceof Error ? error.message : 'unknown error');
    return <DbError />;
  }
  const total = ORDER.reduce((n, k) => n + counts[k], 0);

  return (
    <div className={s.stack}>
      <nav className={s.actions} aria-label="Lọc theo trạng thái">
        {ORDER.map(k => (
          <Link key={k} href={`/admin/users?status=${k}`} className={!all && status === k ? s.button : s.buttonGhost} style={{ textDecoration: 'none' }}>
            {LABELS[k]} ({counts[k]})
          </Link>
        ))}
        <Link href="/admin/users?status=all" className={all ? s.button : s.buttonGhost} style={{ textDecoration: 'none' }}>Tất cả ({total})</Link>
      </nav>

      {users.length === 0 ? (
        <div className={s.card}><p className={s.muted}>Không có tài khoản nào ở mục này.</p></div>
      ) : (
        <div className={s.tableWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Tên đăng nhập</th><th>Trạng thái</th><th>Đã dùng</th><th>Ngày đăng ký</th><th>Đăng nhập gần nhất</th><th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>{u.username}</td>
                  <td><span className={u.status === 'approved' ? s.badgeOk : u.status === 'pending' ? s.badge : s.badgeErr}>{LABELS[u.status]}</span></td>
                  <td>{u.chatUsed}/{u.chatLimit ?? '∞'}</td>
                  <td>{formatDateTime(u.createdAt)}</td>
                  <td>{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : '—'}</td>
                  <td><UserActions id={u.id} status={u.status} limit={u.chatLimit} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
