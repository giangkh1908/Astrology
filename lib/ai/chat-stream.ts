/**
 * Gọi dịch vụ chat AI (hiện là OpenRouter) và trả về Response SSE theo định dạng nội bộ:
 *   data: {"delta":{"text":"..."}}   — chữ của câu trả lời
 *   data: {"status":"..."}           — AI đang dùng tool (hiển thị cho người dùng)
 *   data: {"ask":{...}}              — AI hỏi lại người dùng trước khi luận (prompt v3); lượt kết thúc ngay sau đó
 *   data: {"error":"..."}            — đứt giữa chừng: phần chữ đã gửi vẫn giữ, client báo gián đoạn
 *   data: [DONE]
 * Có `tools` thì chạy vòng lặp agent: model tự gọi tool, kết quả được gửi lại, lặp tới khi model trả lời.
 */
import type { ChartTool } from './tools/ziwei-tools';
import { ASK_TOOL_NAME, askToolDefinition, encodeAsk, parseAskArgs } from './ask-user';
import type { ToolCallLog, TurnResult } from '@/lib/store/chat-store';

export interface ChatStreamMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Số vòng gọi tool tối đa; vòng cuối bắt buộc trả lời (không gửi tool) để kiểm soát chi phí. */
const MAX_TOOL_ROUNDS = 4;
/** Số ký tự đầu mỗi vòng được giữ tạm để lọc lời dạo đầu trước tool call. */
const PREAMBLE_HOLD_CHARS = 200;
/** Thời gian tối đa cho một lượt gọi nhà cung cấp (kết nối + đọc hết stream). */
const ROUND_TIMEOUT_MS = 90_000;
/** Lượt có suy luận (vd bài luận Kinh Dịch đầu, max_tokens 20000) có thể nghĩ 40–60 giây rồi mới viết: cho dài hơn. */
const REASONING_ROUND_TIMEOUT_MS = 240_000;
/** Thử lại khi lỗi mạng / 429 / 5xx trước khi có dữ liệu, cách nhau RETRY_DELAY_MS * lần. */
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 700;
/** Giới hạn độ dài kết quả một tool gửi lại cho model. */
const MAX_TOOL_RESULT_CHARS = 30_000;

type WireMessage = Record<string, unknown>;
type ToolDef = { name: string; description: string; parameters: Record<string, unknown> };
interface ToolCall { id: string; type: 'function'; function: { name: string; arguments: string } }

/** Model đang gửi lên nhà cung cấp (dùng cho log). */
export function currentModel(): string {
  return process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4.1-flash';
}

interface Usage {
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  /** usage.prompt_tokens_details.cached_tokens — token đọc từ cache (cache hit). */
  cachedTokens?: number;
  /** usage.prompt_tokens_details.cache_write_tokens — token ghi vào cache. */
  cacheWriteTokens?: number;
  /** usage.completion_tokens_details.reasoning_tokens. */
  reasoningTokens?: number;
}

/**
 * Tuỳ chọn gọi model (opt-in). Không truyền thì body y như cũ.
 * Tên trường theo tài liệu OpenRouter (đối chiếu 2026-11):
 * - `session_id` (top-level body, ≤256 ký tự): sticky routing để trúng prompt cache —
 *   https://openrouter.ai/docs/features/prompt-caching (header tương đương `x-session-id`;
 *   đặt `provider.order` thì sticky routing bị tắt, thứ tự tự chọn được ưu tiên).
 * - `provider.quantizations` / `provider.order` / `provider.allow_fallbacks` —
 *   https://openrouter.ai/docs/features/provider-routing
 * - `reasoning: { effort: 'low' | 'medium' }` hoặc `{ enabled: false }`; khi stream, suy luận
 *   nằm ở `choices[].delta.reasoning_details` (không phải `content`) —
 *   https://openrouter.ai/docs/use-cases/reasoning-tokens
 * - usage luôn có ở event cuối: `prompt_tokens_details.cached_tokens`, `cache_write_tokens`,
 *   `completion_tokens_details.reasoning_tokens`, `cost` —
 *   https://openrouter.ai/docs/use-cases/usage-accounting (`usage: { include: true }` nay là no-op,
 *   vẫn giữ để body mặc định không đổi).
 */
export interface CallOptions {
  sessionId?: string;
  provider?: { quantizations?: string[]; order?: string[]; allow_fallbacks?: boolean };
  reasoning?: 'off' | 'low' | 'medium';
  maxTokens?: number;
  temperature?: number;
}

