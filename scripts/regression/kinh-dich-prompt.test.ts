import assert from 'node:assert/strict';
import { computeCast } from '../../lib/kinh-dich/core';
import { hexagramText } from '../../lib/kinh-dich/texts';
import { collectMemory, MAX_MEMORY_CHARS, MAX_MEMORY_ITEMS } from '../../lib/kinh-dich/memory';
import { buildPreparePrompt, buildReadingPrompt, NO_CHANGE_RULE, PREPARE_VERSION, READING_VERSION } from '../../lib/kinh-dich/prompt';
import type { CastSummary, MemoryNote } from '../../lib/kinh-dich/store';

// Dữ liệu giả
const cast = computeCast([9, 7, 7, 7, 7, 7]); // Càn hào 1 động → Cấu
const question = 'Có nên nhận lời mời làm việc ở công ty mới không?';
const reading = buildReadingPrompt(cast, question, []);
assert.equal(READING_VERSION, 'kd1');
assert.equal(PREPARE_VERSION, 'kd1-prepare');
assert.equal(NO_CHANGE_RULE.includes('không được tự đổi quẻ hay tự chế lời kinh'), true);
assert.ok(reading.includes(NO_CHANGE_RULE));
assert.ok(reading.includes(question));
assert.ok(reading.includes(hexagramText(1).lines[0].textHV), 'có hào từ của hào trọng tâm');
assert.ok(reading.includes(hexagramText(1).judgment), 'có Thoán quẻ chính');
assert.ok(reading.includes('Thiên Phong Cấu') || reading.includes(hexagramText(44).name), 'có tên quẻ biến');
assert.ok(reading.includes('theo bản dịch Ngô Tất Tố'));
assert.ok(!reading.includes('Những điều người dùng đã kể ở các lần gieo trước'), 'memory rỗng thì không có khối');
assert.ok(!reading.includes('hoi_nguoi_dung'), 'bài luận không hỏi lại');
assert.ok(reading.includes('Không trích nguyên văn lời kinh'), 'lời kinh đã hiện bên cạnh: bài luận chỉ diễn giải');
assert.ok(reading.includes('không viết chữ Hán'));
assert.ok(!reading.includes('Chỉ trích lời kinh'), 'bỏ yêu cầu trích nguyên văn');

// modern không được gắn tên Ngô Tất Tố: chỉ nằm dưới khóa riêng của dich-so
const json = JSON.parse(reading.slice(reading.indexOf('{', reading.indexOf('Dữ kiện quẻ (JSON):'))));
const modern = hexagramText(1).lines[0].modern;
const holders: string[] = [];
(function walk(v: unknown, path: string) {
  if (typeof v === 'string') { if (v === modern) holders.push(path); return; }
  if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
})(json, '$');
assert.ok(holders.length >= 1, 'có diễn giải hiện đại của hào trọng tâm');
for (const p of holders) assert.match(p, /diễn_giải_hiện_đại_dich_so/);
for (const item of json.lời_kinh) {
  assert.ok(typeof item.nguồn === 'string' && item.nguồn.length > 0);
  assert.ok(!JSON.stringify(item).includes(modern), 'lời kinh không chứa phần diễn giải hiện đại');
}
assert.equal(json.quẻ_chính.số, 1);
assert.deepEqual(json.hào_động, [1]);
assert.equal(json.quẻ_biến.số, 44);

// Trọng tâm khác: 0 hào động → không có quẻ biến, chỉ Thoán/Tượng
const still = buildReadingPrompt(computeCast([7, 8, 7, 8, 7, 8]), question, []);
assert.ok(still.includes('"quẻ_biến":null'));

// Càn 6 hào động → Dụng Cửu
const allMoving = buildReadingPrompt(computeCast([9, 9, 9, 9, 9, 9]), question, []);
assert.ok(allMoving.includes(hexagramText(1).extra!.textHV));

// Prompt làm rõ: không có dữ kiện quẻ
const prepare = buildPreparePrompt([]);
assert.ok(prepare.includes('hoi_nguoi_dung'));
assert.ok(prepare.includes('Câu hỏi đã rõ'));
for (const k of ['việc gì', 'cho ai', 'lựa chọn', 'khung thời gian']) assert.ok(prepare.includes(k), `prompt làm rõ thiếu tiêu chí "${k}"`);
assert.ok(!prepare.includes('Dữ kiện quẻ'));
assert.ok(!prepare.includes(hexagramText(1).judgment));

// Memory
const day = (d: number) => new Date(Date.UTC(2026, 9, d, 3)).toISOString();
const casts: CastSummary[] = [
  { castId: 'c2', question: 'Chuyển nhà tháng sau?', lines: null, castAt: null, createdAt: day(5) },
  { castId: 'c1', question: 'Có nên đổi việc?', lines: [9, 7, 7, 7, 7, 7], castAt: day(2), createdAt: day(2) },
];
const notes: MemoryNote[] = [
  { castId: 'c1', content: 'Trả lời câu hỏi:\n- Cho ai: Bản thân', createdAt: day(3) },
  { castId: 'c1', content: 'Có nên đổi việc?', createdAt: day(2) },
];
const mem = collectMemory({ casts, notes });
// Câu hỏi mở lần gieo đã nằm trong mục "quẻ đã gieo" → không lặp lại thành lời kể
assert.deepEqual(mem.map(m => m.loại), ['quẻ đã gieo', 'lời kể', 'quẻ đã gieo']);
assert.equal(mem[0].ngày, '02/10/2026');
assert.match(mem[0].nội_dung, /Có nên đổi việc\?/);
assert.match(mem[0].nội_dung, /Thuần Càn/);
assert.match(mem[0].nội_dung, /biến/);
assert.match(mem[2].nội_dung, /chưa gieo/);

// Giới hạn: tối đa 30 mục, 4000 ký tự, 500 ký tự mỗi mục, giữ mục mới nhất
const many: MemoryNote[] = Array.from({ length: 60 }, (_, i) => ({ castId: 'c', content: `lời kể ${59 - i} ` + 'x'.repeat(10), createdAt: day(1) }));
const capped = collectMemory({ casts: [], notes: many });
assert.equal(capped.length, MAX_MEMORY_ITEMS);
assert.match(capped.at(-1)!.nội_dung, /^lời kể 59 /, 'mới nhất ở cuối');
const long = collectMemory({ casts: [], notes: Array.from({ length: 20 }, () => ({ castId: 'c', content: 'y'.repeat(900), createdAt: day(1) })) });
assert.ok(long.every(m => m.nội_dung.length <= 500));
assert.ok(long.reduce((s, m) => s + m.nội_dung.length, 0) <= MAX_MEMORY_CHARS);

const withMem = buildReadingPrompt(cast, question, mem);
assert.ok(withMem.includes('Những điều người dùng đã kể ở các lần gieo trước'));
assert.ok(withMem.includes('Có nên đổi việc?'));
assert.ok(buildPreparePrompt(mem).includes('Những điều người dùng đã kể ở các lần gieo trước'));

console.log('kinh-dich-prompt: ok');
