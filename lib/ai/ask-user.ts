/**
 * Tool "hỏi lại người dùng" (prompt v3): AI hỏi TRƯỚC khi luận khi thiếu bối cảnh làm đổi hẳn kết luận.
 * Thuần, không I/O. Thẻ câu hỏi được lưu ngay trong nội dung tin assistant bằng khối `<!--ask:{json}-->`
 * để lịch sử nạp lại vẽ được thẻ; khi gửi lịch sử cho model thì đổi khối đó thành văn bản thường.
 */

export const ASK_TOOL_NAME = 'hoi_nguoi_dung';
export const MAX_CONSECUTIVE_ASKS = 2;
export const ANSWER_PREFIX = 'Trả lời câu hỏi:';
export const SKIP_ANSWER = 'Bỏ qua câu hỏi, hãy luận theo dữ kiện hiện có.';

const DEFAULT_LEAD = 'Để luận đúng chuyện của bạn, cho mình hỏi thêm:';
const MAX_QUESTIONS = 3;
const MAX_OPTIONS = 4;
const MIN_OPTIONS = 2;
const MAX_LABEL = 12;
const MAX_TEXT = 200;
const MARKER_RE = /\n*<!--ask:([\s\S]*)-->\s*$/;

export interface AskOption { tieu_de: string; giai_thich?: string }
export interface AskQuestion { nhan: string; noi_dung: string; lua_chon: AskOption[]; chon_nhieu?: boolean }
export interface AskPayload { loi_dan: string; cau_hoi: AskQuestion[] }

