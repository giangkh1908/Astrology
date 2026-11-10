import assert from 'node:assert/strict';
import { ACTIVE_PROMPT_KEY, type ChatStore } from '../../lib/store/chat-store';
import { createMemoryChatStore } from '../../lib/store/memory-chat-store';
import { setChatStoreForTest } from '../../lib/store';

// Route AI: lấy version prompt đang chạy, ghi tin user cuối + câu trả lời + log vào store; store lỗi không làm hỏng chat.
process.env.OPENROUTER_API_KEY = 'test-key';
process.env.OPENROUTER_MODEL = 'fake/model';

let lastSystem = '';
globalThis.fetch = (async (_u: unknown, init?: RequestInit) => {
  const body = JSON.parse(String(init?.body));
  lastSystem = body.messages[0].content;
  const enc = new TextEncoder();
  return new Response(new ReadableStream({
    start(c) {
      c.enqueue(enc.encode('data: {"choices":[{"delta":{"content":"Trả lời giả"}}]}\n\n'));
      c.enqueue(enc.encode('data: [DONE]\n\n'));
      c.close();
    },
  }), { status: 200 });
}) as typeof fetch;

// Promise treo vĩnh viễn làm Node thoát im lặng với mã 0: coi đó là lỗi.
let finished = false;
process.on('beforeExit', () => { if (!finished) { console.error('chat-persistence: treo (promise không bao giờ xong)'); process.exit(1); } });

const flush = () => new Promise(r => setTimeout(r, 30));
async function drain(res: Response) {
  const reader = res.body!.getReader();
  let out = '';
  for (;;) { const { done, value } = await reader.read(); if (done) break; out += new TextDecoder().decode(value); }
  return out;
}

