/**
 * Kinh Dịch: một lần gieo = một hội thoại. Giai đoạn do trạng thái ĐÃ LƯU quyết định (không tin client):
 *   chưa có castId           → mở lần gieo (trừ KINH_DICH_COST = 3 lượt), làm rõ câu hỏi (AI có thể hỏi lại bằng thẻ)
 *   chưa gieo, không lines   → tiếp tục làm rõ (miễn phí, tối đa MAX_PREPARE_TURNS lượt AI)
 *   chưa gieo, có lines      → lưu quẻ (một lần) rồi luận (miễn phí)
 *   đã gieo, chưa có bài luận → gửi lại lines = luận lại (miễn phí; lần trước lỗi/hết token trước khi có chữ)
 *   đã gieo                  → hỏi tiếp (trừ lượt; trả lời thẻ hỏi thì miễn phí); lines trong body bị bỏ qua
 * Store tắt (không DB): không có trạng thái → giai đoạn suy từ body, mỗi lượt trừ như thường, không lưu.
 */
import { askToPlainText, MAX_CONSECUTIVE_ASKS, trailingAsks } from '@/lib/ai/ask-user';
import { currentModel, jsonError, streamChatResponse, type ChatStreamMessage } from '@/lib/ai/chat-stream';
import { kinhDichCallOptions, reasoningOn, reasoningPolicy, type KinhDichTurn } from '@/lib/kinh-dich/call-options';
import { computeCast, parseLines } from '@/lib/kinh-dich/core';
import { loadKinhDichMemory } from '@/lib/kinh-dich/memory';
import { askerRoleFrom, buildPreparePrompt, buildReadingPrompt, PREPARE_VERSION, READING_QUESTION, READING_VERSION } from '@/lib/kinh-dich/prompt';
import { createHanStripper } from '@/lib/kinh-dich/strip-han';
import { getKinhDichStore, MAX_QUESTION_CHARS, type KinhDichStore, type Owner } from '@/lib/kinh-dich/store';
import { beginTurnWith } from '@/lib/store/persist-turn';
import { callerOf, chargeChat, refundingOnFinish, withQuotaHeader, type Quota } from '@/lib/users/quota';

export const runtime = 'nodejs';

/** Mỗi câu hỏi Kinh Dịch (mở lần gieo / hỏi tiếp) trừ 3 lượt vì prompt luận dài; làm rõ và bài luận đầu không trừ thêm. */
export const KINH_DICH_COST = 3;
/** Số lượt AI tối đa trước khi gieo (làm rõ câu hỏi). */
export const MAX_PREPARE_TURNS = 4;
const MAX_MESSAGE_CHARS = 2000;
const MAX_HISTORY = 20;
const LIST_LIMIT = 50;
/** Trạng thái hiện cho người dùng trong lúc model suy luận (bài luận đầu có thể mất 20–40 giây mới có chữ). */
export const REASONING_STATUS = [
  'Đang xem thời của quẻ…',
  'Đang xét vị trí các hào…',
  'Đang đối chiếu lời Trình Tử, Chu Hy…',
  'Đang soát lại trước khi viết…',
] as const;

export const REASONING_STATUS_LATE = 'Sắp xong, đang viết…';

/** Bài luận đầu có suy luận có thể mất cả phút; để hàm chạy đủ lâu (Vercel Fluid Compute cho tới 300s). */
export const maxDuration = 300;

/** Lượt này có suy luận không (theo KINH_DICH_REASONING); prompt luận thêm danh sách tự soát khi có. */
const thinks = (turn: KinhDichTurn) => reasoningOn(reasoningPolicy(process.env.KINH_DICH_REASONING), turn);

interface ChatMessage { role: 'user' | 'assistant'; content: string }
type Charge = { ok: true; userId: string | null; quota: Quota | null; refund: () => Promise<void> };
const FREE: Charge = { ok: true, userId: null, quota: null, refund: async () => undefined };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function sanitize(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m): m is ChatMessage => isObject(m) && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim().length > 0)
    .map(m => ({ role: m.role, content: m.content.slice(0, 6000) }));
}

