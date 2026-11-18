/**
 * Tuỳ chọn gọi model cho route Kinh Dịch (prompt hệ thống lớn, cần trúng prompt cache).
 * Mọi biến môi trường của phần này chỉ đọc ở đây:
 *   KINH_DICH_REASONING       'first' | 'off' | 'all'  (mặc định 'first'; 'low' cũ = 'all')
 *                             first = chỉ bài luận đầu của mỗi lần gieo có suy luận (low) để tự soát trước khi viết;
 *                             câu hỏi tiếp và bước làm rõ luôn tắt cho nhanh. all = cả câu hỏi tiếp. off = tắt hết.
 *   KINH_DICH_PROVIDER_QUANT  danh sách quantization, phân cách bằng dấu phẩy (mặc định 'fp8,bf16');
 *                             '' hoặc 'any' = không lọc.
 * Lý do (tài liệu OpenRouter, xem chú thích CallOptions trong lib/ai/chat-stream.ts):
 * - `session_id` cố định → sticky routing ngay từ lượt đầu, cùng nhà cung cấp nên cache prompt còn nóng
 *   (hết hạn sau ~60 phút không dùng). Không đặt `provider.order` vì sẽ tắt sticky routing.
 * - Lọc quantization để tránh endpoint fp4 rẻ nhất (rủi ro chất lượng).
 * - Bật suy luận thì cần max_tokens lớn hơn vì token suy luận tính vào giới hạn đầu ra.
 */
import type { CallOptions } from '@/lib/ai/chat-stream';

export const KINH_DICH_SESSION_ID = 'kinh-dich-v2';

/** Giá trị quantization OpenRouter chấp nhận (https://openrouter.ai/docs/features/provider-routing). */
const KNOWN_QUANTS = new Set(['int4', 'int8', 'fp4', 'mxfp4', 'nvfp4', 'fp6', 'fp8', 'mxfp8', 'fp16', 'bf16', 'fp32', 'unknown']);
const DEFAULT_QUANTS = 'fp8,bf16';
/** Tiếng Việt tốn token; bài luận đầu ~450–900 từ. */
const MAX_TOKENS_OFF = 4000;
const MAX_TOKENS_REASONING = 20000;

export type ReasoningPolicy = 'first' | 'off' | 'all';
/** Loại lượt gọi: làm rõ câu hỏi, bài luận đầu, câu hỏi tiếp. */
export type KinhDichTurn = 'prepare' | 'first' | 'followup';

export function reasoningPolicy(raw: string | undefined): ReasoningPolicy {
  const v = raw?.trim().toLowerCase();
  if (v === 'off') return 'off';
  if (v === 'all' || v === 'low') return 'all';
  return 'first';
}

/** Lượt này có bật suy luận không (làm rõ câu hỏi thì không bao giờ). */
export function reasoningOn(policy: ReasoningPolicy, turn: KinhDichTurn): boolean {
  if (turn === 'prepare' || policy === 'off') return false;
  return policy === 'all' || turn === 'first';
}

function parseQuants(raw: string | undefined): string[] {
  const value = (raw ?? DEFAULT_QUANTS).trim().toLowerCase();
  if (!value || value === 'any') return [];
  return [...new Set(value.split(',').map(q => q.trim()).filter(q => KNOWN_QUANTS.has(q)))];
}

export function kinhDichCallOptions(env: Record<string, string | undefined> = process.env, turn: KinhDichTurn = 'followup'): Required<Pick<CallOptions, 'sessionId' | 'reasoning' | 'maxTokens'>> & Pick<CallOptions, 'provider' | 'temperature'> {
  const reasoning = reasoningOn(reasoningPolicy(env.KINH_DICH_REASONING), turn) ? 'low' as const : 'off' as const;
  const quantizations = parseQuants(env.KINH_DICH_PROVIDER_QUANT);
  return {
    sessionId: KINH_DICH_SESSION_ID,
    ...(quantizations.length ? { provider: { quantizations } } : {}),
    reasoning,
    maxTokens: reasoning === 'off' ? MAX_TOKENS_OFF : MAX_TOKENS_REASONING,
  };
}
