/**
 * Gọi dịch vụ chat AI (hiện là OpenRouter) và trả về Response SSE theo định dạng nội bộ:
 *   data: {"delta":{"text":"..."}}   — chữ của câu trả lời
 *   data: {"status":"..."}           — AI đang dùng tool (hiển thị cho người dùng)
 *   data: {"error":"..."}            — đứt giữa chừng: phần chữ đã gửi vẫn giữ, client báo gián đoạn
 *   data: [DONE]
 * Có `tools` thì chạy vòng lặp agent: model tự gọi tool, kết quả được gửi lại, lặp tới khi model trả lời.
 */
import type { ChartTool } from './tools/ziwei-tools';
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
/** Thử lại khi lỗi mạng / 429 / 5xx trước khi có dữ liệu, cách nhau RETRY_DELAY_MS * lần. */
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 700;
/** Giới hạn độ dài kết quả một tool gửi lại cho model. */
const MAX_TOOL_RESULT_CHARS = 30_000;

type WireMessage = Record<string, unknown>;
interface ToolCall { id: string; type: 'function'; function: { name: string; arguments: string } }

/** Model đang gửi lên nhà cung cấp (dùng cho log). */
export function currentModel(): string {
  return process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4.1-flash';
}

interface Usage { promptTokens: number; completionTokens: number; costUsd: number }

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
async function openUpstream(apiKey: string, messages: WireMessage[], tools: ChartTool[] | undefined, signal: AbortSignal) {
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
  });
  let lastError: UpstreamError | undefined;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) await sleep(RETRY_DELAY_MS * (attempt - 1), signal);
    const roundSignal = AbortSignal.any([signal, AbortSignal.timeout(ROUND_TIMEOUT_MS)]);
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
        let event: { error?: unknown; usage?: unknown; choices?: Array<{ delta?: { content?: unknown; tool_calls?: unknown } }> };
        try { event = JSON.parse(data); } catch { continue; }
        if (event.error) throw new UpstreamError('provider error event');
        if (isObject(event.usage)) {
          const u = event.usage;
          onUsage?.({
            promptTokens: Number(u.prompt_tokens) || 0,
            completionTokens: Number(u.completion_tokens) || 0,
            costUsd: Number(u.cost) || 0,
          });
        }
        const delta = event.choices?.[0]?.delta;
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
}

export async function streamChatResponse(
  messages: ChatStreamMessage[],
  signal: AbortSignal,
  tools?: ChartTool[],
  options: StreamOptions = {},
): Promise<Response> {
  const startedAt = Date.now();
  let answer = '';
  let firstTokenMs: number | undefined;
  const toolCalls: ToolCallLog[] = [];
  let usage: Usage | undefined;
  let finished = false;
  const finish = (status: TurnResult['status'], error?: string) => {
    if (finished) return;
    finished = true;
    try {
      options.onFinish?.({
        text: answer, status, ...(error ? { error } : {}), toolCalls, firstTokenMs, durationMs: Date.now() - startedAt,
        ...(usage ? { usage: { ...usage } } : {}),
      });
    } catch (e) {
      console.error('onFinish failed:', e instanceof Error ? e.message : 'unknown error');
    }
  };
  const addUsage = (u: Usage) => {
    usage = usage
      ? { promptTokens: usage.promptTokens + u.promptTokens, completionTokens: usage.completionTokens + u.completionTokens, costUsd: usage.costUsd + u.costUsd }
      : u;
  };

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    finish('error', 'missing API key');
    return jsonError('Chưa cấu hình OPENROUTER_API_KEY trong .env.local.', 503);
  }

  const wire: WireMessage[] = messages.map(m => ({ ...m }));
  let first: Awaited<ReturnType<typeof openUpstream>>;
  try {
    first = await openUpstream(apiKey, wire, tools, signal);
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
      try {
        let upstream = first;
        for (let round = 1; ; round++) {
          // Lời dạo đầu kiểu "Để tôi tra…" đi kèm tool call không thuộc câu trả lời: giữ tạm phần đầu,
          // vòng nào có tool call thì bỏ, không thì phát ra (quá ngưỡng là phát luôn để không trễ chữ).
          let text = '';
          let held = '';
          let flushing = !tools?.length;
          let sawToolCall = false;
          const emit = (chunk: string) => {
            if (!sentText) firstTokenMs = Date.now() - startedAt;
            sentText = true;
            answer += chunk;
            send({ delta: { text: chunk } });
          };
          const flush = () => { if (held) emit(held); held = ''; flushing = true; };
          const calls = await readUpstream(upstream.body, upstream.signal, chunk => {
            text += chunk;
            if (flushing) emit(chunk);
            else if (!sawToolCall) { held += chunk; if (held.length > PREAMBLE_HOLD_CHARS) flush(); }
          }, () => { sawToolCall = true; held = ''; }, addUsage);
          if (!calls.length || !tools?.length || round > MAX_TOOL_ROUNDS) { flush(); break; }

          wire.push({ role: 'assistant', content: text || null, tool_calls: calls });
          for (const call of calls) toolCalls.push({ name: call.function.name, arguments: call.function.arguments });
          for (const call of calls) {
            const { status, content } = runTool(tools, call, toolCache);
            send({ status });
            wire.push({ role: 'tool', tool_call_id: call.id, content });
          }
          // Vòng cuối: không gửi tool nữa để model buộc phải trả lời.
          upstream = await openUpstream(apiKey, wire, round < MAX_TOOL_ROUNDS ? tools : undefined, signal);
        }
      } catch (error) {
        if (signal.aborted) { finish('aborted'); safeClose(); return; }
        console.error('OpenRouter stream failed:', error instanceof Error ? error.message : 'unknown error');
        finish('error', error instanceof Error ? error.message : 'unknown error');
        safeSend({ error: sentText ? 'Câu trả lời bị gián đoạn, vui lòng hỏi lại.' : 'Luận giải thất bại, vui lòng thử lại sau.' });
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
