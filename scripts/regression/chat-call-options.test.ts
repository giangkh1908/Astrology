import assert from 'node:assert/strict';
import type { TurnResult } from '../../lib/store/chat-store';

// Tuỳ chọn gọi model opt-in (session_id, provider, reasoning, max_tokens, temperature):
// chỉ vào body khi được truyền; body mặc định (/chart, hợp bàn) giữ nguyên; suy luận không lọt ra chữ;
// usage (kể cả cached_tokens) vào TurnResult. Không gọi API thật.
process.env.OPENROUTER_API_KEY = 'test-key';
process.env.OPENROUTER_MODEL = 'fake/model';

const enc = new TextEncoder();
const sse = (events: unknown[]) => new Response(new ReadableStream({
  start(c) {
    for (const e of events) c.enqueue(enc.encode(`data: ${typeof e === 'string' ? e : JSON.stringify(e)}\n\n`));
    c.close();
  },
}), { status: 200 });
const text = (t: string) => ({ choices: [{ delta: { content: t } }] });

let queue: (() => Response)[] = [];
let bodies: Record<string, unknown>[] = [];
globalThis.fetch = (async (_u: unknown, init?: RequestInit) => {
  bodies.push(JSON.parse(String(init?.body)));
  const next = queue.shift();
  if (!next) throw new Error('no fake response');
  return next();
}) as typeof fetch;

async function readAll(res: Response) {
  const reader = res.body!.getReader();
  let out = '';
  for (;;) { const { done, value } = await reader.read(); if (done) break; out += new TextDecoder().decode(value); }
  return out;
}

