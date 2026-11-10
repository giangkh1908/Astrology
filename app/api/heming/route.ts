import { currentModel, jsonError, streamChatResponse } from '@/lib/ai/chat-stream';
import { resolvePromptVersion } from '@/lib/store/chat-store';
import { getChatStore } from '@/lib/store';
import { beginTurn, chartRef } from '@/lib/store/persist-turn';
import { getPromptSet } from '@/lib/prompts';
import type { ZiweiChart } from '@/lib/ziwei/types';

export const runtime = 'nodejs';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isChart(value: unknown): value is ZiweiChart {
  return isObject(value) && isObject(value.birthInfo) && isObject(value.lunarInfo) && Array.isArray(value.palaces) && Array.isArray(value.daXians);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Dữ liệu yêu cầu không phải JSON hợp lệ.', 400);
  }

  if (!isObject(body) || !isChart(body.chartA) || !isChart(body.chartB)) {
    return jsonError('Thiếu dữ liệu lá số của một trong hai người.', 400);
  }
  if (body.question !== undefined && typeof body.question !== 'string') {
    return jsonError('Câu hỏi phải là chuỗi ký tự.', 400);
  }
  const store = getChatStore();
  const version = await resolvePromptVersion(store);
  const prompts = getPromptSet(version);
  const question = (body.question as string | undefined)?.trim().slice(0, 1000) || prompts.defaultCompatibilityQuestion;

  // Các lượt hỏi đáp trước trên trang (tối đa 6 lượt gần nhất) để AI hiểu câu hỏi nối tiếp.
  const history = (Array.isArray(body.history) ? body.history : [])
    .filter((turn): turn is { question?: unknown; answer: string } =>
      isObject(turn) && typeof turn.answer === 'string' && turn.answer.trim().length > 0)
    .slice(-6)
    .flatMap(turn => [
      { role: 'user' as const, content: typeof turn.question === 'string' && turn.question.trim() ? turn.question.trim().slice(0, 1000) : prompts.defaultCompatibilityQuestion },
      { role: 'assistant' as const, content: turn.answer.slice(0, 12000) },
    ]);

  const systemPrompt = prompts.buildCompatibilitySystemPrompt(body.chartA, body.chartB);
  const { onFinish } = await beginTurn(store, {
    kind: 'heming',
    chart: chartRef(body.chartA.birthInfo),
    partnerChart: chartRef(body.chartB.birthInfo),
    threadKey: 'heming',
    question,
    promptVersion: version,
    model: currentModel(),
  });
  return streamChatResponse([
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: question },
  ], request.signal, undefined, { onFinish });
}
