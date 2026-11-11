/** Đọc yêu cầu nạp/đóng lịch sử hội thoại: ai đang hỏi + lá số nào. Chỉ dùng phía server. */
import { callerOf } from '@/lib/users/quota';
import { getPromptSet, PROMPT_VERSIONS, type InterpretationIntent } from '@/lib/prompts';
import type { HistoryQuery, HistoryThread } from './chat-store';
import { chartRef } from './persist-turn';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const MAX_THREAD_KEY = 100;

export type ParsedHistoryRequest =
  | { ok: true; query: HistoryQuery; body: Record<string, unknown> }
  | { ok: false; response: Response };

const fail = (error: string, status: number) => ({
  ok: false as const,
  response: Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } }),
});

export async function parseHistoryRequest(request: Request): Promise<ParsedHistoryRequest> {
  const caller = await callerOf(request);
  if (!caller) return fail('Chưa đăng nhập.', 401);
  let body: unknown;
  try { body = await request.json(); } catch { return fail('Dữ liệu yêu cầu không phải JSON hợp lệ.', 400); }
  if (!isObject(body) || (body.kind !== 'interpret' && body.kind !== 'heming') || !isObject(body.birthInfo)) {
    return fail('Thiếu dữ liệu lá số.', 400);
  }
  if (body.kind === 'heming' && !isObject(body.partnerBirthInfo)) return fail('Thiếu lá số người thứ hai.', 400);
  return {
    ok: true,
    body,
    query: {
      kind: body.kind,
      chartKey: chartRef(body.birthInfo).key,
      partnerKey: body.kind === 'heming' ? chartRef(body.partnerBirthInfo).key : null,
      userId: caller.kind === 'member' ? caller.userId : null,
    },
  };
}

export function validThreadKey(raw: unknown): raw is string {
  return typeof raw === 'string' && raw.length > 0 && raw.length <= MAX_THREAD_KEY && !/[\u0000-\u001f]/.test(raw);
}

/** Intent suy từ khóa mục (giống InsightPanel). */
function intentOfThread(key: string): InterpretationIntent {
  if (key.startsWith('palace:')) return { type: 'palace', branch: Number(key.slice(7)) };
  if (key.startsWith('sihua:')) {
    const [, view, starName, siHua] = key.split(':');
    return { type: 'sihua', view, starName, siHua };
  }
  return { type: 'topic', key };
}

/**
 * Đánh dấu ẩn câu hỏi tự động. Dữ liệu ghi trước khi có cột hidden không có cờ này, nên so thêm với
 * câu hỏi tự động của mọi version prompt.
 */
export function markAutoQuestions(kind: HistoryQuery['kind'], threads: HistoryThread[]): HistoryThread[] {
  return threads.map(t => {
    const auto = new Set(PROMPT_VERSIONS.map(v => {
      const p = getPromptSet(v.id);
      return kind === 'heming' ? p.defaultCompatibilityQuestion : p.initialInterpretationQuestion(intentOfThread(t.threadKey));
    }));
    return { ...t, messages: t.messages.map(m => (m.role === 'user' && !m.hidden && auto.has(m.content) ? { ...m, hidden: true } : m)) };
  });
}
