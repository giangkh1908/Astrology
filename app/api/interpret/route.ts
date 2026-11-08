import { buildInterpretationSystemPrompt, initialInterpretationQuestion, type InterpretationIntent, type InterpretationTimeContext } from '@/lib/prompts/astrology-interpretation';
import { jsonError, streamChatResponse } from '@/lib/ai/chat-stream';
import { buildChartTools } from '@/lib/ai/tools/ziwei-tools';
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

  const intent = isObject(body.intent) ? body.intent as unknown as InterpretationIntent : { type: 'topic' as const, key: 'overview' };
  const time = isObject(body.timeContext) ? body.timeContext as unknown as InterpretationTimeContext : {};
  if (!messages.some(message => message.role === 'user')) {
    messages.push({ role: 'user', content: initialInterpretationQuestion(intent) });
  }

  const chart = body.chart as unknown as ZiweiChart;
  return streamChatResponse([
    { role: 'system', content: buildInterpretationSystemPrompt(chart, intent, time) },
    ...messages,
  ], request.signal, buildChartTools(chart.birthInfo));
}
