import assert from 'node:assert/strict';
import { suggestionsFor } from '../../lib/chat/suggestions';

// Gợi ý câu hỏi tĩnh sau bài luận (prompt v3): theo chủ đề, chèn tháng giữa khung 3 tháng.
const w = { lunarYear: 2026, startMonth: 10 };

const career = suggestionsFor('career', w);
assert.ok(career.length >= 2 && career.length <= 3);
assert.ok(career.some(s => s.includes('tháng 11 âm')));

for (const key of ['love', 'wealth', 'health', 'overview', 'palace:3', 'sihua:x', 'lạ']) {
  const list = suggestionsFor(key, w);
  assert.ok(list.length >= 2 && list.length <= 3, key);
  assert.ok(list.every(s => s.trim().endsWith('?')), key);
}

// Khung vắt năm: tháng giữa là tháng 12
assert.ok(suggestionsFor('love', { lunarYear: 2026, startMonth: 11 }).some(s => s.includes('tháng 12 âm')));
// Khung 12, 1, 2: tháng giữa là tháng 1 năm sau
assert.ok(suggestionsFor('love', { lunarYear: 2026, startMonth: 12 }).some(s => s.includes('tháng 1 âm')));

// Tính cách không có thời gian → không gợi ý theo tháng
assert.deepEqual(suggestionsFor('personality', w), []);

console.log('suggestions: ok');
