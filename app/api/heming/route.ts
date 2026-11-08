import { jsonError, streamChatResponse } from '@/lib/ai/chat-stream';
import { buildCompatibilitySystemPrompt, DEFAULT_COMPATIBILITY_QUESTION } from '@/lib/prompts/compatibility';
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
  const question = (body.question as string | undefined)?.trim().slice(0, 1000) || DEFAULT_COMPATIBILITY_QUESTION;

  // Các lượt hỏi đáp trước trên trang (tối đa 6 lượt gần nhất) để AI hiểu câu hỏi nối tiếp.
  const history = (Array.isArray(body.history) ? body.history : [])
    .filter((turn): turn is { question?: unknown; answer: string } =>
      isObject(turn) && typeof turn.answer === 'string' && turn.answer.trim().length > 0)
    .slice(-6)
    .flatMap(turn => [
      { role: 'user' as const, content: typeof turn.question === 'string' && turn.question.trim() ? turn.question.trim().slice(0, 1000) : DEFAULT_COMPATIBILITY_QUESTION },
      { role: 'assistant' as const, content: turn.answer.slice(0, 12000) },
    ]);

  return streamChatResponse([
    { role: 'system', content: buildCompatibilitySystemPrompt(body.chartA, body.chartB) },
    ...history,
    { role: 'user', content: question },
  ], request.signal);
}
