import { getPromptSet, type InterpretationIntent, type InterpretationTimeContext } from '@/lib/prompts';
import { currentModel, jsonError, streamChatResponse } from '@/lib/ai/chat-stream';
import { resolvePromptVersion } from '@/lib/store/chat-store';
import { getChatStore } from '@/lib/store';
import { beginTurn, chartRef, threadKeyFor } from '@/lib/store/persist-turn';
import { buildChartTools } from '@/lib/ai/tools/ziwei-tools';
import { chargeChat, refundingOnFinish, withQuotaHeader } from '@/lib/users/quota';
import type { ZiweiChart } from '@/lib/ziwei/types';

export const runtime = 'nodejs';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
  const version = await resolvePromptVersion(store);
  const prompts = getPromptSet(version);

  const intent = isObject(body.intent) ? body.intent as unknown as InterpretationIntent : { type: 'topic' as const, key: 'overview' };
  const time = isObject(body.timeContext) ? body.timeContext as unknown as InterpretationTimeContext : {};
  // Mở mục (chưa có câu trả lời nào): lượt mới, bỏ lịch sử cũ khi nạp lại. Không có câu user: câu hỏi tự động.
  const fresh = !messages.some(message => message.role === 'assistant');
  const hiddenQuestion = !messages.some(message => message.role === 'user');
  if (hiddenQuestion) {
    messages.push({ role: 'user', content: prompts.initialInterpretationQuestion(intent) });
  }

  const chart = body.chart as unknown as ZiweiChart;
  const lastQuestion = [...messages].reverse().find(m => m.role === 'user')?.content ?? '';
  // Dựng prompt/tool trước khi ghi lượt: lỗi ở đây không để lại lượt 'pending'.
  const systemPrompt = prompts.buildInterpretationSystemPrompt(chart, intent, time);
  const tools = buildChartTools(chart.birthInfo);
  // Trừ lượt sau khi dựng prompt (lỗi dựng prompt không mất lượt); AI lỗi trước khi có chữ → hoàn lượt.
  const charge = await chargeChat(request);
  if (!charge.ok) return charge.response;
  const { onFinish } = await beginTurn(store, {
    userId: charge.userId,
    kind: 'interpret',
    chart: chartRef(chart.birthInfo),
    threadKey: threadKeyFor(body.threadKey, intent),
    fresh,
    hiddenQuestion,
    question: lastQuestion,
    promptVersion: version,
    model: currentModel(),
  });
  const response = await streamChatResponse([
    { role: 'system', content: systemPrompt },
    ...messages,
  ], request.signal, tools, { onFinish: refundingOnFinish(onFinish, charge.refund) });
  return withQuotaHeader(response, charge.quota);
}
