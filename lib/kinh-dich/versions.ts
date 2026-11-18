/**
 * Version prompt Kinh Dịch admin chọn được (tách riêng khỏi v1–v3 của Tử Vi, lưu ở khoá settings riêng).
 * - kd2 (mặc định): prompt lớn có cache + dữ kiện chốt, bài luận đầu có suy luận (call-options.ts).
 * - kd1: bản gốc trước kd2, gọi model như cũ (không suy luận, không session/quantization, không dòng trạng thái).
 */
import type { CallOptions } from '@/lib/ai/chat-stream';
import { withTimeout } from '@/lib/store/chat-store';
import type { Cast } from './core';
import type { KdMemoryItem } from './memory';
import { kinhDichCallOptions, type KinhDichTurn } from './call-options';
import * as kd1 from './prompt-kd1';
import * as kd2 from './prompt';

export const KINH_DICH_VERSION_KEY = 'active_kinh_dich_version';
export const DEFAULT_KINH_DICH_VERSION = 'kd2';

export const KINH_DICH_VERSIONS = [
  { id: 'kd2', label: 'kd2 · Luận sâu (mặc định)', description: 'Prompt lớn có cache, lời bình Trình Tử / Chu Hy, dữ kiện chốt do máy tính; bài luận đầu có suy luận và tự soát.' },
  { id: 'kd1', label: 'kd1 · Bản đầu', description: 'Prompt gọn theo khung 6 mục 【…】, không suy luận. Nhanh và rẻ hơn, luận cứng hơn.' },
] as const;

export type KinhDichVersionId = (typeof KINH_DICH_VERSIONS)[number]['id'];

export function isKinhDichVersionId(v: unknown): v is KinhDichVersionId {
  return typeof v === 'string' && KINH_DICH_VERSIONS.some(x => x.id === v);
}

/** Version đang chọn: lấy từ settings; không có, lạ, lỗi hay chậm → kd2. */
export async function resolveKinhDichVersion(store: { getSetting(key: string): Promise<string | null> }, timeoutMs = 1500): Promise<KinhDichVersionId> {
  try {
    const v = await withTimeout(store.getSetting(KINH_DICH_VERSION_KEY), timeoutMs);
    if (isKinhDichVersionId(v)) return v;
  } catch (error) {
    console.error('resolveKinhDichVersion failed:', error instanceof Error ? error.message : 'unknown error');
  }
  return DEFAULT_KINH_DICH_VERSION;
}

export interface ReadingInputs { followUp?: boolean; castAt?: Date; role?: kd2.AskerRole; selfCheck?: boolean }

export interface KinhDichPromptSet {
  id: KinhDichVersionId;
  prepareVersion: string;
  readingVersion: string;
  buildPreparePrompt(memory: KdMemoryItem[], question?: string): string;
  buildReadingPrompt(cast: Cast, question: string, memory: KdMemoryItem[], opts?: ReadingInputs): string;
  /** Tuỳ chọn gọi model cho lượt này; kd1 = {} (như trước kd2). */
  callOptions(turn: KinhDichTurn, env?: Record<string, string | undefined>): Partial<CallOptions>;
  /** Có thêm danh sách tự soát khi suy luận không (chỉ kd2). */
  supportsSelfCheck: boolean;
}

const SETS: Record<KinhDichVersionId, KinhDichPromptSet> = {
  kd2: {
    id: 'kd2',
    prepareVersion: kd2.PREPARE_VERSION,
    readingVersion: kd2.READING_VERSION,
    buildPreparePrompt: kd2.buildPreparePrompt,
    buildReadingPrompt: (cast, question, memory, opts = {}) => kd2.buildReadingPrompt(cast, question, memory, opts),
    callOptions: (turn, env = process.env) => kinhDichCallOptions(env, turn),
    supportsSelfCheck: true,
  },
  kd1: {
    id: 'kd1',
    prepareVersion: kd1.PREPARE_VERSION,
    readingVersion: kd1.READING_VERSION,
    buildPreparePrompt: kd1.buildPreparePrompt,
    buildReadingPrompt: (cast, question, memory, opts = {}) => kd1.buildReadingPrompt(cast, question, memory, { followUp: opts.followUp }),
    callOptions: () => ({}),
    supportsSelfCheck: false,
  },
};

export function kinhDichPromptSet(id: KinhDichVersionId): KinhDichPromptSet {
  return SETS[id];
}
