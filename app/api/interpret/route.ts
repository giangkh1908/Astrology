import { getPromptSet, type InterpretationIntent, type InterpretationTimeContext } from '@/lib/prompts';
import { currentModel, jsonError, streamChatResponse } from '@/lib/ai/chat-stream';
import { resolvePromptVersion } from '@/lib/store/chat-store';
import { getChatStore } from '@/lib/store';
import { beginTurn, chartRef, threadKeyFor } from '@/lib/store/persist-turn';
import { buildChartTools } from '@/lib/ai/tools/ziwei-tools';
import { chargeChat, refundingOnFinish, withQuotaHeader } from '@/lib/users/quota';
import { priorNotesOf } from '@/lib/store/prior-notes';
import type { ZiweiChart } from '@/lib/ziwei/types';
import { askToPlainText, MAX_CONSECUTIVE_ASKS, trailingAsks } from '@/lib/ai/ask-user';
import { callerOf } from '@/lib/users/quota';
import { parseWindow } from '@/lib/ziwei/month-window';
import type { ChatStore } from '@/lib/store/chat-store';

export const runtime = 'nodejs';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Lượt này là câu trả lời cho thẻ hỏi lại (không trừ lượt): client báo answering VÀ tin assistant cuối
 * đã lưu của mục này đúng là thẻ hỏi. Trả về lượt miễn phí (kèm userId để ghi lượt), không thì null.
 * Store tắt hoặc lỗi → không xác minh được → null (trừ như thường).
 */
async function freeAnswerTurn(request: Request, store: ChatStore, chart: ZiweiChart, threadKey: string) {
  if (!store.enabled) return null;
  try {
    const caller = await callerOf(request);
    if (!caller) return null;
    const userId = caller.kind === 'member' ? caller.userId : null;
    const status = await store.lastAssistantStatus({ kind: 'interpret', chartKey: chartRef(chart.birthInfo).key, partnerKey: null, userId, threadKey });
    return status === 'asked' ? { ok: true as const, userId, quota: null, refund: async () => undefined } : null;
  } catch (error) {
    console.error('lastAssistantStatus failed:', error instanceof Error ? error.message : 'unknown error');
    return null;
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Dữ liệu yêu cầu không phải JSON hợp lệ.', 400);
  }

  if (!isObject(body) || !isObject(body.chart) || !isObject(body.chart.birthInfo) || !isObject(body.chart.lunarInfo) || !Array.isArray(body.chart.palaces) || !Array.isArray(body.messages)) {
    return jsonError('Thiếu dữ liệu lá số hoặc lịch sử hội thoại.', 400);
  }

  const messages = (body.messages as unknown[])
    .filter((item): item is ChatMessage =>
      isObject(item) &&
      (item.role === 'user' || item.role === 'assistant') &&
      typeof item.content === 'string' &&
      item.content.trim().length > 0,
    )
    .slice(-16)
    .map(message => ({ role: message.role, content: message.content.slice(0, 6000) }));

  const store = getChatStore();
  const chart = body.chart as unknown as ZiweiChart;
  const intent = isObject(body.intent) ? body.intent as unknown as InterpretationIntent : { type: 'topic' as const, key: 'overview' };
  const rawTime = isObject(body.timeContext) ? body.timeContext : {};
  const time: InterpretationTimeContext = { ...(rawTime as InterpretationTimeContext), window: parseWindow(rawTime.window) };
  const threadKey = threadKeyFor(body.threadKey, intent);
  // Đọc song song version prompt, lời người dùng đã kể ở các mục khác, và (nếu client báo) lượt trả lời thẻ hỏi.
  const [version, priorNotes, freeAnswer] = await Promise.all([
    resolvePromptVersion(store),
    priorNotesOf(request, store, chart, threadKey),
    body.answering === true ? freeAnswerTurn(request, store, chart, threadKey) : Promise.resolve(null),
  ]);
  const prompts = getPromptSet(version);
  // Mở mục (chưa có câu trả lời nào): lượt mới, bỏ lịch sử cũ khi nạp lại. Không có câu user: câu hỏi tự động.
  const fresh = !messages.some(message => message.role === 'assistant');
  const hiddenQuestion = !messages.some(message => message.role === 'user');
  if (hiddenQuestion) {
    messages.push({ role: 'user', content: prompts.initialInterpretationQuestion(intent) });
  }

  // v3: AI được hỏi lại trước khi luận, trừ câu hỏi tự động và khi đã hỏi liên tiếp đủ số lần.
  const askUser = version === 'v3' && !hiddenQuestion && trailingAsks(messages) < MAX_CONSECUTIVE_ASKS;
  const modelMessages = messages.map(m => (m.role === 'assistant' ? { ...m, content: askToPlainText(m.content) } : m));

  const lastQuestion = [...messages].reverse().find(m => m.role === 'user')?.content ?? '';
  // Dựng prompt/tool trước khi ghi lượt: lỗi ở đây không để lại lượt 'pending'.
  const systemPrompt = prompts.buildInterpretationSystemPrompt(chart, intent, time, priorNotes);
  const tools = buildChartTools(chart.birthInfo);
  // Trừ lượt sau khi dựng prompt (lỗi dựng prompt không mất lượt); AI lỗi trước khi có chữ → hoàn lượt.
  // Trả lời thẻ hỏi lại thì không trừ lượt.
  const charge = freeAnswer ?? await chargeChat(request);
  if (!charge.ok) return charge.response;
  const { onFinish } = await beginTurn(store, {
    userId: charge.userId,
    kind: 'interpret',
    chart: chartRef(chart.birthInfo),
    threadKey,
    fresh,
    hiddenQuestion,
    question: lastQuestion,
    promptVersion: version,
    model: currentModel(),
  });
  const response = await streamChatResponse([
    { role: 'system', content: systemPrompt },
    ...modelMessages,
  ], request.signal, tools, { askUser, onFinish: refundingOnFinish(onFinish, charge.refund) });
  try { response.headers.set('X-Prompt-Version', version); } catch { /* headers bất biến */ }
  return charge.quota ? withQuotaHeader(response, charge.quota) : response;
}
