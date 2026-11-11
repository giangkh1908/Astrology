/** UserStore trên Postgres (Neon HTTP). Mọi giá trị đi qua tham số tagged template. Schema: db/migrations/002_users.sql. */
import { neon } from '@neondatabase/serverless';
import { USER_STATUSES, type PublicUser, type UserRecord, type UserStatus, type UserStore } from './user-store';

type Row = Record<string, unknown>;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));
const isoOrNull = (v: unknown) => (v === null || v === undefined ? null : iso(v));
const limitOf = (v: unknown) => (v === null || v === undefined ? null : Number(v));

function toPublic(r: Row): PublicUser {
  return {
    id: String(r.id), username: String(r.username), status: r.status as UserStatus,
    chatLimit: limitOf(r.chat_limit), chatUsed: Number(r.chat_used),
    createdAt: iso(r.created_at), approvedAt: isoOrNull(r.approved_at), lastLoginAt: isoOrNull(r.last_login_at),
  };
}

const PUBLIC_COLS = 'id, username, status, chat_limit, chat_used, created_at, approved_at, last_login_at';

export function createNeonUserStore(databaseUrl: string): UserStore {
  const sql = neon(databaseUrl);

  return {
    enabled: true,

    async createUser(username, passwordHash) {
      const rows = await sql`insert into users (username, password_hash) values (${username}, ${passwordHash})
        on conflict (username) do nothing returning id`;
      return rows.length ? { id: String(rows[0].id) } : 'taken';
    },

    async findByUsername(username) {
      const rows = await sql`select * from users where username = ${username}`;
      if (!rows.length) return null;
      return { ...toPublic(rows[0]), passwordHash: String(rows[0].password_hash) } satisfies UserRecord;
    },

    async getById(id) {
      if (!UUID_RE.test(id)) return null;
      const rows = await sql.query(`select ${PUBLIC_COLS} from users where id = $1::uuid`, [id]);
      return rows.length ? toPublic(rows[0] as Row) : null;
    },

    async markLogin(id) {
      if (!UUID_RE.test(id)) return;
      await sql`update users set last_login_at = now() where id = ${id}::uuid`;
    },

    async consumeChat(id) {
      if (!UUID_RE.test(id)) return { ok: false, reason: 'missing' };
      // Một câu UPDATE có điều kiện: hai request đồng thời không thể cùng lấy lượt cuối.
      const rows = await sql`update users set chat_used = chat_used + 1
        where id = ${id}::uuid and status = 'approved' and (chat_limit is null or chat_used < chat_limit)
        returning chat_used, chat_limit`;
      if (rows.length) return { ok: true, used: Number(rows[0].chat_used), limit: limitOf(rows[0].chat_limit) };
      const cur = await sql`select status, chat_used, chat_limit from users where id = ${id}::uuid`;
      if (!cur.length) return { ok: false, reason: 'missing' };
      if (cur[0].status !== 'approved') return { ok: false, reason: 'inactive' };
      return { ok: false, reason: 'quota', used: Number(cur[0].chat_used), limit: limitOf(cur[0].chat_limit) };
    },

    async refundChat(id) {
      if (!UUID_RE.test(id)) return;
      await sql`update users set chat_used = greatest(chat_used - 1, 0) where id = ${id}::uuid`;
    },

    async listUsers(status) {
      const rows = status
        ? await sql.query(`select ${PUBLIC_COLS} from users where status = $1 order by created_at desc limit 500`, [status])
        : await sql.query(`select ${PUBLIC_COLS} from users order by created_at desc limit 500`);
      return (rows as Row[]).map(toPublic);
    },

    async countByStatus() {
      const rows = await sql`select status, count(*) as n from users group by status`;
      const out = Object.fromEntries(USER_STATUSES.map(s => [s, 0])) as Record<UserStatus, number>;
      for (const r of rows) if (USER_STATUSES.includes(r.status as UserStatus)) out[r.status as UserStatus] = Number(r.n);
      return out;
    },

    async updateUser(id, up) {
      if (!UUID_RE.test(id)) return null;
      let rows: Row[];
      switch (up.action) {
        case 'approve':
        case 'unlock':
          rows = await sql`update users set status = 'approved', approved_at = coalesce(approved_at, now())
            where id = ${id}::uuid returning *`;
          break;
        case 'reject':
          rows = await sql`update users set status = 'rejected' where id = ${id}::uuid returning *`;
          break;
        case 'lock':
          rows = await sql`update users set status = 'locked' where id = ${id}::uuid returning *`;
          break;
        case 'add':
          // Cộng thêm tính từ số đã dùng nếu đã hết: "+5" luôn cho thêm đúng 5 câu dùng được.
          rows = await sql`update users set chat_limit = greatest(chat_limit, chat_used) + ${up.amount}
            where id = ${id}::uuid and chat_limit is not null returning *`;
          if (!rows.length) rows = await sql`select * from users where id = ${id}::uuid`;
          break;
        case 'setLimit':
          rows = await sql`update users set chat_limit = ${up.limit}::int where id = ${id}::uuid returning *`;
          break;
      }
      return rows.length ? toPublic(rows[0]) : null;
    },
  };
}
