/** Ghi một lượt hỏi AI: bắt đầu lượt trước khi stream, kết thúc lượt sau khi response xong (after()). */
import { after } from 'next/server';
import type { InterpretationIntent } from '@/lib/prompts';
import type { BirthInfo } from '@/lib/ziwei/types';
import { chartKey } from '@/lib/ziwei/chart-key';
import { withTimeout, type ChatStore, type TurnResult, type TurnStart } from './chat-store';

const MAX_THREAD_KEY = 100;
const MAX_QUESTION = 6000;

/** Chỉ giữ các trường birthInfo đã biết, đúng kiểu (birthInfo đến từ client). */
export function storableBirthInfo(b: unknown): Record<string, unknown> {
  const src = (typeof b === 'object' && b !== null ? b : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of ['year', 'month', 'day', 'hour', 'longitude', 'utcOffsetMinutes', 'lunarTimeZone'] as const) {
    if (typeof src[k] === 'number' && Number.isFinite(src[k])) out[k] = src[k];
  }
  for (const k of ['name', 'province', 'city'] as const) {
    if (typeof src[k] === 'string') out[k] = (src[k] as string).slice(0, 100);
  }
  if (src.gender === 'male' || src.gender === 'female') out.gender = src.gender;
  if (src.region === 'north' || src.region === 'south') out.region = src.region;
  if (src.twinMethod === 'huynh_de' || src.twinMethod === 'thien_di') out.twinMethod = src.twinMethod;
  return out;
}

export function chartRef(birthInfo: unknown): TurnStart['chart'] {
  const info = storableBirthInfo(birthInfo);
  return { key: chartKey(info as unknown as BirthInfo), birthInfo: info };
}

/** Khóa luồng chat: lấy threadKey client gửi nếu hợp lệ, không thì suy từ intent (giống InsightPanel). */
export function threadKeyFor(raw: unknown, intent: InterpretationIntent): string {
  if (typeof raw === 'string' && raw.length > 0 && raw.length <= MAX_THREAD_KEY && !/[\u0000-\u001f]/.test(raw)) return raw;
  if (intent.type === 'palace' && Number.isInteger(intent.branch)) return `palace:${intent.branch}`;
  if (intent.type === 'sihua') return `sihua:${intent.view ?? ''}:${intent.starName ?? ''}:${intent.siHua ?? ''}`.slice(0, MAX_THREAD_KEY);
  return String(intent.key ?? 'overview').slice(0, MAX_THREAD_KEY);
}

/** Chạy việc sau khi response kết thúc; ngoài request scope (test) thì chạy luôn. */
function runAfterResponse(task: () => Promise<void>): void {
  try {
    after(task);
  } catch {
    void task();
  }
}

/** Hạn chờ stream báo kết thúc / DB ghi lượt bắt đầu, để việc nền không treo tới hết thời gian function. */
const FINISH_DEADLINE_MS = 5 * 60_000;

/**
 * Ghi tin user + log pending (không chờ DB), trả về onFinish để truyền cho streamChatResponse.
 * Việc ghi chạy song song với stream; kết quả được ghi sau khi response xong (after()).
 * Mọi lỗi lưu trữ chỉ ghi console, không bao giờ chặn hay làm chậm câu trả lời.
 * Gọi hàm này SAU khi đã dựng xong prompt/tool (để lỗi dựng prompt không để lại lượt treo).
 */
export async function beginTurn(store: ChatStore, turn: TurnStart): Promise<{ onFinish: (r: TurnResult) => void }> {
  if (!store.enabled) return { onFinish: () => undefined };
  const startedAt = Date.now();
  const started = Promise.resolve()
    .then(() => store.recordTurnStart({ ...turn, question: turn.question.slice(0, MAX_QUESTION) }))
    .catch((error: unknown) => {
      console.error('recordTurnStart failed:', error instanceof Error ? error.message : 'unknown error');
      return null;
    });
  let result: TurnResult | undefined;
  let resolveDone!: () => void;
  const done = new Promise<void>(resolve => { resolveDone = resolve; });
  // Đăng ký ngay trong request scope; chờ stream kết thúc rồi mới ghi.
  runAfterResponse(async () => {
    try {
      await withTimeout(done, FINISH_DEADLINE_MS).catch(() => undefined);
      const start = await withTimeout(started, FINISH_DEADLINE_MS).catch(() => null);
      if (!start?.requestId) return;
      await store.recordTurnEnd(start.requestId, result ?? {
        text: '', status: 'error', error: 'stream không báo kết thúc', toolCalls: [], durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      console.error('recordTurnEnd failed:', error instanceof Error ? error.message : 'unknown error');
    }
  });
  return { onFinish: r => { result = r; resolveDone(); } };
}
