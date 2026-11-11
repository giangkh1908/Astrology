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
  /** Lượt mở đầu mục (chưa có câu trả lời nào trong lịch sử client gửi): bỏ lịch sử cũ khi nạp lại. */
  fresh?: boolean;
  /** Câu hỏi tự động (không do người dùng gõ): không hiện thành bong bóng khi nạp lại. */
  hiddenQuestion?: boolean;
}

/** Hội thoại của một người trên một lá số (hoặc cặp lá số với hợp bàn). userId null = tài khoản env. */
export interface HistoryQuery {
  kind: 'interpret' | 'heming';
  chartKey: string;
  partnerKey?: string | null;
  userId: string | null;
}

export interface HistoryMessage { role: 'user' | 'assistant'; content: string; hidden?: boolean }
export interface HistoryThread { threadKey: string; updatedAt: string; messages: HistoryMessage[] }

/** Dòng tin nhắn thô (sau mốc reset) để ghép thành lịch sử; dùng chung cho mọi adapter. */
export interface HistoryRow {
  threadKey: string;
  updatedAt: string;
  role: 'user' | 'assistant';
  content: string;
  hidden: boolean;
  requestId: string | null;
}

/**
 * Ghép tin nhắn thành các mục: mỗi câu hỏi đi với câu trả lời của cùng lượt (theo requestId; dữ liệu cũ
 * không có requestId thì lấy tin trả lời ngay sau). Lượt chưa xong, lỗi hoặc trả lời rỗng bị bỏ cả cặp.
 * rows phải theo thứ tự ghi (id tăng dần); mục trả về theo thứ tự cập nhật cũ → mới.
 */
export function buildHistory(rows: HistoryRow[]): HistoryThread[] {
  const byThread = new Map<string, HistoryRow[]>();
  for (const r of rows) {
    const list = byThread.get(r.threadKey) ?? [];
    list.push(r);
    byThread.set(r.threadKey, list);
  }
  const out: HistoryThread[] = [];
  for (const [threadKey, list] of byThread) {
    const messages: HistoryMessage[] = [];
    list.forEach((m, i) => {
      if (m.role !== 'user') return;
      const answer = m.requestId
        ? list.find(a => a.role === 'assistant' && a.requestId === m.requestId)
        : (list[i + 1]?.role === 'assistant' ? list[i + 1] : undefined);
      if (!answer || !answer.content.trim()) return; // lỗi trước khi có chữ, hoặc đang chạy
      messages.push(m.hidden ? { role: 'user', content: m.content, hidden: true } : { role: 'user', content: m.content });
      messages.push({ role: 'assistant', content: answer.content });
    });
    if (messages.length) out.push({ threadKey, updatedAt: list.reduce((t, r) => (r.updatedAt > t ? r.updatedAt : t), ''), messages });
  }
  return out.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
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
  /** Lịch sử để nạp lại cho chính người đó (chỉ tin sau mốc reset). */
  loadHistory(q: HistoryQuery): Promise<HistoryThread[]>;
  /** Đóng một mục: đặt mốc reset, lần sau không nạp lại (tin nhắn vẫn giữ cho admin). */
  closeThread(q: HistoryQuery & { threadKey: string }): Promise<void>;
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
