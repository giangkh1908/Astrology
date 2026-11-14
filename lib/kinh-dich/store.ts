/**
 * Port lưu trữ Kinh Dịch: mỗi lần gieo (cast) là một hội thoại kind 'kinhdich' của một chủ tài khoản.
 * Adapter: store-neon (Postgres), store-memory (test); disabled khi thiếu DATABASE_URL. Chỉ dùng phía server.
 * owner: userId của tài khoản tự đăng ký; null = tài khoản trong biến môi trường.
 */
import type { HistoryMessage, TurnResult } from '@/lib/store/chat-store';
import type { LineValue } from './core';
import { createNeonKinhDichStore } from './store-neon';

export type Owner = string | null;

export interface CastSummary {
  castId: string;
  question: string;
  lines: LineValue[] | null;
  castAt: string | null;
  createdAt: string;
}

export interface CastRecord extends CastSummary {
  /** Các cặp hỏi–đáp đã xong (buildHistory). */
  messages: HistoryMessage[];
  /** status tin assistant cuối ('asked' = đang chờ trả lời thẻ hỏi); chưa có thì null. */
  lastAssistantStatus: string | null;
  /** Số tin assistant đã ghi (để giới hạn số lượt làm rõ trước khi gieo). */
  assistantCount: number;
}

export interface KdTurnStart { question: string; hidden: boolean; promptVersion: string; model: string }
export interface MemoryNote { castId: string; content: string; createdAt: string }

export interface KinhDichStore {
  readonly enabled: boolean;
  createCast(owner: Owner, question: string): Promise<{ castId: string }>;
  getCast(owner: Owner, castId: string): Promise<CastRecord | null>;
  /** Mới nhất trước. */
  listCasts(owner: Owner, limit: number): Promise<CastSummary[]>;
  /** Ghi 6 hào một lần duy nhất (nguyên tử): true nếu lần này ghi được. */
  saveLines(owner: Owner, castId: string, lines: LineValue[]): Promise<boolean>;
  recordTurnStart(owner: Owner, castId: string, t: KdTurnStart): Promise<{ requestId: string }>;
  recordTurnEnd(requestId: string, r: TurnResult): Promise<void>;
  /** Dữ liệu cho memory: các lần gieo khác và tin người dùng tự gõ (không ẩn) trong đó, mới nhất trước. */
  loadMemoryRows(owner: Owner, excludeCastId: string | null, limit: number): Promise<{ casts: CastSummary[]; notes: MemoryNote[] }>;
}

export const MAX_QUESTION_CHARS = 500;
export const ROUTE_NAME = 'kinh-dich';

export const disabledKinhDichStore: KinhDichStore = {
  enabled: false,
  async createCast() { return { castId: '' }; },
  async getCast() { return null; },
  async listCasts() { return []; },
  async saveLines() { return false; },
  async recordTurnStart() { return { requestId: '' }; },
  async recordTurnEnd() { /* không lưu */ },
  async loadMemoryRows() { return { casts: [], notes: [] }; },
};

let instance: KinhDichStore | null = null;
let override: KinhDichStore | null = null;

export function getKinhDichStore(): KinhDichStore {
  if (override) return override;
  if (!instance) {
    const url = process.env.DATABASE_URL?.trim();
    instance = url ? createNeonKinhDichStore(url) : disabledKinhDichStore;
  }
  return instance;
}

/** Chỉ dùng trong test. */
export function setKinhDichStoreForTest(store: KinhDichStore | null): void {
  override = store;
}
