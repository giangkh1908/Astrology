import assert from 'node:assert/strict';
import type { ChatStore, TurnStart } from '../../lib/store/chat-store';
import { createMemoryChatStore } from '../../lib/store/memory-chat-store';
import { setChatStoreForTest } from '../../lib/store';
import { envUserCookie } from './helpers/session';

// Mọi mục chat đọc được những điều người dùng đã tự gõ ở các mục khác của cùng tài khoản + lá số.
process.env.OPENROUTER_API_KEY = 'test-key';
process.env.OPENROUTER_MODEL = 'fake/model';

let lastSystem = '';
globalThis.fetch = (async (_u: unknown, init?: RequestInit) => {
  lastSystem = JSON.parse(String(init?.body)).messages[0].content;
  const enc = new TextEncoder();
  return new Response(new ReadableStream({
    start(c) {
      c.enqueue(enc.encode('data: {"choices":[{"delta":{"content":"Trả lời giả"}}]}\n\n'));
      c.enqueue(enc.encode('data: [DONE]\n\n'));
      c.close();
    },
  }), { status: 200 });
}) as typeof fetch;

let finished = false;
process.on('beforeExit', () => { if (!finished) { console.error('prior-notes: treo'); process.exit(1); } });

async function drain(res: Response) {
  const reader = res.body!.getReader();
  for (;;) { const { done } = await reader.read(); if (done) break; }
}