const MAX_SESSION_ID_CHARS = 256;

/** Phần body thêm theo CallOptions; chỉ có trường nào được truyền. */
function callOptionFields(o: CallOptions): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (o.sessionId) out.session_id = o.sessionId.slice(0, MAX_SESSION_ID_CHARS);
  if (o.provider) {
    const p: Record<string, unknown> = {};
    if (o.provider.quantizations?.length) p.quantizations = o.provider.quantizations;
    if (o.provider.order?.length) p.order = o.provider.order;
    if (typeof o.provider.allow_fallbacks === 'boolean') p.allow_fallbacks = o.provider.allow_fallbacks;
    if (Object.keys(p).length) out.provider = p;
  }
  // 'off' giữ nguyên `reasoning: { enabled: false }` của body mặc định.
  if (o.reasoning === 'low' || o.reasoning === 'medium') out.reasoning = { effort: o.reasoning };
  if (typeof o.maxTokens === 'number' && Number.isFinite(o.maxTokens) && o.maxTokens > 0) out.max_tokens = Math.floor(o.maxTokens);
  if (typeof o.temperature === 'number' && Number.isFinite(o.temperature)) out.temperature = o.temperature;
  return out;
}

const optNum = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/** Đọc usage của OpenRouter (Chat Completions) sang dạng nội bộ. */
function parseUsage(u: Record<string, unknown>): Usage {
  const prompt = isObject(u.prompt_tokens_details) ? u.prompt_tokens_details : {};
  const completion = isObject(u.completion_tokens_details) ? u.completion_tokens_details : {};
  const cachedTokens = optNum(prompt.cached_tokens);
  const cacheWriteTokens = optNum(prompt.cache_write_tokens);
  const reasoningTokens = optNum(completion.reasoning_tokens);
  return {
    promptTokens: Number(u.prompt_tokens) || 0,
    completionTokens: Number(u.completion_tokens) || 0,
    costUsd: Number(u.cost) || 0,
    ...(cachedTokens !== undefined ? { cachedTokens } : {}),
    ...(cacheWriteTokens !== undefined ? { cacheWriteTokens } : {}),
    ...(reasoningTokens !== undefined ? { reasoningTokens } : {}),
  };
}

function sumUsage(a: Usage, b: Usage): Usage {
  const opt = (x?: number, y?: number) => (x === undefined && y === undefined ? undefined : (x ?? 0) + (y ?? 0));
  const cachedTokens = opt(a.cachedTokens, b.cachedTokens);
  const cacheWriteTokens = opt(a.cacheWriteTokens, b.cacheWriteTokens);
  const reasoningTokens = opt(a.reasoningTokens, b.reasoningTokens);
  return {
    promptTokens: a.promptTokens + b.promptTokens,
    completionTokens: a.completionTokens + b.completionTokens,
    costUsd: a.costUsd + b.costUsd,
    ...(cachedTokens !== undefined ? { cachedTokens } : {}),
    ...(cacheWriteTokens !== undefined ? { cacheWriteTokens } : {}),
    ...(reasoningTokens !== undefined ? { reasoningTokens } : {}),
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

class UpstreamError extends Error {
  constructor(message: string, readonly status?: number) { super(message); }
}

const sleep = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timer = setTimeout(resolve, ms);
  signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
});

