/** Điểm chọn UserStore duy nhất: có DATABASE_URL → Postgres (Neon), không → tắt (không đăng ký/đăng nhập tài khoản DB được). */
import type { UserStore } from './user-store';
import { createNeonUserStore } from './neon-user-store';

const off = async () => { throw new Error('Chưa cấu hình DATABASE_URL.'); };

export const disabledUserStore: UserStore = {
  enabled: false,
  createUser: off,
  async findByUsername() { return null; },
  async getById() { return null; },
  async markLogin() { /* không lưu */ },
  async consumeChat() { return { ok: false, reason: 'missing' }; },
  async refundChat() { /* không lưu */ },
  async listUsers() { return []; },
  async countByStatus() { return { pending: 0, approved: 0, rejected: 0, locked: 0 }; },
  async updateUser() { return null; },
};

let instance: UserStore | null = null;
let override: UserStore | null = null;

export function getUserStore(): UserStore {
  if (override) return override;
  if (!instance) {
    const url = process.env.DATABASE_URL?.trim();
    instance = url ? createNeonUserStore(url) : disabledUserStore;
  }
  return instance;
}

/** Chỉ dùng trong test. */
export function setUserStoreForTest(store: UserStore | null): void {
  override = store;
}
