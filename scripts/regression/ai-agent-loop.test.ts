import assert from 'node:assert/strict';
import { streamChatResponse } from '../../lib/ai/chat-stream';
import type { ChartTool } from '../../lib/ai/tools/ziwei-tools';

// Vòng lặp agent: model gọi tool → chạy tool → gửi kết quả lại → model trả lời; có giới hạn số vòng.
const enc = new TextEncoder();
const sse = (events: unknown[]) => new Response(new ReadableStream({
  start(c) { for (const e of events) c.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`)); c.enqueue(enc.encode('data: [DONE]\n\n')); c.close(); },
}), { status: 200 });
const toolCallEvents = (id: string, name: string, args: string) => [
  { choices: [{ delta: { tool_calls: [{ index: 0, id, type: 'function', function: { name, arguments: args.slice(0, 5) } }] } }] },
  { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: args.slice(5) } }] } }] },
];

const runs: Record<string, unknown>[] = [];
const tool: ChartTool = {
  name: 'xem_van_han', description: 'd', parameters: { type: 'object' },
  status: a => `Đang xem vận hạn năm ${a.nam}…`,
  run: a => { runs.push(a); return { năm: a.nam }; },
};

async function collect(res: Response) {
  const text = await res.text();
  const events = text.split('\n').filter(l => l.startsWith('data: ') && l !== 'data: [DONE]').map(l => JSON.parse(l.slice(6)));
  return {
    statuses: events.filter(e => e.status).map(e => e.status),
    text: events.map(e => e.delta?.text ?? '').join(''),
    done: text.includes('data: [DONE]'),
  };
}

async function main() {
  process.env.OPENROUTER_API_KEY = 'test-key';
  const ctrl = new AbortController();

  // 1) Một lượt tool rồi trả lời
  const bodies: Record<string, any>[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
  let call = 0;
  globalThis.fetch = (async (_u: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return call++ === 0
      ? sse([{ choices: [{ delta: { content: 'Để tôi tra vận hạn đã.' } }] }, ...toolCallEvents('c1', 'xem_van_han', '{"nam":2026}')])
      : sse([{ choices: [{ delta: { content: 'Có tín hiệu.' } }] }]);
  }) as typeof fetch;
  const r1 = await collect(await streamChatResponse([{ role: 'user', content: 'Năm nay?' }], ctrl.signal, [tool]));
  assert.deepEqual(r1.statuses, ['Đang xem vận hạn năm 2026…']);
  assert.equal(r1.text, 'Có tín hiệu.', 'lời dạo đầu trước tool call không được lọt vào câu trả lời');
  assert.ok(r1.done);
  assert.deepEqual(runs, [{ nam: 2026 }], 'tham số tool gom từ nhiều mảnh phải ghép đúng');
  assert.equal(bodies.length, 2);
  assert.ok(bodies[0].tools?.length, 'lượt đầu phải gửi danh sách tool');
  const sent = bodies[1].messages;
  assert.equal(sent.at(-2).role, 'assistant');
  assert.equal(sent.at(-2).tool_calls[0].function.name, 'xem_van_han');
  assert.deepEqual([sent.at(-1).role, sent.at(-1).tool_call_id, JSON.parse(sent.at(-1).content)], ['tool', 'c1', { năm: 2026 }]);

  // 2) Model cứ gọi tool mãi → dừng sau giới hạn, vòng cuối không gửi tool
  bodies.length = 0;
  globalThis.fetch = (async (_u: unknown, init?: RequestInit) => {
    const b = JSON.parse(String(init?.body));
    bodies.push(b);
    return b.tools ? sse(toolCallEvents(`c${bodies.length}`, 'xem_van_han', '{"nam":2027}')) : sse([{ choices: [{ delta: { content: 'Kết luận.' } }] }]);
  }) as typeof fetch;
  const r2 = await collect(await streamChatResponse([{ role: 'user', content: 'Q' }], ctrl.signal, [tool]));
  assert.equal(r2.text, 'Kết luận.');
  assert.ok(bodies.length <= 5, `quá nhiều vòng: ${bodies.length}`);
  assert.equal(bodies.at(-1)!.tools, undefined, 'vòng cuối không được gửi tool');

  // 3) Tool không tồn tại hoặc lỗi → không sập, model vẫn trả lời
  call = 0;
  globalThis.fetch = (async () => call++ === 0 ? sse(toolCallEvents('x', 'khong_co', '{}')) : sse([{ choices: [{ delta: { content: 'OK' } }] }])) as typeof fetch;
  const r3 = await collect(await streamChatResponse([{ role: 'user', content: 'Q' }], ctrl.signal, [tool]));
  assert.equal(r3.text, 'OK');

  // 4) Không truyền tool → không gửi tools
  bodies.length = 0;
  globalThis.fetch = (async (_u: unknown, init?: RequestInit) => { bodies.push(JSON.parse(String(init?.body))); return sse([{ choices: [{ delta: { content: 'A' } }] }]); }) as typeof fetch;
  assert.equal((await collect(await streamChatResponse([{ role: 'user', content: 'Q' }], ctrl.signal))).text, 'A');
  assert.equal(bodies[0].tools, undefined);

  // 5) Lỗi 503 tạm thời → tự thử lại rồi chạy tiếp
  call = 0;
  globalThis.fetch = (async () => call++ === 0 ? new Response('busy', { status: 503 }) : sse([{ choices: [{ delta: { content: 'Sau thử lại' } }] }])) as typeof fetch;
  assert.equal((await collect(await streamChatResponse([{ role: 'user', content: 'Q' }], ctrl.signal))).text, 'Sau thử lại');
  assert.equal(call, 2, 'phải thử lại đúng một lần');

  // 6) 400 → không thử lại, trả lỗi JSON
  call = 0;
  globalThis.fetch = (async () => { call++; return new Response('bad', { status: 400 }); }) as typeof fetch;
  const r6 = await streamChatResponse([{ role: 'user', content: 'Q' }], ctrl.signal);
  assert.equal(r6.status, 502);
  assert.equal(call, 1);

  // 7) Nhà cung cấp báo lỗi giữa stream → giữ chữ đã gửi, kèm sự kiện error, vẫn kết thúc bằng [DONE]
  globalThis.fetch = (async () => sse([{ choices: [{ delta: { content: 'Phần đầu' } }] }, { error: { message: 'x' } }])) as typeof fetch;
  const raw7 = await (await streamChatResponse([{ role: 'user', content: 'Q' }], ctrl.signal)).text();
  assert.ok(raw7.includes('Phần đầu'));
  assert.ok(raw7.includes('"error":"Câu trả lời bị gián đoạn'), 'phải báo gián đoạn');
  assert.ok(raw7.includes('data: [DONE]'));

  // 8) Cùng tool + tham số gọi hai lần trong một yêu cầu → chỉ chạy một lần
  runs.length = 0;
  call = 0;
  globalThis.fetch = (async () => call++ < 2 ? sse(toolCallEvents(`k${call}`, 'xem_van_han', '{"nam":2030}')) : sse([{ choices: [{ delta: { content: 'Xong' } }] }])) as typeof fetch;
  assert.equal((await collect(await streamChatResponse([{ role: 'user', content: 'Q' }], ctrl.signal, [tool]))).text, 'Xong');
  assert.equal(runs.length, 1, 'kết quả tool trùng phải lấy từ cache');

  console.log('AI agent loop regression passed');
}
main().catch(error => { console.error(error); process.exit(1); });