/** Mở một lượt stream tới nhà cung cấp, tự thử lại lỗi tạm thời. Trả về body đã sẵn sàng đọc. */
async function openUpstream(apiKey: string, messages: WireMessage[], tools: ToolDef[] | undefined, signal: AbortSignal, call: CallOptions = {}) {
  const body = JSON.stringify({
    model: currentModel(),
    stream: true,
    // Kèm số token và chi phí ở event cuối của stream (để ghi log).
    usage: { include: true },
    // Tắt suy luận ẩn: chỉ `content` được chuyển tiếp, nếu để model "nghĩ" trước
    // thì người dùng phải chờ hết phần reasoning mới thấy chữ đầu tiên.
    reasoning: { enabled: false },
    messages,
    ...(tools?.length ? {
      tools: tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })),
      tool_choice: 'auto',
      parallel_tool_calls: true,
    } : {}),
    // Tuỳ chọn opt-in (session_id, provider, reasoning bật, max_tokens, temperature); rỗng nếu không truyền.
    ...callOptionFields(call),
  });
  let lastError: UpstreamError | undefined;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) await sleep(RETRY_DELAY_MS * (attempt - 1), signal);
    const roundSignal = AbortSignal.any([signal, AbortSignal.timeout(call.reasoning && call.reasoning !== 'off' ? REASONING_ROUND_TIMEOUT_MS : ROUND_TIMEOUT_MS)]);
    let res: Response;
    try {
      res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
          'X-Title': 'Purple Star Astrology',
        },
        body,
        signal: roundSignal,
      });
    } catch (error) {
      if (signal.aborted) throw error;
      lastError = new UpstreamError(error instanceof Error ? error.message : 'network error');
      continue;
    }
    if (res.ok && res.body) return { body: res.body, signal: roundSignal };
    await res.body?.cancel().catch(() => undefined);
    lastError = new UpstreamError(`HTTP ${res.status}`, res.status);
    if (res.status !== 429 && res.status < 500) break; // lỗi của yêu cầu: thử lại vô ích
  }
  throw lastError ?? new UpstreamError('unknown error');
}

/** Đọc một lượt SSE của nhà cung cấp: đẩy chữ ra ngay, gom tool_calls lại. */
async function readUpstream(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
  onText: (text: string) => void,
  onToolCall?: () => void,
  onUsage?: (usage: Usage) => void,
  onFinishReason?: (reason: string) => void,
): Promise<ToolCall[]> {
  const reader = body.getReader();
  // Hủy (người dùng bấm dừng / quá thời gian) thì ngắt đọc ngay, kể cả khi nguồn không tự đóng.
  const onAbort = () => { reader.cancel().catch(() => undefined); };
  signal.addEventListener('abort', onAbort, { once: true });
  const decoder = new TextDecoder();
  const calls: ToolCall[] = [];
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (!data || data === '[DONE]') continue;
        let event: { error?: unknown; usage?: unknown; choices?: Array<{ finish_reason?: unknown; delta?: { content?: unknown; tool_calls?: unknown } }> };
        try { event = JSON.parse(data); } catch { continue; }
        if (event.error) throw new UpstreamError('provider error event');
        if (isObject(event.usage)) onUsage?.(parseUsage(event.usage));
        // Chỉ `content` là chữ trả lời; `reasoning` / `reasoning_details` (khi bật suy luận) bị bỏ qua, không bao giờ gửi đi.
        const choice = event.choices?.[0];
        if (typeof choice?.finish_reason === 'string' && choice.finish_reason) onFinishReason?.(choice.finish_reason);
        const delta = choice?.delta;
        const content = delta?.content;
        const text = typeof content === 'string'
          ? content
          : Array.isArray(content)
            ? content.map(part => isObject(part) && typeof part.text === 'string' ? part.text : '').join('')
            : '';
        if (text) onText(text);
        if (Array.isArray(delta?.tool_calls)) {
          onToolCall?.();
          for (const part of delta.tool_calls as Array<Record<string, unknown>>) {
            const index = typeof part.index === 'number' ? part.index : calls.length;
            const fn = isObject(part.function) ? part.function : {};
            const call = calls[index] ??= { id: '', type: 'function', function: { name: '', arguments: '' } };
            if (typeof part.id === 'string') call.id = part.id;
            if (typeof fn.name === 'string') call.function.name += fn.name;
            if (typeof fn.arguments === 'string') call.function.arguments += fn.arguments;
          }
        }
      }
    }
  } finally {
    signal.removeEventListener('abort', onAbort);
    reader.releaseLock();
  }
  if (signal.aborted) throw signal.reason ?? new Error('aborted');
  return calls.filter(Boolean).map((c, i) => ({ ...c, id: c.id || `call_${i}` }));
}

function parseArgs(raw: string): Record<string, unknown> {
  try { const parsed = JSON.parse(raw || '{}'); return isObject(parsed) ? parsed : {}; } catch { return {}; }
}

