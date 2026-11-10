import assert from 'node:assert/strict';
import type { TurnResult } from '../../lib/store/chat-store';

// streamChatResponse báo kết quả lượt (để lưu hội thoại + log) đúng một lần: ok / error / aborted.
process.env.OPENROUTER_API_KEY = 'test-key';
process.env.OPENROUTER_MODEL = 'fake/model';

const enc = new TextEncoder();
const sse = (events: unknown[], { hang = false } = {}) => new Response(new ReadableStream({
  start(c) {
    for (const e of events) c.enqueue(enc.encode(`data: ${typeof e === 'string' ? e : JSON.stringify(e)}\n\n`));
    if (!hang) c.close();
  },
}), { status: 200 });
const text = (t: string) => ({ choices: [{ delta: { content: t } }] });

let queue: (() => Response | Promise<Response>)[] = [];
let lastBody: Record<string, unknown> = {};
globalThis.fetch = (async (_u: unknown, init?: RequestInit) => {
  lastBody = JSON.parse(String(init?.body));
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
  const msgs = [{ role: 'system' as const, content: 's' }, { role: 'user' as const, content: 'u' }];
  const capture = () => { const calls: TurnResult[] = []; return { calls, onFinish: (r: TurnResult) => { calls.push(r); } }; };

  // 1. Thành công + usage
  {
    const f = capture();
    queue = [() => sse([text('Xin '), text('chào'), { choices: [], usage: { prompt_tokens: 10, completion_tokens: 5, cost: 0.0001 } }, '[DONE]'])];
    const res = await streamChatResponse(msgs, new AbortController().signal, undefined, { onFinish: f.onFinish });
    await readAll(res);
    assert.deepEqual((lastBody.usage as { include: boolean }), { include: true });
    assert.equal(f.calls.length, 1);
    const r = f.calls[0];
    assert.equal(r.status, 'ok');
    assert.equal(r.text, 'Xin chào');
    assert.equal(r.usage?.promptTokens, 10);
    assert.equal(r.usage?.completionTokens, 5);
    assert.equal(r.usage?.costUsd, 0.0001);
    assert.equal(typeof r.firstTokenMs, 'number');
    assert.equal(typeof r.durationMs, 'number');
  }

  // 2. Tool call ở vòng 1, trả lời ở vòng 2; lời dạo đầu bị bỏ không tính vào text
  {
    const f = capture();
    const tool = { name: 'xem_cung', description: 'd', parameters: { type: 'object', properties: {} }, status: () => 'Đang xem cung', run: () => ({ ok: 1 }) };
    queue = [
      () => sse([text('Để tôi tra…'), { choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', function: { name: 'xem_cung', arguments: '{"chu_de":"menh"}' } }] } }], usage: { prompt_tokens: 3, completion_tokens: 1, cost: 0.00001 } }, '[DONE]']),
      () => sse([text('Kết quả'), { choices: [], usage: { prompt_tokens: 7, completion_tokens: 2, cost: 0.00002 } }, '[DONE]']),
    ];
    await readAll(await streamChatResponse(msgs, new AbortController().signal, [tool as never], { onFinish: f.onFinish }));
    const r = f.calls[0];
    assert.equal(r.text, 'Kết quả');
    assert.deepEqual(r.toolCalls, [{ name: 'xem_cung', arguments: '{"chu_de":"menh"}' }]);
    assert.equal(r.usage?.promptTokens, 10, 'usage cộng dồn qua các vòng');
    assert.ok(Math.abs((r.usage?.costUsd ?? 0) - 0.00003) < 1e-12);
  }

  // 3. Upstream từ chối trước khi stream
  {
    const f = capture();
    queue = [() => new Response('bad', { status: 400 })];
    const res = await streamChatResponse(msgs, new AbortController().signal, undefined, { onFinish: f.onFinish });
    assert.equal(res.status, 502);
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].status, 'error');
    assert.equal(f.calls[0].text, '');
    assert.equal(f.calls[0].error, 'HTTP 400');
  }

  // 4. Lỗi giữa stream: giữ phần đã phát
  {
    const f = capture();
    queue = [() => sse([text('Phần đầu'), { error: { message: 'boom' } }])];
    const out = await readAll(await streamChatResponse(msgs, new AbortController().signal, undefined, { onFinish: f.onFinish }));
    assert.match(out, /"error"/);
    assert.equal(f.calls[0].status, 'error');
    assert.equal(f.calls[0].text, 'Phần đầu');
  }

  // 5. Người dùng bấm dừng sau chunk đầu
  {
    const f = capture();
    const ctrl = new AbortController();
    queue = [() => sse([text('Đang nói dở')], { hang: true })];
    const res = await streamChatResponse(msgs, ctrl.signal, undefined, { onFinish: f.onFinish });
    const reader = res.body!.getReader();
    await reader.read(); // nhận chunk đầu
    ctrl.abort();
    for (;;) { const { done } = await reader.read(); if (done) break; }
    await new Promise(r => setTimeout(r, 20));
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].status, 'aborted');
    assert.equal(f.calls[0].text, 'Đang nói dở');
  }

  // 6. onFinish ném lỗi không làm hỏng stream
  {
    queue = [() => sse([text('ok'), '[DONE]'])];
    const out = await readAll(await streamChatResponse(msgs, new AbortController().signal, undefined, { onFinish: () => { throw new Error('db down'); } }));
    assert.match(out, /\[DONE\]/);
  }

  console.log('chat-stream-finish: ok');
}

main().catch(err => { console.error(err); process.exit(1); });
