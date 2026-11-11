import assert from 'node:assert/strict';
import { ACTIVE_PROMPT_KEY, resolvePromptVersion, type ChatStore, type TurnStart } from '../../lib/store/chat-store';
import { createMemoryChatStore } from '../../lib/store/memory-chat-store';
import { chartKey } from '../../lib/ziwei/chart-key';

// Hợp đồng ChatStore (bản bộ nhớ). neon-store.test.ts chạy lại cùng kịch bản trên Postgres thật.
export async function runChatStoreContract(store: ChatStore, tag: string) {
  const birthA = { year: 1990, month: 3, day: 5, hour: 2, gender: 'male', name: `fake-${tag}` };
  const birthB = { year: 1992, month: 8, day: 20, hour: 7, gender: 'female' };
  const keyA = `test-${tag}-a`;
  const keyB = `test-${tag}-b`;
  const turn = (over: Partial<TurnStart> = {}): TurnStart => ({
    kind: 'interpret', chart: { key: keyA, birthInfo: birthA }, threadKey: 'career',
    question: 'Câu hỏi giả', promptVersion: 'v2', model: 'fake/model', ...over,
  });

  const r1 = await store.recordTurnStart(turn({ question: 'Hỏi 1' }));
  await store.recordTurnEnd(r1.requestId, { text: 'Đáp 1', status: 'ok', toolCalls: [{ name: 'xem_van_han', arguments: '{"nam":2026}' }], durationMs: 1200, firstTokenMs: 300, usage: { promptTokens: 10, completionTokens: 5, costUsd: 0.0001 } });
  const r2 = await store.recordTurnStart(turn({ question: 'Hỏi 2', promptVersion: 'v1' }));
  await store.recordTurnEnd(r2.requestId, { text: 'Đáp dở', status: 'aborted', toolCalls: [], durationMs: 500 });

  const charts = await store.listCharts(0);
  const summary = charts.find(c => c.key === keyA)!;
  assert.ok(summary, 'lá số đã được lưu');
  assert.equal(summary.conversationCount, 1);

  const detail = (await store.getChart(summary.id))!;
  assert.equal(detail.conversations.length, 1);
  const msgs = detail.conversations[0].messages;
  assert.deepEqual(msgs.map(m => [m.role, m.content]), [['user', 'Hỏi 1'], ['assistant', 'Đáp 1'], ['user', 'Hỏi 2'], ['assistant', 'Đáp dở']]);
  assert.equal(msgs[1].promptVersion, 'v2');
  assert.equal(msgs[3].promptVersion, 'v1');
  assert.equal(msgs[3].status, 'aborted');
  assert.equal(detail.conversations[0].threadKey, 'career');
  assert.equal(await store.getChart('00000000-0000-0000-0000-000000000000'), null);
  assert.equal(await store.getChart('not-a-uuid'), null, 'id lạ không làm lỗi');

  // Hợp bàn cùng cặp hai lần → một conversation.
  for (const q of ['Hợp không?', 'Còn tài chính?']) {
    const r = await store.recordTurnStart(turn({ kind: 'heming', partnerChart: { key: keyB, birthInfo: birthB }, threadKey: 'heming', question: q }));
    await store.recordTurnEnd(r.requestId, { text: 'ok', status: 'ok', toolCalls: [], durationMs: 10 });
  }
  const detail2 = (await store.getChart(summary.id))!;
  const heming = detail2.conversations.filter(c => c.kind === 'heming');
  assert.equal(heming.length, 1);
  assert.equal(heming[0].messages.length, 4);
  assert.deepEqual(heming[0].partner?.birthInfo, birthB);

  // Hợp bàn một lá số với chính nó → vẫn ghi được (Postgres không cho upsert cùng dòng 2 lần trong 1 câu lệnh).
  const self = await store.recordTurnStart(turn({ kind: 'heming', partnerChart: { key: keyA, birthInfo: birthA }, threadKey: 'heming', question: 'Tự hợp?' }));
  await store.recordTurnEnd(self.requestId, { text: 'ok', status: 'ok', toolCalls: [], durationMs: 10 });
  const selfConv = (await store.getChart(summary.id))!.conversations.find(c => c.kind === 'heming' && c.messages.some(m => m.content === 'Tự hợp?'));
  assert.ok(selfConv, 'hợp bàn với chính mình được ghi');
  assert.equal(selfConv!.partner?.id, summary.id);

  // Log
  const logs = await store.listRequests({ promptVersion: 'v1' });
  const mine = logs.find(l => l.id === r2.requestId)!;
  assert.equal(mine.status, 'aborted');
  assert.equal(mine.question, 'Hỏi 2');
  assert.equal(mine.answer, 'Đáp dở');
  const okLog = (await store.listRequests({ status: 'ok' })).find(l => l.id === r1.requestId)!;
  assert.equal(okLog.promptTokens, 10);
  assert.equal(okLog.costUsd, 0.0001);
  assert.deepEqual(okLog.toolCalls, [{ name: 'xem_van_han', arguments: '{"nam":2026}' }]);
  assert.equal(okLog.chartId, summary.id);
  assert.ok(!(await store.listRequests({ status: 'ok' })).some(l => l.id === r2.requestId));

  const usage = await store.versionUsage();
  assert.ok((usage.find(u => u.promptVersion === 'v2')?.count ?? 0) >= 3);
  assert.ok((usage.find(u => u.promptVersion === 'v1')?.count ?? 0) >= 1);

  // Lịch sử nạp lại (chủ sở hữu null = tài khoản env): lượt mở đầu đặt mốc reset, đóng mục thì không nạp lại.
  const keyH = `test-${tag}-h`;
  const ht = (over: Partial<TurnStart>) => turn({ chart: { key: keyH, birthInfo: birthA }, threadKey: 'overview', ...over });
  const end = async (id: string, text: string) => store.recordTurnEnd(id, { text, status: 'ok', toolCalls: [], durationMs: 1 });
  const q = { kind: 'interpret' as const, chartKey: keyH, userId: null };
  await end((await store.recordTurnStart(ht({ question: 'Tự động 1', fresh: true, hiddenQuestion: true }))).requestId, 'Đáp 1');
  await end((await store.recordTurnStart(ht({ question: 'Hỏi tiếp' }))).requestId, 'Đáp 2');
  let hist = await store.loadHistory(q);
  assert.deepEqual(hist.map(t => t.messages.map(m => [m.content, !!m.hidden])), [[['Tự động 1', true], ['Đáp 1', false], ['Hỏi tiếp', false], ['Đáp 2', false]]]);
  await end((await store.recordTurnStart(ht({ question: 'Tự động 2', fresh: true, hiddenQuestion: true }))).requestId, 'Đáp mới');
  hist = await store.loadHistory(q);
  assert.deepEqual(hist[0].messages.map(m => m.content), ['Tự động 2', 'Đáp mới'], 'luận lại bỏ lượt cũ');
  await end((await store.recordTurnStart(ht({ threadKey: 'career', question: 'Nghề?', fresh: true }))).requestId, 'Nghề hợp');
  assert.deepEqual((await store.loadHistory(q)).map(t => t.threadKey), ['overview', 'career']);
  await store.closeThread({ ...q, threadKey: 'career' });
  assert.deepEqual((await store.loadHistory(q)).map(t => t.threadKey), ['overview']);
  assert.deepEqual(await store.loadHistory({ ...q, kind: 'heming', partnerKey: keyB }), []);
  await end((await store.recordTurnStart(ht({ kind: 'heming', threadKey: 'heming', partnerChart: { key: keyB, birthInfo: birthB }, question: 'Hợp?', fresh: true }))).requestId, 'Hợp');
  assert.equal((await store.loadHistory({ ...q, kind: 'heming', partnerKey: keyB }))[0].messages[1].content, 'Hợp');
  assert.deepEqual(await store.loadHistory({ ...q, kind: 'heming', partnerKey: keyA }), [], 'cặp khác');

  // Version đang chạy
  await store.setSetting(ACTIVE_PROMPT_KEY, 'v1');
  assert.equal(await resolvePromptVersion(store, {}), 'v1');
  await store.setSetting(ACTIVE_PROMPT_KEY, 'v9');
  assert.equal(await resolvePromptVersion(store, {}), 'v2', 'giá trị lạ → mặc định');
  await store.setSetting(ACTIVE_PROMPT_KEY, 'v2');
}

