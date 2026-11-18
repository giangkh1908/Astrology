import assert from 'node:assert/strict';
import { recordTurnEndSql } from '../../lib/store/neon-chat-store';
import { createMessageCipher } from '../../lib/crypto/message-cipher';

// DB prod chưa chạy migration 005 (thiếu cột ai_requests.cached_tokens): vẫn phải lưu tin trả lời (ghi lại không có cột đó).
async function main() {
  const queries: string[] = [];
  let missingColumn = true;
  const sql = ((strings: TemplateStringsArray) => {
    const q = strings.join('?');
    queries.push(q);
    if (missingColumn && q.includes('cached_tokens')) return Promise.reject(new Error('column "cached_tokens" of relation "ai_requests" does not exist'));
    return Promise.resolve([]);
  }) as never;
  const cipher = createMessageCipher(undefined);
  const id = '00000000-0000-4000-8000-000000000001';
  const turn = { status: 'ok', text: 'trả lời', toolCalls: [], durationMs: 10, usage: { promptTokens: 1, completionTokens: 2, cachedTokens: 3 } } as never;
  const err = console.error;
  console.error = () => undefined;
  try {
    await recordTurnEndSql(sql, id, turn, cipher);
  } finally { console.error = err; }
  assert.equal(queries.length, 2, 'thử lại một lần');
  assert.ok(!queries[1].includes('cached_tokens'));
  assert.ok(queries[1].includes('insert into messages'), 'lần thử lại vẫn lưu tin trả lời');

  // Có cột: một câu lệnh, có cached_tokens.
  missingColumn = false; queries.length = 0;
  await recordTurnEndSql(sql, id, turn, cipher);
  assert.equal(queries.length, 1);
  assert.ok(queries[0].includes('cached_tokens'));

  // Lỗi khác: không nuốt.
  const bad = (() => Promise.reject(new Error('connection reset'))) as never;
  await assert.rejects(recordTurnEndSql(bad, id, turn, cipher), /connection reset/);
  console.log('turn-end-cached-fallback: ok');
}

main().catch(e => { console.error(e); process.exit(1); });