/** Giữ câu hỏi đầu (bối cảnh) + các tin gần nhất; thẻ hỏi đổi thành văn bản thường cho model. */
function forModel(messages: ChatMessage[]): ChatStreamMessage[] {
  const kept = messages.length > MAX_HISTORY ? [messages[0], ...messages.slice(-(MAX_HISTORY - 1))] : messages;
  return kept.map(m => ({ role: m.role, content: m.role === 'assistant' ? askToPlainText(m.content) : m.content }));
}

function validQuestion(text: string | undefined): string | null {
  const q = text?.trim() ?? '';
  return q && q.length <= MAX_QUESTION_CHARS ? q : null;
}

interface Turn {
  store: KinhDichStore;
  owner: Owner;
  castId: string | null;
  charge: Charge;
  systemPrompt: string;
  messages: ChatMessage[];
  /** Tin user của lượt này (để ghi lại); hidden = câu hỏi tự động. */
  question: string;
  hidden: boolean;
  version: string;
  askUser: boolean;
  /** Loại lượt: quyết định có bật suy luận không. */
  turn: KinhDichTurn;
}

async function run(request: Request, t: Turn): Promise<Response> {
  const persist = t.store.enabled && t.castId !== null;
  const castId = t.castId;
  const { onFinish } = await beginTurnWith(
    persist,
    () => t.store.recordTurnStart(t.owner, castId!, { question: t.question.slice(0, 6000), hidden: t.hidden, promptVersion: t.version, model: currentModel() }),
    (requestId, r) => t.store.recordTurnEnd(requestId, r),
  );
  const call = kinhDichCallOptions(process.env, t.turn);
  const response = await streamChatResponse(
    [{ role: 'system', content: t.systemPrompt }, ...forModel(t.messages)],
    request.signal,
    undefined,
    {
      ...call,
      ...(call.reasoning !== 'off' ? { reasoningStatus: REASONING_STATUS, reasoningStatusLate: REASONING_STATUS_LATE } : {}),
      askUser: t.askUser,
      // Lưới chặn cuối: chữ Hán lọt vào bài bị bỏ trước khi gửi / lưu.
      textFilter: createHanStripper,
      onFinish: refundingOnFinish(onFinish, t.charge.refund),
    },
  );
  try {
    if (castId) response.headers.set('X-Cast-Id', castId);
    response.headers.set('X-Prompt-Version', t.version);
  } catch { /* headers bất biến */ }
  return t.charge.quota ? withQuotaHeader(response, t.charge.quota) : response;
}

