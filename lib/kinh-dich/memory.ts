/**
 * Nhánh memory riêng của Kinh Dịch: CHỈ những gì người dùng đã hỏi / tự kể ở các lần gieo Kinh Dịch trước
 * của chính tài khoản đó. Không đọc gì bên Tử Vi (một tài khoản có thể xem lá số của nhiều người).
 * Không lấy câu trả lời của AI, không lấy câu hỏi ẩn. Chỉ dùng phía server.
 */
import { withTimeout } from '@/lib/store/chat-store';
import { computeCast } from './core';
import type { CastSummary, KinhDichStore, MemoryNote, Owner } from './store';

export const MAX_MEMORY_ITEMS = 30;
export const MAX_MEMORY_CHARS = 4000;
const MAX_ITEM_CHARS = 500;
/** Đọc dư để còn đủ mục sau khi gom. */
const FETCH_LIMIT = 80;
const DEFAULT_TIMEOUT_MS = 1500;

export interface KdMemoryItem { ngày: string; loại: 'quẻ đã gieo' | 'lời kể'; nội_dung: string }

const vnDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(d);
};

function castLine(c: CastSummary): string {
  if (!c.lines) return `Hỏi "${c.question}" (chưa gieo)`;
  const r = computeCast(c.lines);
  return `Hỏi "${c.question}" → quẻ ${r.main.name} (${r.main.number})${r.changed ? `, biến ${r.changed.name} (${r.changed.number})` : ', không có hào động'}`;
}

/**
 * casts/notes: mới nhất trước (như loadMemoryRows). Trộn theo thời điểm, giữ các mục mới nhất trong giới hạn
 * số mục / ký tự, trả theo thứ tự cũ → mới.
 */
export function collectMemory(rows: { casts: CastSummary[]; notes: MemoryNote[] }): KdMemoryItem[] {
  const questionOf = new Map(rows.casts.map(c => [c.castId, c.question.trim()]));
  const all = [
    ...rows.casts.map(c => ({ at: c.createdAt, loại: 'quẻ đã gieo' as const, text: castLine(c) })),
    ...rows.notes
      .filter(n => n.content.trim() !== questionOf.get(n.castId))
      .map(n => ({ at: n.createdAt, loại: 'lời kể' as const, text: n.content.trim() })),
  ].filter(x => x.text).sort((a, b) => b.at.localeCompare(a.at));
  const picked: KdMemoryItem[] = [];
  let chars = 0;
  for (const x of all) {
    if (picked.length >= MAX_MEMORY_ITEMS) break;
    const text = x.text.slice(0, MAX_ITEM_CHARS);
    chars += text.length;
    if (chars > MAX_MEMORY_CHARS) break;
    picked.push({ ngày: vnDate(x.at), loại: x.loại, nội_dung: text });
  }
  return picked.reverse();
}

/** Đọc rồi gom; store tắt, lỗi hoặc chậm quá timeoutMs → rỗng (không bao giờ chặn chat). */
export async function loadKinhDichMemory(store: KinhDichStore, owner: Owner, excludeCastId: string | null, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<KdMemoryItem[]> {
  if (!store.enabled) return [];
  try {
    return collectMemory(await withTimeout(store.loadMemoryRows(owner, excludeCastId, FETCH_LIMIT), timeoutMs));
  } catch (error) {
    console.error('loadKinhDichMemory failed:', error instanceof Error ? error.message : 'unknown error');
    return [];
  }
}
