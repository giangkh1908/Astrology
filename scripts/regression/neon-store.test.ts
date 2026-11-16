import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { ADMIN_HIDDEN, createMessageCipher, isEncrypted } from '../../lib/crypto/message-cipher';
import { createNeonChatStore } from '../../lib/store/neon-chat-store';
import { runChatStoreContract } from './chat-store-memory.test';

// Chạy hợp đồng ChatStore trên Postgres thật khi có TEST_DATABASE_URL (đã migrate). Không có thì bỏ qua.
// Dữ liệu giả, khóa lá số `test-<tag>-…`; dọn sạch các dòng của lần chạy này ở cuối.
async function main() {
  const url = process.env.TEST_DATABASE_URL?.trim();
  if (!url) { console.log('neon-store: skip (không có TEST_DATABASE_URL)'); return; }
  const tag = randomUUID().slice(0, 8);
  const sql = neon(url);
  const before = await sql`select value from settings where key = 'active_prompt_version'`;
  try {
    const cipher = createMessageCipher(randomBytes(32).toString('base64url'));
    await runChatStoreContract(createNeonChatStore(url, { cipher, revealToAdmin: false }), tag, () => ADMIN_HIDDEN);
    // Máy local tự bật xem: admin thấy đúng nội dung đã giải mã.
    await runChatStoreContract(createNeonChatStore(url, { cipher, revealToAdmin: true }), `${tag}-r`);
    // Trong DB chỉ còn bản mã: câu hỏi, câu trả lời, log câu hỏi, tham số tool.
    const raw = await sql`
      select m.content, r.question, r.tool_calls from messages m
      join conversations v on v.id = m.conversation_id join charts c on c.id = v.chart_id
      left join ai_requests r on r.id = m.request_id
      where c.chart_key like ${`test-${tag}-%`}`;
    assert.ok(raw.length > 0);
    for (const r of raw) {
      assert.ok(isEncrypted(String(r.content)), 'messages.content đã mã hoá');
      if (r.question !== null) assert.ok(isEncrypted(String(r.question)), 'ai_requests.question đã mã hoá');
      for (const t of (r.tool_calls as { arguments: string }[] | null) ?? []) assert.ok(isEncrypted(t.arguments), 'tool_calls đã mã hoá');
    }
    console.log('neon-store: ok');
  } finally {
    const charts = await sql`select id from charts where chart_key like ${`test-${tag}-%`}`;
    const ids = charts.map(c => String(c.id));
    if (ids.length) {
      const convs = (await sql`select id from conversations where chart_id = any(${ids}::uuid[]) or partner_chart_id = any(${ids}::uuid[])`).map(c => String(c.id));
      await sql.transaction([
        sql`delete from messages where conversation_id = any(${convs}::uuid[])`,
        sql`delete from ai_requests where conversation_id = any(${convs}::uuid[])`,
        sql`delete from conversations where id = any(${convs}::uuid[])`,
        sql`delete from charts where id = any(${ids}::uuid[])`,
      ]);
    }
    // Khôi phục version đang chạy như trước khi test.
    if (before.length) await sql`update settings set value = ${String(before[0].value)} where key = 'active_prompt_version'`;
    else await sql`delete from settings where key = 'active_prompt_version'`;
  }
}

main().catch(err => { console.error(err); process.exit(1); });
