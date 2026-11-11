/**
 * Port lưu trữ lá số, hội thoại AI và log mỗi lần hỏi. Chỉ dùng phía server.
 * Adapter: neon-chat-store (Postgres), memory-chat-store (test); disabled khi thiếu DATABASE_URL.
 * Append-only: không có thao tác sửa/xóa hội thoại hay log.
 */
import { defaultPromptVersion, isPromptVersionId, type PromptVersionId } from '@/lib/prompts';

export type TurnStatus = 'pending' | 'ok' | 'error' | 'aborted';
export interface ToolCallLog { name: string; arguments: string }

export interface TurnStart {
  kind: 'interpret' | 'heming';
  chart: { key: string; birthInfo: unknown };
  partnerChart?: { key: string; birthInfo: unknown };
  threadKey: string;
  /** Tin user cuối của lượt này (toàn văn). */
  question: string;
  promptVersion: PromptVersionId;
  model: string;
  /** Tài khoản tự đăng ký đã hỏi; null/undefined = tài khoản env. */
  userId?: string | null;
}

export interface TurnResult {
  text: string;
  status: Exclude<TurnStatus, 'pending'>;
  error?: string;
  toolCalls: ToolCallLog[];
  firstTokenMs?: number;
  durationMs: number;
  usage?: { promptTokens?: number; completionTokens?: number; costUsd?: number };
}

export interface ChartSummary {
  id: string;
  key: string;
  birthInfo: unknown;
  createdAt: string;
  lastActivityAt: string;
  conversationCount: number;
}

export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  promptVersion: string | null;
  status: string | null;
  createdAt: string;
}

export interface ConversationDetail {
  id: string;
  kind: 'interpret' | 'heming';
  threadKey: string;
  partner?: { id: string; birthInfo: unknown };
  messages: StoredMessage[];
}

export interface RequestLog {
  id: string;
  createdAt: string;
  route: string;
  promptVersion: string;
  model: string;
  status: TurnStatus;
  question: string | null;
  answer: string | null;
  error: string | null;
  firstTokenMs: number | null;
  durationMs: number | null;
  toolCalls: ToolCallLog[];
  promptTokens: number | null;
  completionTokens: number | null;
  costUsd: number | null;
  chartId: string | null;
}

/** page tính từ 0, mỗi trang PAGE_SIZE dòng; from/to là ngày YYYY-MM-DD (giờ Việt Nam). */
export interface LogFilter { from?: string; to?: string; route?: string; promptVersion?: string; status?: string; page?: number }
export interface VersionUsage { promptVersion: string; count: number; lastUsedAt: string | null }

export const PAGE_SIZE = 50;
export const ACTIVE_PROMPT_KEY = 'active_prompt_version';

export interface ChatStore {
  readonly enabled: boolean;
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
  recordTurnStart(t: TurnStart): Promise<{ requestId: string }>;
  recordTurnEnd(requestId: string, r: TurnResult): Promise<void>;
  listCharts(page: number): Promise<ChartSummary[]>;
  getChart(id: string): Promise<{ chart: ChartSummary; conversations: ConversationDetail[] } | null>;
  listRequests(f: LogFilter): Promise<RequestLog[]>;
  versionUsage(): Promise<VersionUsage[]>;
}

/** Version prompt đang chạy: lấy từ store; không có, lạ hoặc store lỗi → mặc định. */
export async function resolvePromptVersion(store: ChatStore, env: Record<string, string | undefined> = process.env, timeoutMs = 1500): Promise<PromptVersionId> {
  try {
    // DB chậm/treo không được làm chậm chat: quá hạn thì dùng version mặc định.
    const v = await withTimeout(store.getSetting(ACTIVE_PROMPT_KEY), timeoutMs);
    if (isPromptVersionId(v)) return v;
  } catch (error) {
    console.error('resolvePromptVersion failed:', error instanceof Error ? error.message : 'unknown error');
  }
  return defaultPromptVersion(env);
}

/** Promise hết hạn sau ms thì reject; luôn dọn timer. */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms); });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
