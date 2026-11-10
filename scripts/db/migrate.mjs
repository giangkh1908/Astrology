// Chạy các file db/migrations/*.sql chưa chạy, theo thứ tự tên. Mỗi file chạy trong một transaction.
// Dùng: npm run db:migrate (đọc DATABASE_URL từ .env.local nếu có).
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error('Thiếu DATABASE_URL (đặt trong .env.local hoặc biến môi trường).');
  process.exit(1);
}
const sql = neon(url);
const dir = resolve(import.meta.dirname, '../../db/migrations');

/** Tách câu lệnh theo dấu ; cuối dòng (file migration không chứa hàm PL/pgSQL hay chuỗi có ;). */
function statements(text) {
  return text
    .split('\n').filter(line => !line.trim().startsWith('--')).join('\n')
    .split(/;\s*(?:\n|$)/).map(s => s.trim()).filter(Boolean);
}

try {
  await sql`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
  const done = new Set((await sql`select name from schema_migrations`).map(r => r.name));
  const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  let ran = 0;
  for (const file of files) {
    if (done.has(file)) continue;
    const stmts = statements(readFileSync(resolve(dir, file), 'utf8'));
    await sql.transaction([
      ...stmts.map(s => sql.query(s)),
      sql`insert into schema_migrations (name) values (${file})`,
    ]);
    console.log(`Đã chạy ${file} (${stmts.length} câu lệnh)`);
    ran++;
  }
  console.log(ran ? `Xong: ${ran} migration mới.` : 'Không có migration mới.');
} catch (error) {
  console.error('Migration thất bại:', error instanceof Error ? error.message : error);
  process.exit(1);
}
