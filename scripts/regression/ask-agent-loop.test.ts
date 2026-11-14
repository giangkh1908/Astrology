import assert from 'node:assert/strict';
import { streamChatResponse } from '../../lib/ai/chat-stream';
import type { ChartTool } from '../../lib/ai/tools/ziwei-tools';
import type { TurnResult } from '../../lib/store/chat-store';

// Prompt v3: model gọi hoi_nguoi_dung → server phát thẻ hỏi, KHÔNG phát bài luận, kết thúc lượt, đánh dấu asked.
const enc = new TextEncoder();
const sse = (events: unknown[]) => new Response(new ReadableStream({
  start(c) { for (const e of events) c.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`)); c.enqueue(enc.encode('data: [DONE]\n\n')); c.close(); },
}), { status: 200 });
const textEvent = (t: string) => ({ choices: [{ delta: { content: t } }] });
const callEvent = (index: number, id: string, name: string, args: string) =>
  ({ choices: [{ delta: { tool_calls: [{ index, id, type: 'function', function: { name, arguments: args } }] } }] });

const validAsk = JSON.stringify({
  loi_dan: 'Cho mình hỏi thêm:',
  cau_hoi: [{ nhan: 'Hôn nhân', noi_dung: 'Bạn đã lập gia đình chưa?', lua_chon: [{ tieu_de: 'Rồi' }, { tieu_de: 'Chưa' }] }],
});

const runs: unknown[] = [];
const tool: ChartTool = {
  name: 'xem_van_han', description: 'd', parameters: { type: 'object' },
  status: () => 'Đang xem vận hạn', run: a => { runs.push(a); return { ok: 1 }; },
};

async function collect(res: Response) {
  const raw = await res.text();
  const events = raw.split('\n').filter(l => l.startsWith('data: ') && l !== 'data: [DONE]').map(l => JSON.parse(l.slice(6)));
  return {
    asks: events.filter(e => e.ask).map(e => e.ask),
    text: events.map(e => e.delta?.text ?? '').join(''),
    done: raw.includes('data: [DONE]'),
  };
}

async function main() {
  process.env.OPENROUTER_API_KEY = 'test-key';
  const ctrl = new AbortController();
  const bodies: Record<string, any>[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
  let queue: Response[] = [];
  globalThis.fetch = (async (_u: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    const next = queue.shift();
    if (!next) throw new Error('no fake response');
    return next;
  }) as typeof fetch;
  const run = async (opts: { askUser?: boolean }, responses: Response[]) => {
    bodies.length = 0;
    queue = responses;
    let result: TurnResult | undefined;
    const r = await collect(await streamChatResponse([{ role: 'user', content: 'Năm nay tình cảm?' }], ctrl.signal, [tool], {
      ...opts, onFinish: x => { result = x; },
    }));
    return { ...r, result };
  };

  // 1) Hỏi lại hợp lệ: chỉ có thẻ, chữ trong vòng đó bị bỏ, không gọi thêm vòng nào
  const r1 = await run({ askUser: true }, [sse([textEvent('Bài luận dài…'), callEvent(0, 'a1', 'hoi_nguoi_dung', validAsk)])]);
  assert.equal(r1.asks.length, 1);
  assert.equal(r1.asks[0].cau_hoi[0].noi_dung, 'Bạn đã lập gia đình chưa?');
  assert.equal(r1.text, '', 'không được phát chữ bài luận khi hỏi lại');
  assert.ok(r1.done);
  assert.equal(bodies.length, 1, 'hỏi lại thì không gọi model thêm vòng nào');
  assert.equal(r1.result?.status, 'ok');
  assert.equal(r1.result?.asked, true);
  assert.ok(r1.result?.text.startsWith('Cho mình hỏi thêm:'));
  assert.ok(r1.result?.text.includes('<!--ask:'));

  // 2) Có askUser thì gửi tool hoi_nguoi_dung; không có thì không
  const names = (b: Record<string, any>) => (b.tools ?? []).map((t: any) => t.function.name); // eslint-disable-line @typescript-eslint/no-explicit-any
  assert.ok(names(bodies[0]).includes('hoi_nguoi_dung'));
  await run({}, [sse([textEvent('Luận.')])]);
  assert.ok(!names(bodies[0]).includes('hoi_nguoi_dung'));
  assert.ok(names(bodies[0]).includes('xem_van_han'));

  // 3) Tham số hỏng → model nhận lỗi qua tool message rồi luận tiếp
  const r3 = await run({ askUser: true }, [sse([callEvent(0, 'b1', 'hoi_nguoi_dung', '{"cau_hoi":[]}')]), sse([textEvent('OK')])]);
  assert.equal(r3.asks.length, 0);
  assert.equal(r3.text, 'OK');
  assert.notEqual(r3.result?.asked, true);
  const toolMsg = bodies[1].messages.at(-1);
  assert.equal(toolMsg.role, 'tool');
  assert.equal(toolMsg.tool_call_id, 'b1');

  // 4) Đã phát > 200 ký tự rồi mới gọi hỏi lại → bỏ lần hỏi, giữ bài luận
  const long = 'x'.repeat(300);
  const r4 = await run({ askUser: true }, [sse([textEvent(long), callEvent(0, 'c1', 'hoi_nguoi_dung', validAsk)])]);
  assert.equal(r4.asks.length, 0);
  assert.equal(r4.text, long);
  assert.notEqual(r4.result?.asked, true);
  assert.equal(bodies.length, 1);

  // 5) Cùng vòng có tool tra cứu + hỏi lại → không chạy tool tra cứu, chỉ hỏi
  runs.length = 0;
  const r5 = await run({ askUser: true }, [sse([callEvent(0, 'd1', 'xem_van_han', '{"nam":2026}'), callEvent(1, 'd2', 'hoi_nguoi_dung', validAsk)])]);
  assert.equal(r5.asks.length, 1);
  assert.equal(runs.length, 0);

  console.log('ask-agent-loop: ok');
}
main().catch(error => { console.error(error); process.exit(1); });
