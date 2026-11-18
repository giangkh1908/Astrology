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


  // 7. finish_reason=length mà chưa có chữ: lượt lỗi (để hoàn quota) + báo lỗi tiếng Việt cho người dùng
  {
    const { TRUNCATED_EMPTY_ERROR } = await import('../../lib/ai/chat-stream');
    const f = capture();
    queue = [() => sse([{ choices: [{ delta: { reasoning: 'nghĩ mãi…' } }] }, { choices: [{ delta: {}, finish_reason: 'length' }] }, '[DONE]'])];
    const out = await readAll(await streamChatResponse(msgs, new AbortController().signal, undefined, { onFinish: f.onFinish }));
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].status, 'error');
    assert.ok(out.includes(JSON.stringify({ error: TRUNCATED_EMPTY_ERROR })), 'gửi lỗi cho client');
  }
  // 7b. Bị cắt sau khi đã có chữ: vẫn ok, giữ phần đã viết
  {
    const f = capture();
    queue = [() => sse([text('Đã viết một đoạn'), { choices: [{ delta: {}, finish_reason: 'length' }] }, '[DONE]'])];
    await readAll(await streamChatResponse(msgs, new AbortController().signal, undefined, { onFinish: f.onFinish }));
    assert.equal(f.calls[0].status, 'ok');
    assert.equal(f.calls[0].text, 'Đã viết một đoạn');
  }

  // 8. Dòng trạng thái theo đồng hồ: dòng đầu gửi ngay khi kết nối (kể cả model không gửi mảnh suy luận), dừng khi có chữ
  {
    const f = capture();
    queue = [() => sse([text('Trả lời')])];
    const out = await readAll(await streamChatResponse(msgs, new AbortController().signal, undefined, { onFinish: f.onFinish, reasoningStatus: ['Đang ngẫm…', 'Đang soát…'] }));
    const statuses = out.split('\n').filter(l => l.includes('"status"'));
    assert.equal(statuses.length, 1, 'một dòng trạng thái trước chữ đầu');
    assert.ok(out.indexOf('Đang ngẫm') < out.indexOf('Trả lời'));
    assert.ok(!out.includes('Đang soát'), 'có chữ rồi thì không gửi trạng thái nữa');
    queue = [() => sse([text('x')])];
    const none = await readAll(await streamChatResponse(msgs, new AbortController().signal, undefined, {}));
    assert.ok(!none.includes('"status"'), 'không truyền reasoningStatus thì không có trạng thái');
  }

  // 9. textFilter: lọc cả chữ gửi đi lẫn chữ lưu (mảnh bị cắt ngang được nối lại khi flush)
  {
    const f = capture();
    const { createHanStripper } = await import('../../lib/kinh-dich/strip-han');
    queue = [() => sse([text('Quẻ Tỉnh ('), text('井：改'), text(') nói về **'), text('giếng**.'), '[DONE]'])];
    const out = await readAll(await streamChatResponse(msgs, new AbortController().signal, undefined, { onFinish: f.onFinish, textFilter: createHanStripper }));
    assert.equal(f.calls[0].text, 'Quẻ Tỉnh nói về **giếng**.');
    assert.ok(!/[\u4e00-\u9fff]/.test(out), 'không gửi chữ Hán cho client');
  }


  // 10. Nhịp trạng thái: xoay các dòng, giữ dòng cuối, quá 30 giây gửi "sắp xong" một lần rồi dừng
  {
    const { statusTick, REASONING_STATUS_LATE_MS } = await import('../../lib/ai/chat-stream');
    const st = { next: 1, lateSent: false }; // dòng 0 đã gửi lúc kết nối
    const L = ['A', 'B', 'C'];
    assert.deepEqual(statusTick(L, 'Sắp xong', st, 6000), { send: 'B', stop: false });
    assert.deepEqual(statusTick(L, 'Sắp xong', st, 12000), { send: 'C', stop: false });
    assert.deepEqual(statusTick(L, 'Sắp xong', st, 18000), { stop: false }, 'giữ dòng cuối, chờ mốc sắp xong');
    assert.deepEqual(statusTick(L, 'Sắp xong', st, REASONING_STATUS_LATE_MS), { send: 'Sắp xong', stop: false });
    assert.deepEqual(statusTick(L, 'Sắp xong', st, REASONING_STATUS_LATE_MS + 6000), { stop: true });
    const st2 = { next: 1, lateSent: false };
    assert.deepEqual(statusTick(['A', 'B'], undefined, st2, 6000), { send: 'B', stop: false });
    assert.deepEqual(statusTick(['A', 'B'], undefined, st2, 12000), { stop: true }, 'không có dòng sắp xong thì dừng sau dòng cuối');
    const st3 = { next: 1, lateSent: false };
    assert.deepEqual(statusTick(['A', 'B'], 'Sắp xong', st3, 40000), { send: 'Sắp xong', stop: false }, 'quá mốc thì ưu tiên dòng sắp xong');
    assert.deepEqual(statusTick(['A', 'B'], 'Sắp xong', st3, 46000), { stop: true }, 'sau dòng sắp xong không quay lại dòng cũ');
  }

  console.log('chat-stream-finish: ok');
}

main().catch(err => { console.error(err); process.exit(1); });
