/**
 * Mã hoá tin nhắn cũ còn lưu chữ thường: messages.content, ai_requests.question, ai_requests.tool_calls[].arguments,
 * conversations.meta.question (Kinh Dịch). Chạy lại nhiều lần an toàn (bỏ qua giá trị đã có tiền tố enc:v1:).
 *
 *   npm run db:encrypt            # chỉ đếm, không ghi
 *   npm run db:encrypt -- --apply # mã hoá thật
 *
 * Cần DATABASE_URL và MESSAGE_ENCRYPTION_KEY (đúng khoá đang dùng trên production). Không in nội dung tin nhắn.
 */
import { neon } from '@neondatabase/serverless';
import { createMessageCipher, isEncrypted } from '../../lib/crypto/message-cipher';

const BATCH = 200;

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  const key = process.env.MESSAGE_ENCRYPTION_KEY?.trim();
  if (!url || !key) throw new Error('Cần DATABASE_URL và MESSAGE_ENCRYPTION_KEY.');
  const apply = process.argv.includes('--apply');
  const cipher = createMessageCipher(key);
  const sql = neon(url);

  // Tự kiểm khoá: mã hoá rồi giải mã lại được.
  if (await cipher.open(await cipher.seal('kiểm tra')) !== 'kiểm tra') throw new Error('Khoá không dùng được.');

  const counts = await sql`
    select
      (select count(*) from messages where content not like 'enc:v1:%') as messages,
      (select count(*) from ai_requests where question is not null and question not like 'enc:v1:%') as questions,
      (select count(*) from ai_requests where exists (
         select 1 from jsonb_array_elements(case when jsonb_typeof(tool_calls) = 'array' then tool_calls else '[]'::jsonb end) t
         where t->>'arguments' not like 'enc:v1:%')) as tool_calls,
      (select count(*) from conversations where meta ? 'question' and meta->>'question' not like 'enc:v1:%') as casts`;
  console.log('Còn chữ thường:', counts[0]);
  if (!apply) { console.log('Chạy lại với --apply để mã hoá.'); return; }

  let n = 0;
  for (;;) {
    const rows = await sql`select id, content from messages where content not like 'enc:v1:%' order by id limit ${BATCH}`;
    if (!rows.length) break;
    for (const r of rows) {
      await sql`update messages set content = ${await cipher.seal(String(r.content))}
        where id = ${r.id} and content not like 'enc:v1:%'`;
    }
    n += rows.length;
    console.log(`messages: ${n}`);
  }

  n = 0;
  for (;;) {
    const rows = await sql`
      select id, question, tool_calls from ai_requests
      where (question is not null and question not like 'enc:v1:%')
         or exists (select 1 from jsonb_array_elements(case when jsonb_typeof(tool_calls) = 'array' then tool_calls else '[]'::jsonb end) t
                    where t->>'arguments' not like 'enc:v1:%')
      limit ${BATCH}`;
    if (!rows.length) break;
    for (const r of rows) {
      const q = r.question === null ? null : String(r.question);
      const question = q === null || isEncrypted(q) ? q : await cipher.seal(q);
      const tools = Array.isArray(r.tool_calls)
        ? await Promise.all((r.tool_calls as { name: string; arguments: string }[]).map(async t => ({
            ...t, arguments: isEncrypted(String(t.arguments ?? '')) ? t.arguments : await cipher.seal(String(t.arguments ?? '')),
          })))
        : r.tool_calls;
      await sql`update ai_requests set question = ${question}, tool_calls = ${JSON.stringify(tools)}::jsonb where id = ${r.id}`;
    }
    n += rows.length;
    console.log(`ai_requests: ${n}`);
  }

  n = 0;
  for (;;) {
    const rows = await sql`
      select id, meta->>'question' as question from conversations
      where meta ? 'question' and meta->>'question' not like 'enc:v1:%' limit ${BATCH}`;
    if (!rows.length) break;
    for (const r of rows) {
      await sql`update conversations set meta = jsonb_set(meta, '{question}', to_jsonb(${await cipher.seal(String(r.question))}::text))
        where id = ${r.id}`;
    }
    n += rows.length;
    console.log(`conversations (Kinh Dịch): ${n}`);
  }
  console.log('Xong.');
}

main().catch(err => { console.error(err instanceof Error ? err.message : err); process.exit(1); });
