/**
 * Danh sách version prompt. Thêm version mới: tạo thư mục vN/ xuất một PromptSet, thêm vào PROMPT_VERSIONS và SETS.
 * Version đang chạy chọn ở portal /admin (lưu trong DB); không có/lỗi thì dùng DEFAULT_PROMPT_VERSION hoặc v2.
 */
import type { PromptSet } from './shared';
import { promptSetV1 } from './v1';
import { promptSetV2 } from './v2';
import { promptSetV3 } from './v3';

export type { CompatibilityNotes, InterpretationIntent, InterpretationTimeContext, PriorNote, PromptSet } from './shared';
export { chartFacts } from './shared';

export type PromptVersionId = 'v1' | 'v2' | 'v3';

export const PROMPT_VERSIONS: readonly { id: PromptVersionId; label: string; description: string }[] = [
  { id: 'v1', label: 'v1 – nêu tên sao làm căn cứ', description: 'Trả lời cá nhân hóa bằng tên sao/cung cụ thể, căn cứ trình bày theo tầng sao và tứ hóa.' },
  { id: 'v2', label: 'v2 – nói theo cung, kết luận chi tiết', description: 'Không nêu tên sao; căn cứ tóm 1–2 câu theo tam phương tứ chính bằng tên cung; kết luận chi tiết theo giai đoạn, nên làm và nên tránh.' },
  { id: 'v3', label: 'v3 – hỏi lại trước, luận 3 tháng tới', description: 'Như v2, nhưng hỏi lại người dùng bằng thẻ câu hỏi TRƯỚC khi luận khi thiếu hoàn cảnh; luận khung 3 tháng âm lịch từng tháng một, có nút chuyển khung.' },
];

const SETS: Record<PromptVersionId, PromptSet> = { v1: promptSetV1, v2: promptSetV2, v3: promptSetV3 };

export function isPromptVersionId(value: unknown): value is PromptVersionId {
  return typeof value === 'string' && Object.hasOwn(SETS, value);
}

export function getPromptSet(id: PromptVersionId): PromptSet {
  return SETS[id];
}

export function defaultPromptVersion(env: Record<string, string | undefined> = process.env): PromptVersionId {
  const v = env.DEFAULT_PROMPT_VERSION?.trim();
  return isPromptVersionId(v) ? v : 'v2';
}
