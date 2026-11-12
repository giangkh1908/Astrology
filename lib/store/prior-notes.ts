/**
 * Những điều người dùng đã tự gõ ở các mục chat khác của cùng tài khoản + lá số, để mọi mục đều hiểu hoàn cảnh.
 * Chỉ lấy câu người dùng gõ (không lấy câu trả lời AI, không lấy câu hỏi tự động). Chỉ dùng phía server.
 */
import type { PriorNote } from '@/lib/prompts';
import { TOPICS } from '@/lib/chat/slash-commands';
import { callerOf } from '@/lib/users/quota';
import { viPalace, viSiHua, viStar } from '@/lib/vn/terms';
import type { ZiweiChart } from '@/lib/ziwei/types';
import { withTimeout, type ChatStore, type HistoryQuery, type UserQuestion } from './chat-store';
import { autoQuestionsOf } from './history-request';
import { chartRef } from './persist-turn';

export const MAX_PRIOR_NOTES = 30;
export const MAX_PRIOR_CHARS = 4000;
const MAX_NOTE_CHARS = 500;
/** Đọc dư một chút để còn đủ câu sau khi bỏ mục hiện tại và câu tự động của dữ liệu cũ. */
const FETCH_LIMIT = 80;
const DEFAULT_TIMEOUT_MS = 1500;

/** Tên mục dễ đọc từ khóa mục (overview, palace:3, sihua:view:sao:hóa). */
export function threadLabel(threadKey: string, chart: ZiweiChart): string {
  const topic = TOPICS.find(t => t.key === threadKey);
  if (topic) return topic.label;
  if (threadKey.startsWith('palace:')) {
    const branch = Number(threadKey.slice(7));
    const palace = chart.palaces.find(p => p.branch === branch);
    return palace ? `Cung ${viPalace(palace.name)}` : 'Một cung';
  }
  if (threadKey.startsWith('sihua:')) {
    const [, , starName, siHua] = threadKey.split(':');
    return `Tứ hóa ${viStar(starName ?? '')} ${viSiHua(siHua ?? '')}`.trim();
  }
  return threadKey;
}

const vnDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(d);
};

/**
 * questions: mới nhất trước (như loadUserQuestions). Bỏ mục excludeThreadKey và câu hỏi tự động,
 * giữ các câu mới nhất trong giới hạn số câu/ký tự, trả theo thứ tự cũ → mới.
 */
export function collectPriorNotes(
  questions: UserQuestion[],
  opts: { kind?: HistoryQuery['kind']; excludeThreadKey?: string; label: (threadKey: string) => string },
): PriorNote[] {
  const picked: PriorNote[] = [];
  let chars = 0;
  for (const q of questions) {
    if (picked.length >= MAX_PRIOR_NOTES) break;
    const text = q.content.trim();
    if (!text || q.threadKey === opts.excludeThreadKey || autoQuestionsOf(opts.kind ?? 'interpret', q.threadKey).has(q.content)) continue;
    const note = text.slice(0, MAX_NOTE_CHARS);
    chars += note.length;
    if (chars > MAX_PRIOR_CHARS) break;
    picked.push({ mục: opts.label(q.threadKey), ngày: vnDate(q.createdAt), lời_kể: note });
  }
  return picked.reverse();
}

/** Đọc rồi gom; store tắt, lỗi hoặc chậm quá timeoutMs → rỗng (không bao giờ chặn chat). */
export async function loadPriorNotes(
  store: ChatStore,
  query: HistoryQuery,
  opts: { excludeThreadKey?: string; label: (threadKey: string) => string; timeoutMs?: number },
): Promise<PriorNote[]> {
  if (!store.enabled) return [];
  try {
    const questions = await withTimeout(store.loadUserQuestions(query, FETCH_LIMIT), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    return collectPriorNotes(questions, { ...opts, kind: query.kind });
  } catch (error) {
    console.error('loadPriorNotes failed:', error instanceof Error ? error.message : 'unknown error');
    return [];
  }
}

/**
 * Lời người đang đăng nhập đã kể ở các mục /chart của lá số này (trừ excludeThreadKey).
 * Chưa đăng nhập → rỗng (route sẽ chặn ở bước trừ lượt).
 */
export async function priorNotesOf(request: Request, store: ChatStore, chart: ZiweiChart, excludeThreadKey?: string): Promise<PriorNote[]> {
  const caller = await callerOf(request).catch(() => null);
  if (!caller) return [];
  return loadPriorNotes(store, {
    kind: 'interpret',
    chartKey: chartRef(chart.birthInfo).key,
    partnerKey: null,
    userId: caller.kind === 'member' ? caller.userId : null,
  }, { excludeThreadKey, label: key => threadLabel(key, chart) });
}