/** Chạy tool; cùng tên + tham số trong một yêu cầu thì dùng lại kết quả. */
function runTool(tools: ChartTool[], call: ToolCall, cache: Map<string, string>): { status: string; content: string } {
  const tool = tools.find(t => t.name === call.function.name);
  const args = parseArgs(call.function.arguments);
  if (!tool) return { status: 'Đang tra cứu', content: JSON.stringify({ lỗi: `Không có công cụ ${call.function.name}` }) };
  const status = tool.status(args);
  const key = `${tool.name}:${JSON.stringify(args, Object.keys(args).sort())}`;
  const cached = cache.get(key);
  if (cached) return { status, content: cached };
  let content: string;
  try {
    content = JSON.stringify(tool.run(args));
    if (content.length > MAX_TOOL_RESULT_CHARS) content = `${content.slice(0, MAX_TOOL_RESULT_CHARS)}…(đã cắt bớt)`;
  } catch (error) {
    console.error(`Tool ${tool.name} failed:`, error instanceof Error ? error.message : 'unknown error');
    content = JSON.stringify({ lỗi: 'Không tính được dữ liệu này.' });
  }
  cache.set(key, content);
  return { status, content };
}

export interface StreamOptions {
  /** Gọi đúng một lần khi lượt kết thúc (xong, lỗi hoặc bị hủy) với toàn bộ chữ đã gửi cho client. */
  onFinish?: (result: TurnResult) => void;
  /** Cho model dùng tool hoi_nguoi_dung (prompt v3). */
  askUser?: boolean;
  /** Tuỳ chọn gọi model opt-in (xem CallOptions); không truyền thì body không đổi. */
  sessionId?: CallOptions['sessionId'];
  provider?: CallOptions['provider'];
  reasoning?: CallOptions['reasoning'];
  maxTokens?: CallOptions['maxTokens'];
  temperature?: CallOptions['temperature'];
  /**
   * Khi bật suy luận (model im lặng lâu trước chữ đầu): gửi lần lượt các dòng này dưới dạng `{status}`
   * theo hẹn giờ — dòng đầu ngay khi kết nối nhà cung cấp thành công, sau đó mỗi REASONING_STATUS_EVERY_MS;
   * hết danh sách thì giữ dòng cuối. Dừng khi có chữ đầu tiên / kết thúc / bị hủy.
   * Không phụ thuộc nhà cung cấp có stream mảnh suy luận hay không.
   */
  reasoningStatus?: readonly string[];
  /** Dòng gửi thêm khi đã nghĩ quá REASONING_STATUS_LATE_MS mà chưa có chữ (vd "Sắp xong, đang viết…"). */
  reasoningStatusLate?: string;
  /**
   * Bộ lọc chữ trả lời theo luồng (vd. Kinh Dịch bỏ chữ Hán): áp trước khi gửi client và trước khi lưu.
   * Tạo mới cho mỗi lượt; flush ở cuối lượt.
   */
  textFilter?: () => { push(chunk: string): string; flush(): string };
}

export const REASONING_STATUS_EVERY_MS = 6000;
/** Nghĩ lâu hơn chừng này mà chưa có chữ: gửi dòng trạng thái cuối (StreamOptions.reasoningStatusLate). */
export const REASONING_STATUS_LATE_MS = 30_000;

export interface StatusState { next: number; lateSent: boolean }
/**
 * Một nhịp hẹn giờ trạng thái (thuần, để test): xoay lần lượt các dòng rồi giữ dòng cuối (không gửi lại);
 * quá REASONING_STATUS_LATE_MS thì gửi dòng "late" một lần. stop = không còn gì để gửi nữa.
 */
export function statusTick(lines: readonly string[], late: string | undefined, st: StatusState, elapsedMs: number): { send?: string; stop: boolean } {
  if (st.lateSent) return { stop: true }; // đã báo "sắp xong" thì giữ nguyên dòng đó tới khi có chữ
  if (late && elapsedMs >= REASONING_STATUS_LATE_MS) { st.lateSent = true; return { send: late, stop: false }; }
  if (st.next < lines.length) return { send: lines[st.next++], stop: false };
  return { stop: !late };
}

/** Hết giới hạn token đầu ra (thường do suy luận ăn hết) mà chưa có chữ nào: coi là lỗi để hoàn lượt. */
export const TRUNCATED_EMPTY_ERROR = 'AI suy nghĩ quá lâu nên chưa kịp viết câu trả lời. Bạn thử hỏi lại nhé (lượt hỏi đã được hoàn).';

const ASK_ARGS_ERROR = JSON.stringify({ lỗi: 'Tham số câu hỏi không hợp lệ, hãy luận luôn theo dữ kiện hiện có.' });