async function main() {
  const { generateChart } = await import('../../lib/ziwei/algorithm');
  const { chartRef } = await import('../../lib/store/persist-turn');
  const { collectPriorNotes, loadPriorNotes, threadLabel, MAX_PRIOR_NOTES, MAX_PRIOR_CHARS } = await import('../../lib/store/prior-notes');
  const { getPromptSet } = await import('../../lib/prompts');
  const { POST: interpret } = await import('../../app/api/interpret/route');
  const { POST: heming } = await import('../../app/api/heming/route');

  const chart = generateChart({ year: 1990, month: 3, day: 5, hour: 2, gender: 'male' } as never);
  const chartB = generateChart({ year: 1992, month: 8, day: 20, hour: 7, gender: 'female' } as never);
  const keyA = chartRef(chart.birthInfo).key;
  const label = (k: string) => threadLabel(k, chart);

  // Ghi một lượt hỏi đáp hoàn chỉnh vào store.
  const say = async (store: ChatStore, t: Partial<TurnStart> & { threadKey: string; question: string }) => {
    const { requestId } = await store.recordTurnStart({
      kind: 'interpret', chart: chartRef(chart.birthInfo), promptVersion: 'v2', model: 'fake', userId: null, ...t,
    });
    await store.recordTurnEnd(requestId, { text: 'Đáp', status: 'ok', toolCalls: [], durationMs: 1 });
  };

  // 1. Nhãn mục.
  assert.equal(threadLabel('love', chart), 'Tình cảm');
  assert.equal(threadLabel('overview', chart), 'Mệnh cách');
  assert.match(threadLabel('palace:0', chart), /^Cung /);
  assert.match(threadLabel('sihua:mingpan:太阳:禄', chart), /Thái Dương.*Lộc/);
  assert.equal(threadLabel('la-lam', chart), 'la-lam');

  // 2. Gom câu người dùng gõ ở mục khác: bỏ mục hiện tại, câu tự động, câu của người khác, tin trước mốc reset.
  const store = createMemoryChatStore();
  const auto = getPromptSet('v2').initialInterpretationQuestion({ type: 'topic', key: 'love' });
  await say(store, { threadKey: 'love', question: auto, hiddenQuestion: true });
  await say(store, { threadKey: 'love', question: 'Tôi đã có vợ, đang sống ở Đà Nẵng' });
  await say(store, { threadKey: 'career', question: 'Đang hỏi ở mục này' });
  await say(store, { threadKey: 'wealth', question: 'Câu đã đóng mục' });
  await store.closeThread({ kind: 'interpret', chartKey: keyA, partnerKey: null, userId: null, threadKey: 'wealth' });
  await say(store, { threadKey: 'health', question: 'Câu của tài khoản khác', userId: '00000000-0000-4000-8000-000000000001' });
  // Dữ liệu cũ chưa có cờ hidden: câu tự động vẫn bị nhận ra.
  await say(store, { threadKey: 'personality', question: getPromptSet('v1').initialInterpretationQuestion({ type: 'topic', key: 'personality' }) });

  const notes = await loadPriorNotes(store, { kind: 'interpret', chartKey: keyA, partnerKey: null, userId: null }, { excludeThreadKey: 'career', label });
  assert.deepEqual(notes.map(n => [n.mục, n.lời_kể]), [['Tình cảm', 'Tôi đã có vợ, đang sống ở Đà Nẵng']]);
  assert.match(notes[0].ngày, /^\d{2}\/\d{2}\/\d{4}$/);

  // 3. Giới hạn số câu và tổng ký tự; giữ câu mới nhất, trả theo thứ tự cũ → mới.
  // Đầu vào mới nhất trước (như loadUserQuestions).
  const newestFirst = (n: number, text: (i: number) => string) => Array.from({ length: n }, (_, k) => {
    const i = n - 1 - k;
    return { threadKey: 'love', content: text(i), createdAt: new Date(Date.UTC(2026, 0, 1 + i)).toISOString() };
  });
  const capped = collectPriorNotes(newestFirst(50, i => `Câu ${i}`), { label });
  assert.equal(capped.length, MAX_PRIOR_NOTES);
  assert.equal(capped.at(-1)!.lời_kể, 'Câu 49');
  assert.equal(capped[0].lời_kể, `Câu ${50 - MAX_PRIOR_NOTES}`);
  assert.equal(capped.at(-1)!.ngày, '19/02/2026', 'ngày theo từng câu, không theo mục');
  const trimmed = collectPriorNotes(newestFirst(20, i => `${i} ${'x'.repeat(2000)}`), { label });
  assert.ok(trimmed.reduce((n, x) => n + x.lời_kể.length, 0) <= MAX_PRIOR_CHARS);
  assert.ok(trimmed.length >= 1 && trimmed.at(-1)!.lời_kể.startsWith('19 '));

  // 4. Store tắt, lỗi hoặc treo → rỗng, không chờ lâu.
  const off = { ...createMemoryChatStore(), enabled: false };
  assert.deepEqual(await loadPriorNotes(off, { kind: 'interpret', chartKey: keyA, userId: null }, { label }), []);
  const broken = { ...createMemoryChatStore(), loadUserQuestions: async () => { throw new Error('db down'); } };
  assert.deepEqual(await loadPriorNotes(broken, { kind: 'interpret', chartKey: keyA, userId: null }, { label }), []);
  const hanging = { ...createMemoryChatStore(), loadUserQuestions: () => new Promise<never>(() => undefined) };
  const t0 = Date.now();
  assert.deepEqual(await loadPriorNotes(hanging, { kind: 'interpret', chartKey: keyA, userId: null }, { label, timeoutMs: 50 }), []);
  assert.ok(Date.now() - t0 < 1000);

  // 5. Prompt: có khối khi có ghi chú, không có khi rỗng; hợp bàn có riêng cho A và B.
  for (const v of ['v1', 'v2'] as const) {
    const p = getPromptSet(v);
    const intent = { type: 'topic' as const, key: 'career' };
    assert.ok(p.buildInterpretationSystemPrompt(chart, intent, {}, notes).includes('Tôi đã có vợ, đang sống ở Đà Nẵng'));
    assert.ok(!p.buildInterpretationSystemPrompt(chart, intent, {}, []).includes('các mục khác'));
    const c = p.buildCompatibilitySystemPrompt(chart, chartB, { a: notes, b: [] });
    assert.ok(c.includes('Người A đã tự kể'));
    assert.ok(!c.includes('Người B đã tự kể'));
  }

  // 6. Route luận: mục Sự nghiệp thấy điều đã kể ở mục Tình cảm.
  setChatStoreForTest(store);
  const post = async (fn: (r: Request) => Promise<Response>, path: string, payload: unknown) => fn(new Request(`http://localhost${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', cookie: await envUserCookie() }, body: JSON.stringify(payload),
  }));
  await drain(await post(interpret, '/api/interpret', {
    chart, intent: { type: 'topic', key: 'career' }, threadKey: 'career', messages: [{ role: 'user', content: 'Năm nay công việc thế nào?' }],
  }));
  assert.ok(lastSystem.includes('Tôi đã có vợ, đang sống ở Đà Nẵng'));
  assert.ok(!lastSystem.includes('Đang hỏi ở mục này'), 'không lặp mục hiện tại');

  // 7. Route hợp bàn: đọc lời kể ở /chart của Người A.
  await drain(await post(heming, '/api/heming', { chartA: chart, chartB }));
  assert.ok(lastSystem.includes('Tôi đã có vợ, đang sống ở Đà Nẵng'));

  setChatStoreForTest(null);
  finished = true;
  console.log('prior-notes: ok');
}

main().catch(err => { console.error(err); process.exit(1); });