export const askToolDefinition = {
  name: ASK_TOOL_NAME,
  description:
    'Hỏi lại người dùng TRƯỚC khi luận, chỉ khi thiếu một hoàn cảnh làm thay đổi hẳn kết luận (đã lập gia đình chưa, đang đi làm hay kinh doanh, việc cụ thể đang tính…) '
    + 'và điều đó chưa có trong cuộc trò chuyện hay lời kể. Gọi tool này thì KHÔNG viết bài luận; người dùng trả lời xong mới luận. '
    + 'Tối đa 3 câu, mỗi câu 2–4 lựa chọn ngắn (lựa chọn nên dùng nhất đặt đầu). Ô tự nhập luôn có sẵn, không cần thêm lựa chọn "Khác".',
  parameters: {
    type: 'object',
    properties: {
      loi_dan: { type: 'string', description: 'Một câu dẫn ngắn, ví dụ "Để luận đúng chuyện của bạn, cho mình hỏi thêm:"' },
      cau_hoi: {
        type: 'array',
        minItems: 1,
        maxItems: MAX_QUESTIONS,
        items: {
          type: 'object',
          properties: {
            nhan: { type: 'string', description: 'Nhãn tab rất ngắn (≤ 12 ký tự), ví dụ "Hôn nhân"' },
            noi_dung: { type: 'string', description: 'Câu hỏi đầy đủ, kết thúc bằng dấu ?' },
            lua_chon: {
              type: 'array',
              minItems: MIN_OPTIONS,
              maxItems: MAX_OPTIONS,
              items: {
                type: 'object',
                properties: {
                  tieu_de: { type: 'string', description: 'Lựa chọn ngắn gọn' },
                  giai_thich: { type: 'string', description: 'Một dòng giải thích (tùy chọn)' },
                },
                required: ['tieu_de'],
              },
            },
            chon_nhieu: { type: 'boolean', description: 'true nếu được chọn nhiều đáp án' },
          },
          required: ['nhan', 'noi_dung', 'lua_chon'],
        },
      },
    },
    required: ['cau_hoi'],
  } as Record<string, unknown>,
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function cleanQuestion(raw: unknown): AskQuestion | null {
  if (!isObject(raw)) return null;
  const noi_dung = str(raw.noi_dung, MAX_TEXT);
  const options = (Array.isArray(raw.lua_chon) ? raw.lua_chon : [])
    .map(o => {
      if (typeof o === 'string') return { tieu_de: str(o, MAX_TEXT) };
      if (!isObject(o)) return null;
      const giai_thich = str(o.giai_thich, MAX_TEXT);
      return { tieu_de: str(o.tieu_de, MAX_TEXT), ...(giai_thich ? { giai_thich } : {}) };
    })
    .filter((o): o is AskOption => !!o && !!o.tieu_de)
    .slice(0, MAX_OPTIONS);
  if (!noi_dung || options.length < MIN_OPTIONS) return null;
  const nhan = str(raw.nhan, MAX_LABEL) || noi_dung.slice(0, MAX_LABEL);
  return { nhan, noi_dung, lua_chon: options, ...(raw.chon_nhieu === true ? { chon_nhieu: true } : {}) };
}

/** Tham số model gửi → payload đã cắt về giới hạn; không dùng được thì null. */
export function parseAskArgs(raw: string): AskPayload | null {
  let parsed: unknown;
  try { parsed = JSON.parse(raw || '{}'); } catch { return null; }
  if (!isObject(parsed) || !Array.isArray(parsed.cau_hoi)) return null;
  const cau_hoi = parsed.cau_hoi.map(cleanQuestion).filter((q): q is AskQuestion => !!q).slice(0, MAX_QUESTIONS);
  if (!cau_hoi.length) return null;
  return { loi_dan: str(parsed.loi_dan, MAX_TEXT) || DEFAULT_LEAD, cau_hoi };
}

export function encodeAsk(p: AskPayload): string {
  // `--` trong JSON có thể đóng sớm comment HTML: thoát thành \u002d.
  return `${p.loi_dan}\n\n<!--ask:${JSON.stringify(p).replace(/-/g, '\\u002d')}-->`;
}

/** Tách thẻ hỏi khỏi nội dung tin; khối hỏng thì coi như không có thẻ. */
export function extractAsk(content: string): { text: string; ask: AskPayload | null } {
  const m = content.match(MARKER_RE);
  if (!m) return { text: content, ask: null };
  const ask = parseAskArgs(m[1]);
  if (!ask) return { text: content, ask: null };
  return { text: content.slice(0, m.index).trimEnd(), ask };
}

/** Đổi thẻ hỏi thành văn bản thường để model hiểu ngữ cảnh ở lượt sau. */
export function askToPlainText(content: string): string {
  const { text, ask } = extractAsk(content);
  if (!ask) return content;
  const lines = ask.cau_hoi.map((q, i) => `${i + 1}) ${q.noi_dung} (Lựa chọn: ${q.lua_chon.map(o => o.tieu_de).join(' / ')})`);
  return `${text}\nMình đã hỏi:\n${lines.join('\n')}`;
}

/** Câu trả lời của người dùng cho một thẻ; null = bỏ qua câu đó. */
export function formatAnswers(ask: AskPayload, answers: Array<string[] | null>): string {
  const lines = ask.cau_hoi.map((q, i) => {
    const a = answers[i]?.map(s => s.trim()).filter(Boolean);
    return `- ${q.nhan} — ${q.noi_dung}: ${a?.length ? a.join(', ') : 'bỏ qua'}`;
  });
  return `${ANSWER_PREFIX}\n${lines.join('\n')}`;
}

/**
 * Đọc lại đáp án từng câu từ tin trả lời (đối ngược của formatAnswers).
 * Hiểu cả định dạng mới "- nhãn — nội dung: đáp án" lẫn định dạng cũ "- nhãn: đáp án" đã lưu trong lịch sử.
 */
export function parseAnswers(ask: AskPayload, answered: string): string[] {
  if (answered.trim() === SKIP_ANSWER) return ask.cau_hoi.map(() => 'bỏ qua');
  if (!answered.startsWith(ANSWER_PREFIX)) return ask.cau_hoi.map(() => 'bỏ qua (bạn đã nhắn trực tiếp)');
  const lines = answered.split('\n').slice(1).map(l => l.replace(/^-\s*/, ''));
  return ask.cau_hoi.map((q, i) => {
    const line = lines[i] ?? '';
    const next = `${q.nhan} — ${q.noi_dung}:`;
    const legacy = `${q.nhan}:`;
    if (line.startsWith(next)) return line.slice(next.length).trim() || 'bỏ qua';
    if (line.startsWith(legacy)) return line.slice(legacy.length).trim() || 'bỏ qua';
    return line || 'bỏ qua';
  });
}

/** Số tin assistant có thẻ hỏi liên tiếp tính từ cuối lịch sử (bỏ qua tin user xen giữa). */
export function trailingAsks(messages: { role: string; content: string }[]): number {
  let count = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'assistant') continue;
    if (!extractAsk(m.content).ask) break;
    count++;
  }
  return count;
}

/** Version nào, ở lượt nào thì AI được dùng tool hỏi lại. v4 cho hỏi cả khi mở mục Kiểm chứng (câu hỏi tự động). */
export function askUserAllowed(
  version: string,
  opts: { hiddenQuestion: boolean; topicKey?: string; trailing: number },
): boolean {
  if (opts.trailing >= MAX_CONSECUTIVE_ASKS) return false;
  if (version === 'v3') return !opts.hiddenQuestion;
  if (version === 'v4') return !opts.hiddenQuestion || opts.topicKey === 'kiem_chung';
  return false;
}
