import { randomUUID } from 'node:crypto';
import { DEFAULT_CHAT_LIMIT, USER_STATUSES, type PublicUser, type UserRecord, type UserStore } from './user-store';

const pub = ({ passwordHash: _, ...u }: UserRecord): PublicUser => ({ ...u });

/** UserStore trong bộ nhớ, cho test. Hành vi phải khớp neon-user-store. Thao tác đồng bộ nên trừ lượt là nguyên tử. */
export function createMemoryUserStore(): UserStore {
  const users: UserRecord[] = [];
  let seq = 0;
  const now = () => new Date(Date.now() + seq++).toISOString();
  const byId = (id: string) => users.find(u => u.id === id);

  return {
    enabled: true,
    async createUser(username, passwordHash) {
      if (users.some(u => u.username === username)) return 'taken';
      const u: UserRecord = {
        id: randomUUID(), username, passwordHash, status: 'pending', chatLimit: DEFAULT_CHAT_LIMIT, chatUsed: 0,
        createdAt: now(), approvedAt: null, lastLoginAt: null,
      };
      users.push(u);
      return { id: u.id };
    },
    async findByUsername(username) {
      const u = users.find(x => x.username === username);
      return u ? { ...u } : null;
    },
    async getById(id) {
      const u = byId(id);
      return u ? pub(u) : null;
    },
    async markLogin(id) {
      const u = byId(id);
      if (u) u.lastLoginAt = now();
    },
    async consumeChat(id) {
      const u = byId(id);
      if (!u) return { ok: false, reason: 'missing' };
      if (u.status !== 'approved') return { ok: false, reason: 'inactive' };
      if (u.chatLimit !== null && u.chatUsed >= u.chatLimit) return { ok: false, reason: 'quota', used: u.chatUsed, limit: u.chatLimit };
      u.chatUsed++;
      return { ok: true, used: u.chatUsed, limit: u.chatLimit };
    },
    async refundChat(id) {
      const u = byId(id);
      if (u) u.chatUsed = Math.max(u.chatUsed - 1, 0);
    },
    async listUsers(status) {
      return users.filter(u => !status || u.status === status)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(pub);
    },
    async countByStatus() {
      const out = Object.fromEntries(USER_STATUSES.map(s => [s, 0])) as Record<typeof USER_STATUSES[number], number>;
      for (const u of users) out[u.status]++;
      return out;
    },
    async updateUser(id, up) {
      const u = byId(id);
      if (!u) return null;
      switch (up.action) {
        case 'approve': u.status = 'approved'; u.approvedAt ??= now(); break;
        case 'reject': u.status = 'rejected'; break;
        case 'lock': u.status = 'locked'; break;
        case 'unlock': u.status = 'approved'; u.approvedAt ??= now(); break;
        case 'add': if (u.chatLimit !== null) u.chatLimit = Math.max(u.chatLimit, u.chatUsed) + up.amount; break;
        case 'setLimit': u.chatLimit = up.limit; break;
      }
      return pub(u);
    },
  };
}