async function main() {
  const { generateChart } = await import('../../lib/ziwei/algorithm');
  const { POST: interpret } = await import('../../app/api/interpret/route');
  const { POST: heming } = await import('../../app/api/heming/route');
  const chart = generateChart({ year: 1990, month: 3, day: 5, hour: 2, gender: 'male', name: 'Tên giả' } as never);
  const chartB = generateChart({ year: 1992, month: 8, day: 20, hour: 7, gender: 'female' } as never);
  const post = (fn: (r: Request) => Promise<Response>, path: string, payload: unknown) => fn(new Request(`http://localhost${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }));

  const store = createMemoryChatStore();
  setChatStoreForTest(store);

  // 1. Lịch sử 3 tin → chỉ tin user cuối được ghi.
  await drain(await post(interpret, '/api/interpret', {
    chart, intent: { type: 'topic', key: 'career' }, threadKey: 'career',
    messages: [{ role: 'user', content: 'Cũ' }, { role: 'assistant', content: 'Đáp cũ' }, { role: 'user', content: 'Câu mới' }],
  }));
  await flush();
  const [summary] = await store.listCharts(0);
  let detail = (await store.getChart(summary.id))!;
  assert.deepEqual(detail.conversations[0].messages.map(m => [m.role, m.content]), [['user', 'Câu mới'], ['assistant', 'Trả lời giả']]);
  assert.equal(detail.conversations[0].threadKey, 'career');
  const [log] = await store.listRequests({});
  assert.equal(log.status, 'ok');
  assert.equal(log.promptVersion, 'v2');
  assert.equal(log.model, 'fake/model');
  // birthInfo lưu chỉ gồm trường đã biết (không lưu dữ liệu tùy ý từ client).
  assert.equal((summary.birthInfo as Record<string, unknown>).palaces, undefined);
  assert.equal((summary.birthInfo as Record<string, unknown>).year, 1990);

  // 2. Đổi version → prompt v1 được dùng và ghi đúng version.
  await store.setSetting(ACTIVE_PROMPT_KEY, 'v1');
  await drain(await post(interpret, '/api/interpret', { chart, intent: { type: 'topic', key: 'career' }, threadKey: 'career', messages: [{ role: 'user', content: 'Hỏi v1' }] }));
  await flush();
  assert.ok(lastSystem.includes('cá nhân hóa bằng tên sao/cung cụ thể'));
  assert.equal((await store.listRequests({ promptVersion: 'v1' })).length, 1);
  await store.setSetting(ACTIVE_PROMPT_KEY, 'v2');

  // 3. Không gửi threadKey → suy từ intent; threadKey quá dài/lạ → suy từ intent.
  const threadOf = async (payload: Record<string, unknown>) => {
    await drain(await post(interpret, '/api/interpret', { chart, messages: [{ role: 'user', content: 'x' }], ...payload }));
    await flush();
    return (await store.getChart(summary.id))!.conversations.map(c => c.threadKey);
  };
  assert.ok((await threadOf({ intent: { type: 'palace', branch: 4 } })).includes('palace:4'));
  assert.ok((await threadOf({ intent: { type: 'topic', key: 'love' }, threadKey: 'x'.repeat(500) })).includes('love'));
  assert.ok((await threadOf({ intent: { type: 'sihua', view: 'mingpan', starName: '太阳', siHua: '禄' } })).includes('sihua:mingpan:太阳:禄'));

  // 4. Hợp bàn cùng cặp 2 lần → 1 conversation; câu hỏi rỗng lưu câu mặc định.
  await drain(await post(heming, '/api/heming', { chartA: chart, chartB }));
  await drain(await post(heming, '/api/heming', { chartA: chart, chartB, question: 'Còn tài chính?' }));
  await flush();
  detail = (await store.getChart(summary.id))!;
  const hm = detail.conversations.filter(c => c.kind === 'heming');
  assert.equal(hm.length, 1);
  assert.equal(hm[0].messages.length, 4);
  assert.match(hm[0].messages[0].content, /hợp duyên/);
  assert.equal(hm[0].messages[2].content, 'Còn tài chính?');

  // 4b. Lỗi dựng prompt/tool (lá số hỏng) → không để lại lượt 'pending' treo.
  const pendingBefore = (await store.listRequests({ status: 'pending' })).length;
  const badChart = { ...chart, palaces: [{}] }; // dựng prompt sẽ ném TypeError
  const bad = await post(interpret, '/api/interpret', { chart: badChart, messages: [{ role: 'user', content: 'x' }] }).catch(() => null);
  if (bad) await drain(bad).catch(() => undefined);
  await flush();
  assert.equal((await store.listRequests({ status: 'pending' })).length, pendingBefore, 'không có lượt pending treo');

  // 5. Store hỏng → chat vẫn chạy đủ.
  const broken: ChatStore = { ...createMemoryChatStore(), recordTurnStart: async () => { throw new Error('db down'); }, getSetting: async () => { throw new Error('db down'); } };
  setChatStoreForTest(broken);
  const res = await post(interpret, '/api/interpret', { chart, intent: { type: 'topic', key: 'career' }, messages: [{ role: 'user', content: 'x' }] });
  assert.equal(res.status, 200);
  const out = await drain(res);
  assert.match(out, /Trả lời giả/);
  assert.match(out, /\[DONE\]/);

  // 6. DB treo (không trả lời) → chat vẫn bắt đầu stream nhanh.
  const never = new Promise<never>(() => undefined);
  const hanging: ChatStore = { ...createMemoryChatStore(), getSetting: () => never, recordTurnStart: () => never };
  setChatStoreForTest(hanging);
  const t0 = Date.now();
  const res2 = await post(interpret, '/api/interpret', { chart, intent: { type: 'topic', key: 'career' }, messages: [{ role: 'user', content: 'x' }] });
  assert.match(await drain(res2), /Trả lời giả/);
  assert.ok(Date.now() - t0 < 3000, `DB treo làm chat chậm ${Date.now() - t0}ms`);

  setChatStoreForTest(null);
  finished = true;
  console.log('chat-persistence: ok');
}

main().catch(err => { console.error(err); process.exit(1); });