const storeFailed = (error: unknown) => {
  console.error('kinh-dich store failed:', error instanceof Error ? error.message : 'unknown error');
  return jsonError('Không đọc được dữ liệu lần gieo, vui lòng thử lại sau.', 503);
};

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Dữ liệu yêu cầu không phải JSON hợp lệ.', 400);
  }
  if (!isObject(body)) return jsonError('Dữ liệu yêu cầu không hợp lệ.', 400);

  const caller = await callerOf(request).catch(() => null);
  if (!caller) return jsonError('Chưa đăng nhập.', 401);
  const owner: Owner = caller.kind === 'member' ? caller.userId : null;
  const store = getKinhDichStore();
  const messages = sanitize(body.messages);
  const lastUser = [...messages].reverse().find(m => m.role === 'user')?.content.trim();

  // ── Store tắt: không có trạng thái ──
  if (!store.enabled) {
    const question = validQuestion(messages.find(m => m.role === 'user')?.content);
    if (!question) return jsonError(`Câu hỏi không được trống và tối đa ${MAX_QUESTION_CHARS} ký tự.`, 400);
    let systemPrompt: string;
    let history = messages;
    let askUser: boolean;
    let version = PREPARE_VERSION;
    let turn: KinhDichTurn = 'prepare';
    if (body.lines !== undefined) {
      const lines = parseLines(body.lines);
      if (!lines) return jsonError('Quẻ không hợp lệ: cần đúng 6 hào, mỗi hào 6–9.', 400);
      const followUp = messages.some(m => m.role === 'user' && m.content === READING_QUESTION);
      turn = followUp ? 'followup' : 'first';
      systemPrompt = buildReadingPrompt(computeCast(lines), question, [], { followUp, castAt: new Date(), role: askerRoleFrom(messages), selfCheck: thinks(turn) });
      if (!followUp) history = [...messages, { role: 'user', content: READING_QUESTION }];
      askUser = followUp && trailingAsks(history) < MAX_CONSECUTIVE_ASKS;
      version = READING_VERSION;
    } else {
      systemPrompt = buildPreparePrompt([], question);
      askUser = !messages.some(m => m.role === 'assistant');
    }
    const charge = await chargeChat(request, undefined, KINH_DICH_COST);
    if (!charge.ok) return charge.response;
    return run(request, { store, owner, castId: null, charge, systemPrompt, messages: history, question: history.at(-1)!.content, hidden: false, version, askUser, turn });
  }

  // ── Mở lần gieo mới ──
  if (body.castId === undefined || body.castId === null) {
    const question = validQuestion(lastUser);
    if (!question) return jsonError(`Câu hỏi không được trống và tối đa ${MAX_QUESTION_CHARS} ký tự.`, 400);
    const memory = await loadKinhDichMemory(store, owner, null);
    const systemPrompt = buildPreparePrompt(memory, question);
    const charge = await chargeChat(request, undefined, KINH_DICH_COST);
    if (!charge.ok) return charge.response;
    let castId: string;
    try {
      castId = (await store.createCast(owner, question)).castId;
    } catch (error) {
      await charge.refund();
      return storeFailed(error);
    }
    return run(request, {
      store, owner, castId, charge, systemPrompt, messages: [{ role: 'user', content: question }],
      question, hidden: false, version: PREPARE_VERSION, askUser: true, turn: 'prepare',
    });
  }

  if (typeof body.castId !== 'string') return jsonError('Không tìm thấy lần gieo này.', 404);
  const castId = body.castId;
  let cast;
  try {
    cast = await store.getCast(owner, castId);
  } catch (error) {
    return storeFailed(error);
  }
  if (!cast) return jsonError('Không tìm thấy lần gieo này.', 404);
  const history: ChatMessage[] = cast.messages.map(m => ({ role: m.role, content: m.content }));
  // Bài luận đầu đã có (cặp câu hỏi luận ẩn + trả lời có chữ; lượt lỗi/rỗng bị buildHistory bỏ cả cặp).
  const hasReading = cast.messages.some(m => m.role === 'user' && m.hidden && m.content === READING_QUESTION);

  // ── Chưa gieo, có lines: lưu quẻ rồi luận ──
  if (!cast.lines && body.lines !== undefined) {
    const lines = parseLines(body.lines);
    if (!lines) return jsonError('Quẻ không hợp lệ: cần đúng 6 hào, mỗi hào 6–9.', 400);
    const memory = await loadKinhDichMemory(store, owner, castId);
    // Cùng một mốc giờ: lưu làm castAt của lần gieo và dùng cho tiết khí trong prompt (câu hỏi tiếp đọc lại mốc này).
    const castAt = new Date();
    const systemPrompt = buildReadingPrompt(computeCast(lines), cast.question, memory, { castAt, role: askerRoleFrom(history), selfCheck: thinks('first') });
    let saved: boolean;
    try {
      saved = await store.saveLines(owner, castId, lines, castAt.toISOString());
    } catch (error) {
      return storeFailed(error);
    }
    if (!saved) return jsonError('Quẻ này đã được gieo rồi.', 409);
    return run(request, {
      store, owner, castId, charge: FREE, systemPrompt, messages: [...history, { role: 'user', content: READING_QUESTION }],
      question: READING_QUESTION, hidden: true, version: READING_VERSION, askUser: false, turn: 'first',
    });
  }

  // Đã có quẻ nhưng bài luận đầu thất bại (lỗi / suy luận hết token trước khi có chữ): gửi lại lines = luận lại
  // bằng quẻ ĐÃ LƯU (bỏ qua lines trong body), miễn phí như bài luận đầu.
  if (cast.lines && body.lines !== undefined && !lastUser && !hasReading) {
    const memory = await loadKinhDichMemory(store, owner, castId);
    const systemPrompt = buildReadingPrompt(computeCast(cast.lines), cast.question, memory, { castAt: new Date(cast.castAt ?? cast.createdAt), role: askerRoleFrom(history), selfCheck: thinks('first') });
    return run(request, {
      store, owner, castId, charge: FREE, systemPrompt, messages: [...history, { role: 'user', content: READING_QUESTION }],
      question: READING_QUESTION, hidden: true, version: READING_VERSION, askUser: false, turn: 'first',
    });
  }
  // Gieo lại một lần gieo đã có bài luận (không kèm câu hỏi tiếp): báo rõ thay vì "tin nhắn trống".
  if (cast.lines && body.lines !== undefined && !lastUser) return jsonError('Quẻ này đã được gieo rồi.', 409);
  if (!lastUser || lastUser.length > MAX_MESSAGE_CHARS) return jsonError(`Tin nhắn không được trống và tối đa ${MAX_MESSAGE_CHARS} ký tự.`, 400);
  const turnMessages: ChatMessage[] = [...history, { role: 'user', content: lastUser }];

  // ── Chưa gieo: tiếp tục làm rõ (miễn phí, có giới hạn) ──
  if (!cast.lines) {
    if (cast.assistantCount >= MAX_PREPARE_TURNS) return jsonError('Câu hỏi đã đủ rõ, hãy gieo quẻ.', 409);
    const memory = await loadKinhDichMemory(store, owner, castId);
    return run(request, {
      store, owner, castId, charge: FREE, systemPrompt: buildPreparePrompt(memory, cast.question), messages: turnMessages,
      // Làm rõ chỉ hỏi lại MỘT lần: đã có lượt trả lời của AI thì tắt tool hỏi, AI phải tóm tắt câu hỏi + dòng vai.
      question: lastUser, hidden: false, version: PREPARE_VERSION, askUser: !history.some(m => m.role === 'assistant'), turn: 'prepare',
    });
  }

  // ── Đã gieo: hỏi tiếp ──
  const memory = await loadKinhDichMemory(store, owner, castId);
  const systemPrompt = buildReadingPrompt(computeCast(cast.lines), cast.question, memory, { followUp: true, castAt: new Date(cast.castAt ?? cast.createdAt), role: askerRoleFrom(history), selfCheck: thinks('followup') });
  const free = body.answering === true && cast.lastAssistantStatus === 'asked';
  const charge = free ? FREE : await chargeChat(request, undefined, KINH_DICH_COST);
  if (!charge.ok) return charge.response;
  return run(request, {
    store, owner, castId, charge, systemPrompt, messages: turnMessages,
    question: lastUser, hidden: false, version: READING_VERSION, askUser: trailingAsks(turnMessages) < MAX_CONSECUTIVE_ASKS, turn: 'followup',
  });
}

export async function GET(request: Request) {
  const caller = await callerOf(request).catch(() => null);
  if (!caller) return jsonError('Chưa đăng nhập.', 401);
  const owner: Owner = caller.kind === 'member' ? caller.userId : null;
  const store = getKinhDichStore();
  const castId = new URL(request.url).searchParams.get('castId');
  try {
    if (castId) {
      const cast = await store.getCast(owner, castId);
      if (!cast) return jsonError('Không tìm thấy lần gieo này.', 404);
      return Response.json({ cast, reading: cast.lines ? computeCast(cast.lines) : null });
    }
    const casts = await store.listCasts(owner, LIST_LIMIT);
    return Response.json({
      casts: casts.map(c => {
        if (!c.lines) return c;
        const r = computeCast(c.lines);
        return { ...c, main: r.main.name, ...(r.changed ? { changed: r.changed.name } : {}) };
      }),
    });
  } catch (error) {
    return storeFailed(error);
  }
}