async function main() {
  await runChatStoreContract(createMemoryChatStore(), 'mem');

  const broken = { ...createMemoryChatStore(), getSetting: async () => { throw new Error('db down'); } } as ChatStore;
  assert.equal(await resolvePromptVersion(broken, {}), 'v2');
  assert.equal(await resolvePromptVersion(broken, { DEFAULT_PROMPT_VERSION: 'v1' }), 'v1');

  assert.equal(chartKey({ year: 1990, month: 3, day: 5, hour: 2, gender: 'male', lunarTimeZone: 7 } as never), '1990-3-5-2-male-7');
  assert.equal(chartKey({ year: 1990, month: 3, day: 5, hour: 2, gender: 'female' } as never), '1990-3-5-2-female-8');
  assert.equal(chartKey({ year: 1990, month: 3, day: 5, hour: 2, gender: 'male', twinMethod: 'huynh_de' } as never), '1990-3-5-2-male-8-twin-huynh_de');
  // Dữ liệu client gửi lên là không tin cậy: key chỉ gồm số và giá trị hợp lệ.
  assert.equal(chartKey({ year: '1990; drop', month: 3, day: 5, hour: 2, gender: '<b>', twinMethod: 'x' } as never), 'NaN-3-5-2-unknown-8');
  console.log('chat-store-memory: ok');
}

if (process.argv[1]?.includes('chat-store-memory')) main().catch(err => { console.error(err); process.exit(1); });
