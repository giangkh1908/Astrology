import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMemoryKinhDichStore } from '../../lib/kinh-dich/store-memory';
import type { KinhDichStore } from '../../lib/kinh-dich/store';

// Hợp đồng KinhDichStore (bản bộ nhớ). Dữ liệu giả.
export async function runKinhDichStoreContract(store: KinhDichStore, owner: string | null, other: string | null) {
  const { castId } = await store.createCast(owner, 'Có nên nhận việc mới không?');
  assert.match(castId, /^[0-9a-f-]{36}$/);
  const fresh = (await store.getCast(owner, castId))!;
  assert.equal(fresh.question, 'Có nên nhận việc mới không?');
  assert.equal(fresh.lines, null);
  assert.equal(fresh.castAt, null);
  assert.deepEqual(fresh.messages, []);
  assert.equal(fresh.lastAssistantStatus, null);
  assert.equal(fresh.assistantCount, 0);
  assert.equal(await store.getCast(other, castId), null, 'chủ khác không đọc được');
  assert.equal(await store.getCast(owner, '00000000-0000-0000-0000-000000000000'), null);
  assert.equal(await store.getCast(owner, 'không-phải-uuid'), null);

  // Lượt làm rõ: AI hỏi lại → status asked
  const t1 = await store.recordTurnStart(owner, castId, { question: 'Có nên nhận việc mới không?', hidden: false, promptVersion: 'kd1-prepare', model: 'fake/model' });
  await store.recordTurnEnd(t1.requestId, { text: 'Hỏi thêm <!--ask:{}-->', status: 'ok', asked: true, toolCalls: [], durationMs: 10 });
  let rec = (await store.getCast(owner, castId))!;
  assert.equal(rec.lastAssistantStatus, 'asked');
  assert.equal(rec.assistantCount, 1);
  const t2 = await store.recordTurnStart(owner, castId, { question: 'Trả lời câu hỏi:\n- Cho ai: Bản thân', hidden: false, promptVersion: 'kd1-prepare', model: 'fake/model' });
  await store.recordTurnEnd(t2.requestId, { text: 'Câu hỏi đã rõ.', status: 'ok', toolCalls: [], durationMs: 10 });
  rec = (await store.getCast(owner, castId))!;
  assert.equal(rec.lastAssistantStatus, 'ok');
  assert.equal(rec.assistantCount, 2);
  assert.deepEqual(rec.messages.map(m => m.role), ['user', 'assistant', 'user', 'assistant']);

  // Lưu quẻ: chỉ lần đầu
  assert.equal(await store.saveLines(other, castId, [7, 7, 7, 7, 7, 7]), false, 'chủ khác không lưu được');
  assert.equal(await store.saveLines(owner, castId, [9, 7, 7, 7, 7, 8]), true);
  assert.equal(await store.saveLines(owner, castId, [6, 6, 6, 6, 6, 6]), false);
  rec = (await store.getCast(owner, castId))!;
  assert.deepEqual(rec.lines, [9, 7, 7, 7, 7, 8]);
  assert.ok(rec.castAt);

  // Lượt luận có câu hỏi ẩn
  const t3 = await store.recordTurnStart(owner, castId, { question: 'Hãy luận quẻ', hidden: true, promptVersion: 'kd1', model: 'fake/model' });
  await store.recordTurnEnd(t3.requestId, { text: 'Bài luận giả', status: 'ok', toolCalls: [], durationMs: 10 });
  rec = (await store.getCast(owner, castId))!;
  assert.deepEqual(rec.messages.at(-2), { role: 'user', content: 'Hãy luận quẻ', hidden: true });

  // Lần gieo thứ hai + của chủ khác
  const second = await store.createCast(owner, 'Chuyển nhà tháng sau được không?');
  const t4 = await store.recordTurnStart(owner, second.castId, { question: 'Chuyển nhà tháng sau được không?', hidden: false, promptVersion: 'kd1-prepare', model: 'fake/model' });
  await store.recordTurnEnd(t4.requestId, { text: 'ok', status: 'ok', toolCalls: [], durationMs: 10 });
  const foreign = await store.createCast(other, 'Câu của người khác');
  await store.recordTurnStart(other, foreign.castId, { question: 'Câu của người khác', hidden: false, promptVersion: 'kd1-prepare', model: 'fake/model' });

  const list = await store.listCasts(owner, 10);
  assert.deepEqual(list.map(c => c.castId), [second.castId, castId], 'mới nhất trước, không lẫn chủ khác');
  assert.deepEqual(list[1].lines, [9, 7, 7, 7, 7, 8]);
  assert.equal((await store.listCasts(owner, 1)).length, 1);

  const mem = await store.loadMemoryRows(owner, second.castId, 50);
  assert.deepEqual(mem.casts.map(c => c.castId), [castId], 'bỏ lần gieo hiện tại');
  assert.deepEqual(mem.notes.map(n => n.content), ['Trả lời câu hỏi:\n- Cho ai: Bản thân', 'Có nên nhận việc mới không?'], 'mới nhất trước, bỏ tin ẩn');
  assert.ok(mem.notes.every(n => n.castId === castId));
  const memAll = await store.loadMemoryRows(owner, null, 50);
  assert.equal(memAll.casts.length, 2);
}

async function main() {
  await runKinhDichStoreContract(createMemoryKinhDichStore(), null, '11111111-1111-4111-8111-111111111111');
  await runKinhDichStoreContract(createMemoryKinhDichStore(), '22222222-2222-4222-8222-222222222222', null);

  // Migration 004: thêm kind, chart_id null chỉ cho kinhdich, cột meta
  const sql = readFileSync('db/migrations/004_kinh_dich.sql', 'utf8');
  assert.match(sql, /'kinhdich'/);
  assert.match(sql, /alter column chart_id drop not null/i);
  assert.match(sql, /\(kind = 'kinhdich'\) = \(chart_id is null\)/);
  assert.match(sql, /add column if not exists meta jsonb/i);
  console.log('kinh-dich-store: ok');
}

main().catch(e => { console.error(e); process.exit(1); });