async function main() {
  const { streamChatResponse } = await import('../../lib/ai/chat-stream');
  const { kinhDichCallOptions, reasoningOn, reasoningPolicy } = await import('../../lib/kinh-dich/call-options');
  const msgs = [{ role: 'system' as const, content: 's' }, { role: 'user' as const, content: 'u' }];
  const plain = () => sse([text('ok'), '[DONE]']);

  // 1. Body mặc định không đổi (danh sách khoá cố định).
  {
    bodies = []; queue = [plain];
    await readAll(await streamChatResponse(msgs, new AbortController().signal));
    assert.deepEqual(Object.keys(bodies[0]).sort(), ['messages', 'model', 'reasoning', 'stream', 'usage']);
    assert.deepEqual(bodies[0].reasoning, { enabled: false });
    assert.deepEqual(bodies[0].usage, { include: true });

    const tool = { name: 'xem_cung', description: 'd', parameters: { type: 'object', properties: {} }, status: () => 's', run: () => ({}) };
    bodies = []; queue = [plain];
    await readAll(await streamChatResponse(msgs, new AbortController().signal, [tool], { askUser: true, onFinish: () => undefined }));
    assert.deepEqual(Object.keys(bodies[0]).sort(), ['messages', 'model', 'parallel_tool_calls', 'reasoning', 'stream', 'tool_choice', 'tools', 'usage']);

    // reasoning 'off' tường minh = mặc định; provider rỗng không thêm gì.
    bodies = []; queue = [plain];
    await readAll(await streamChatResponse(msgs, new AbortController().signal, undefined, { reasoning: 'off', provider: {} }));
    assert.deepEqual(Object.keys(bodies[0]).sort(), ['messages', 'model', 'reasoning', 'stream', 'usage']);
    assert.deepEqual(bodies[0].reasoning, { enabled: false });
  }

  // 2. Có tuỳ chọn thì có trường, ở mọi vòng của agent loop.
  {
    const tool = { name: 'xem_cung', description: 'd', parameters: { type: 'object', properties: {} }, status: () => 's', run: () => ({ ok: 1 }) };
    bodies = [];
    queue = [
      () => sse([{ choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', function: { name: 'xem_cung', arguments: '{}' } }] } }] }, '[DONE]']),
      plain,
    ];
    await readAll(await streamChatResponse(msgs, new AbortController().signal, [tool], {
      sessionId: 'kinh-dich-v2', provider: { quantizations: ['fp8', 'bf16'], allow_fallbacks: true }, reasoning: 'low', maxTokens: 4000, temperature: 0.7,
    }));
    assert.equal(bodies.length, 2);
    for (const b of bodies) {
      assert.equal(b.session_id, 'kinh-dich-v2');
      assert.deepEqual(b.provider, { quantizations: ['fp8', 'bf16'], allow_fallbacks: true });
      assert.deepEqual(b.reasoning, { effort: 'low' });
      assert.equal(b.max_tokens, 4000);
      assert.equal(b.temperature, 0.7);
      assert.equal(b.stream, true);
    }
  }

  // 3. Suy luận (delta.reasoning / reasoning_details) không phát thành chữ trả lời; usage vào TurnResult.
  {
    const calls: TurnResult[] = [];
    bodies = [];
    queue = [() => sse([
      { choices: [{ delta: { reasoning: 'nghĩ thầm', reasoning_details: [{ type: 'reasoning.text', text: 'nghĩ thầm 2' }] } }] },
      { choices: [{ delta: { content: '', reasoning: 'thêm' } }] },
      text('Quẻ '), text('Càn'),
      { choices: [], usage: { prompt_tokens: 5000, completion_tokens: 300, cost: 0.001, prompt_tokens_details: { cached_tokens: 4800, cache_write_tokens: 0 }, completion_tokens_details: { reasoning_tokens: 120 } } },
      '[DONE]',
    ])];
    const origInfo = console.info;
    const logged: string[] = [];
    console.info = (...a: unknown[]) => { logged.push(a.join(' ')); };
    try {
      const out = await readAll(await streamChatResponse(msgs, new AbortController().signal, undefined, { reasoning: 'low', onFinish: r => { calls.push(r); } }));
      assert.ok(!out.includes('nghĩ thầm') && !out.includes('thêm'), 'suy luận không được lọt ra stream');
    } finally { console.info = origInfo; }
    assert.equal(calls.length, 1);
    assert.equal(calls[0].text, 'Quẻ Càn');
    assert.deepEqual(calls[0].usage, { promptTokens: 5000, completionTokens: 300, costUsd: 0.001, cachedTokens: 4800, cacheWriteTokens: 0, reasoningTokens: 120 });
    assert.equal(logged.filter(l => l.startsWith('ai usage:')).length, 1, 'lượt opt-in in đúng một dòng usage');
    assert.ok(logged[0].includes('cached=4800'));
  }

  // 4. Usage không có chi tiết cache → không có trường cache (giữ hình dạng cũ); cộng dồn qua vòng.
  {
    const calls: TurnResult[] = [];
    queue = [() => sse([text('a'), { choices: [], usage: { prompt_tokens: 1, completion_tokens: 2, cost: 0 } }, '[DONE]'])];
    await readAll(await streamChatResponse(msgs, new AbortController().signal, undefined, { onFinish: r => { calls.push(r); } }));
    assert.deepEqual(calls[0].usage, { promptTokens: 1, completionTokens: 2, costUsd: 0 });
  }

  // 5. kinhDichCallOptions đọc env.
  {
    assert.deepEqual(kinhDichCallOptions({}), { sessionId: 'kinh-dich-v2', provider: { quantizations: ['fp8', 'bf16'] }, reasoning: 'off', maxTokens: 4000 });
    const low = kinhDichCallOptions({ KINH_DICH_REASONING: 'LOW', KINH_DICH_PROVIDER_QUANT: 'bf16, bogus ,fp16' });
    assert.equal(low.reasoning, 'low');
    assert.equal(low.maxTokens, 20000);
    assert.deepEqual(low.provider, { quantizations: ['bf16', 'fp16'] });
    assert.equal(kinhDichCallOptions({ KINH_DICH_PROVIDER_QUANT: 'any' }).provider, undefined);
    assert.equal(kinhDichCallOptions({ KINH_DICH_REASONING: 'medium' }).reasoning, 'off');

    // Chính sách theo lượt: mặc định 'first' = chỉ bài luận đầu suy luận; làm rõ câu hỏi không bao giờ.
    assert.equal(reasoningPolicy(undefined), 'first');
    assert.equal(reasoningPolicy('OFF'), 'off');
    assert.equal(reasoningPolicy('low'), 'all');
    const first = kinhDichCallOptions({}, 'first');
    assert.equal(first.reasoning, 'low');
    assert.equal(first.maxTokens, 20000);
    assert.equal(kinhDichCallOptions({}, 'followup').reasoning, 'off');
    assert.equal(kinhDichCallOptions({}, 'prepare').reasoning, 'off');
    assert.equal(kinhDichCallOptions({ KINH_DICH_REASONING: 'off' }, 'first').reasoning, 'off');
    assert.equal(kinhDichCallOptions({ KINH_DICH_REASONING: 'all' }, 'followup').reasoning, 'low');
    assert.equal(kinhDichCallOptions({ KINH_DICH_REASONING: 'all' }, 'prepare').reasoning, 'off');
    assert.equal(reasoningOn('first', 'first'), true);
    assert.equal(reasoningOn('first', 'followup'), false);
  }

  // 6. reasoningStatus: dòng trạng thái khi model đang suy luận, gửi trước chữ, có giãn cách, không lộ nội dung.
  {
    const reasoningDelta = (r: string) => JSON.stringify({ choices: [{ delta: { content: '', reasoning: r } }] });
    bodies = []; queue = [() => sse([reasoningDelta('bí mật 1'), reasoningDelta('bí mật 2'), reasoningDelta('bí mật 3'), text('Chữ'), reasoningDelta('sau chữ'), '[DONE]'])];
    const out = await readAll(await streamChatResponse(msgs, new AbortController().signal, undefined, { reasoning: 'low', reasoningStatus: ['A…', 'B…'] }));
    assert.equal((out.match(/"status"/g) ?? []).length, 1, 'các mảnh suy luận liền nhau chỉ ra một trạng thái');
    assert.ok(out.includes('"status":"A…"'));
    assert.ok(out.indexOf('"status"') < out.indexOf('"delta"'));
    assert.ok(!out.includes('bí mật') && !out.includes('sau chữ'));
    bodies = []; queue = [() => sse([reasoningDelta('x'), text('Chữ'), '[DONE]'])];
    const none = await readAll(await streamChatResponse(msgs, new AbortController().signal, undefined, { reasoning: 'low' }));
    assert.ok(!none.includes('"status"'), 'không truyền reasoningStatus thì không gửi trạng thái');
  }

  console.log('chat-call-options: ok');
}

main().catch(error => { console.error(error); process.exit(1); });
