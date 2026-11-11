/** Điểm chọn ChatStore duy nhất: có DATABASE_URL → Postgres (Neon), không → tắt (không lưu, đọc trả rỗng). */
import type { ChatStore } from './chat-store';
import { createNeonChatStore } from './neon-chat-store';

export const disabledChatStore: ChatStore = {
  enabled: false,
  async getSetting() { return null; },
  async setSetting() { throw new Error('Chưa cấu hình DATABASE_URL.'); },
  async recordTurnStart() { return { requestId: '' }; },
  async recordTurnEnd() { /* không lưu */ },
  async listCharts() { return []; },
  async getChart() { return null; },
  async listRequests() { return []; },
  async versionUsage() { return []; },
  async loadHistory() { return []; },
  async closeThread() { /* không lưu */ },
};

let instance: ChatStore | null = null;
let override: ChatStore | null = null;

export function getChatStore(): ChatStore {
  if (override) return override;
  if (!instance) {
    const url = process.env.DATABASE_URL?.trim();
    instance = url ? createNeonChatStore(url) : disabledChatStore;
  }
  return instance;
}

/** Chỉ dùng trong test. */
export function setChatStoreForTest(store: ChatStore | null): void {
  override = store;
}