export async function streamChatResponse(
  messages: ChatStreamMessage[],
  signal: AbortSignal,
  tools?: ChartTool[],
  options: StreamOptions = {},
): Promise<Response> {
  const startedAt = Date.now();
  const call: CallOptions = {
    sessionId: options.sessionId, provider: options.provider, reasoning: options.reasoning,
    maxTokens: options.maxTokens, temperature: options.temperature,
  };
  const optedIn = Object.keys(callOptionFields(call)).length > 0;
  let answer = '';
  let firstTokenMs: number | undefined;
  const toolCalls: ToolCallLog[] = [];
  let usage: Usage | undefined;
  let asked = false;
  let finished = false;
  const finish = (status: TurnResult['status'], error?: string) => {
    if (finished) return;
    finished = true;
    // Lượt có tuỳ chọn opt-in (vd. Kinh Dịch dùng prompt cache): in một dòng để theo dõi cache.
    // DB chưa có cột cached_tokens nên số cache chỉ nằm trong TurnResult + log server.
    if (optedIn && usage) {
      console.info(`ai usage: prompt=${usage.promptTokens} cached=${usage.cachedTokens ?? '-'} cacheWrite=${usage.cacheWriteTokens ?? '-'} completion=${usage.completionTokens} reasoning=${usage.reasoningTokens ?? '-'} cost=${usage.costUsd}`);
    }
    try {
      options.onFinish?.({
        text: answer, status, ...(error ? { error } : {}), ...(asked ? { asked: true } : {}), toolCalls, firstTokenMs, durationMs: Date.now() - startedAt,
        ...(usage ? { usage: { ...usage } } : {}),
      });
    } catch (e) {
      console.error('onFinish failed:', e instanceof Error ? e.message : 'unknown error');
    }
  };
  const addUsage = (u: Usage) => { usage = usage ? sumUsage(usage, u) : u; };

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    finish('error', 'missing API key');
    return jsonError('Chưa cấu hình OPENROUTER_API_KEY trong .env.local.', 503);
  }

  const wire: WireMessage[] = messages.map(m => ({ ...m }));
  const toolDefs: ToolDef[] = [...(tools ?? []), ...(options.askUser ? [askToolDefinition] : [])];
  const hasTools = toolDefs.length > 0;
  let first: Awaited<ReturnType<typeof openUpstream>>;
  try {
    first = await openUpstream(apiKey, wire, hasTools ? toolDefs : undefined, signal, call);
  } catch (error) {
    if (signal.aborted) { finish('aborted'); return new Response(null, { status: 499 }); }
    const status = error instanceof UpstreamError ? error.status : undefined;
    console.error('OpenRouter request failed:', error instanceof Error ? error.message : 'unknown error');
    finish('error', error instanceof Error ? error.message : 'unknown error');
    return status
      ? jsonError(`Dịch vụ AI từ chối yêu cầu (HTTP ${status}).`, 502)
      : jsonError('Không kết nối được dịch vụ AI. Vui lòng thử lại sau.', 502);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      // Client có thể đã ngắt: ghi vào stream đã đóng thì bỏ qua.
      const safeEnqueue = (chunk: string) => { try { controller.enqueue(encoder.encode(chunk)); } catch { /* đã đóng */ } };
      const safeSend = (payload: unknown) => safeEnqueue(`data: ${JSON.stringify(payload)}\n\n`);
      const safeClose = () => { try { controller.close(); } catch { /* đã đóng */ } };
      const toolCache = new Map<string, string>();
      let sentText = false;
      const statusLines = options.reasoningStatus ?? [];
      let statusTimer: ReturnType<typeof setInterval> | undefined;
      const stopStatus = () => { if (statusTimer !== undefined) clearInterval(statusTimer); statusTimer = undefined; };
      if (statusLines.length) {
        const st: StatusState = { next: 0, lateSent: false };
        safeSend({ status: statusLines[st.next++] });
        // Xoay vòng các dòng rồi giữ dòng cuối; quá REASONING_STATUS_LATE_MS thì gửi dòng "sắp xong" (nếu có), một lần.
        // Chạy tới khi có chữ / kết thúc / bị huỷ, để người dùng không thấy màn hình đứng im lúc model nghĩ lâu.
        const late = options.reasoningStatusLate;
        if (statusLines.length > 1 || late) {
          statusTimer = setInterval(() => {
            if (sentText || signal.aborted) { stopStatus(); return; }
            const tick = statusTick(statusLines, late, st, Date.now() - startedAt);
            if (tick.send) safeSend({ status: tick.send });
            if (tick.stop) stopStatus();
          }, REASONING_STATUS_EVERY_MS);
        }
      }
      let finishReason: string | undefined;
      const filter = options.textFilter?.();
      const emitOut = (chunk: string) => {
        if (!chunk) return;
        if (!sentText) { firstTokenMs = Date.now() - startedAt; stopStatus(); }
        sentText = true;
        answer += chunk;
        send({ delta: { text: chunk } });
      };
      const flushFilter = () => { if (filter) emitOut(filter.flush()); };
      try {
        let upstream = first;
        for (let round = 1; ; round++) {
          // Lời dạo đầu kiểu "Để tôi tra…" đi kèm tool call không thuộc câu trả lời: giữ tạm phần đầu,
          // vòng nào có tool call thì bỏ, không thì phát ra (quá ngưỡng là phát luôn để không trễ chữ).
          let text = '';
          let held = '';
          let flushing = !hasTools;
          let sawToolCall = false;
          const emit = (chunk: string) => emitOut(filter ? filter.push(chunk) : chunk);
          const flush = () => { if (held) emit(held); held = ''; flushing = true; };
          const calls = await readUpstream(upstream.body, upstream.signal, chunk => {
            text += chunk;
            if (flushing) emit(chunk);
            else if (!sawToolCall) { held += chunk; if (held.length > PREAMBLE_HOLD_CHARS) flush(); }
          }, () => { sawToolCall = true; held = ''; }, addUsage, reason => { finishReason = reason; });
          // Hỏi lại chỉ hợp lệ khi chưa phát chữ nào cho người dùng; đã lỡ phát bài luận thì bỏ lần hỏi.
          const askCall = calls.find(c => c.function.name === ASK_TOOL_NAME);
          const pending = askCall && sentText ? calls.filter(c => c !== askCall) : calls;
          if (askCall && sentText) console.warn('hoi_nguoi_dung bị bỏ: model đã phát bài luận trước khi hỏi');
          if (!pending.length || !hasTools || round > MAX_TOOL_ROUNDS) { flush(); break; }

          if (askCall && !sentText) {
            const payload = parseAskArgs(askCall.function.arguments);
            if (payload) {
              toolCalls.push({ name: askCall.function.name, arguments: askCall.function.arguments });
              answer = encodeAsk(payload);
              asked = true;
              send({ ask: payload });
              break;
            }
          }

          wire.push({ role: 'assistant', content: text || null, tool_calls: pending });
          for (const call of pending) toolCalls.push({ name: call.function.name, arguments: call.function.arguments });
          for (const call of pending) {
            if (call.function.name === ASK_TOOL_NAME) {
              wire.push({ role: 'tool', tool_call_id: call.id, content: ASK_ARGS_ERROR });
              continue;
            }
            const { status, content } = runTool(tools ?? [], call, toolCache);
            send({ status });
            wire.push({ role: 'tool', tool_call_id: call.id, content });
          }
          // Vòng cuối: không gửi tool nữa để model buộc phải trả lời.
          upstream = await openUpstream(apiKey, wire, round < MAX_TOOL_ROUNDS ? toolDefs : undefined, signal, call);
        }
        flushFilter();
      } catch (error) {
        stopStatus();
        try { flushFilter(); } catch { /* stream đã đóng */ }
        if (signal.aborted) { finish('aborted'); safeClose(); return; }
        console.error('OpenRouter stream failed:', error instanceof Error ? error.message : 'unknown error');
        finish('error', error instanceof Error ? error.message : 'unknown error');
        safeSend({ error: sentText ? 'Câu trả lời bị gián đoạn, vui lòng hỏi lại.' : 'Luận giải thất bại, vui lòng thử lại sau.' });
      }
      stopStatus();
      if (finishReason === 'length' && !asked && !finished) {
        if (!answer.trim()) {
          // Suy luận ăn hết max_tokens: không có chữ nào → lỗi (route hoàn lượt, client hiện thông báo).
          console.warn('ai output truncated (finish_reason=length) with no answer text');
          finish('error', 'finish_reason=length, empty answer');
          safeSend({ error: TRUNCATED_EMPTY_ERROR });
        } else {
          console.warn(`ai output truncated (finish_reason=length) after ${answer.length} chars`);
        }
      }
      finish('ok');
      safeEnqueue('data: [DONE]\n\n');
      safeClose();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
