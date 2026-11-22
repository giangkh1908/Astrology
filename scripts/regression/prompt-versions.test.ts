import assert from 'node:assert/strict';
import { defaultPromptVersion, getPromptSet, PROMPT_VERSIONS, usesTimeWindow } from '../../lib/prompts';
import { VERIFY_QUESTION } from '../../lib/prompts/shared';
import { generateChart } from '../../lib/ziwei/algorithm';

// v1 = prompt trước khi đổi cách trình bày (nêu tên sao làm căn cứ); v2 = nói theo cung, kết luận chi tiết.
const chart = generateChart({ year: 1990, month: 3, day: 5, hour: 2, gender: 'male' } as never);
const twin = generateChart({ year: 1990, month: 3, day: 5, hour: 2, gender: 'male', twinMethod: 'huynh_de' } as never);
const intent = { type: 'topic' as const, key: 'career' };

assert.deepEqual(PROMPT_VERSIONS.map(v => v.id), ['v1', 'v2', 'v3', 'v4']);

const v1 = getPromptSet('v1');
const v2 = getPromptSet('v2');

const p1 = v1.buildInterpretationSystemPrompt(chart, intent, {});
const p2 = v2.buildInterpretationSystemPrompt(chart, intent, {});
assert.ok(p1.includes('cá nhân hóa bằng tên sao/cung cụ thể'));
assert.ok(!p1.includes('KHÔNG nhắc tên sao'));
assert.ok(p1.includes('rồi đưa căn cứ theo tầng và chỉ ra thời điểm nổi bật'));
assert.ok(p2.includes('KHÔNG nhắc tên sao'));
assert.ok(!p2.includes('cá nhân hóa bằng tên sao/cung cụ thể'));
// Phần chung (công cụ, dữ kiện) giữ nguyên ở cả hai bản.
for (const p of [p1, p2]) {
  assert.ok(p.includes('xem_van_han'));
  assert.ok(p.includes('Dữ kiện lá số (JSON):'));
}

for (const v of [v1, v2]) assert.equal(v.initialInterpretationQuestion({ type: 'topic', key: 'kiem_chung' }), VERIFY_QUESTION);
assert.ok(v1.initialInterpretationQuestion(intent).includes('nêu cấu hình cung và sao cụ thể làm căn cứ'));
assert.ok(v2.initialInterpretationQuestion(intent).includes('tam phương tứ chính cung Quan Lộc'));
assert.ok(v1.initialInterpretationQuestion({ type: 'palace', branch: 3 }).includes('chỉ ra các sao và liên hệ tam phương tứ chính làm căn cứ'));

const c1 = v1.buildCompatibilitySystemPrompt(chart, twin);
const c2 = v2.buildCompatibilitySystemPrompt(chart, twin);
assert.ok(!c1.includes('Cách trình bày: KHÔNG nhắc tên sao'));
assert.ok(c2.includes('Cách trình bày: KHÔNG nhắc tên sao'));
assert.equal(v1.defaultCompatibilityQuestion, v2.defaultCompatibilityQuestion);

// Dữ kiện sinh đôi nằm trong phần dữ kiện dùng chung, cả hai bản đều có.
for (const set of [v1, v2]) {
  assert.ok(set.buildInterpretationSystemPrompt(twin, intent, {}).includes('lá_số_sinh_đôi'));
}

assert.equal(defaultPromptVersion({}), 'v2');
assert.equal(defaultPromptVersion({ DEFAULT_PROMPT_VERSION: 'v1' }), 'v1');
assert.equal(defaultPromptVersion({ DEFAULT_PROMPT_VERSION: 'v9' }), 'v2');

// v3: hỏi lại TRƯỚC khi luận (tool hoi_nguoi_dung), luận khung 3 tháng âm lịch, có tính sẵn lưu nguyệt.
const v3 = getPromptSet('v3');
const p3 = v3.buildInterpretationSystemPrompt(chart, intent, { window: { lunarYear: 2026, startMonth: 10 } });
assert.ok(p3.includes('hoi_nguoi_dung'));
assert.ok(p3.includes('Dữ kiện lưu nguyệt khung 3 tháng (JSON):'));
assert.ok(p3.includes('tháng 10'));
assert.ok(p3.includes('KHÔNG nhắc tên sao'), 'v3 dựa trên v2');
assert.ok(!p3.includes('Hỏi lại tối đa một câu'));
assert.ok(!p3.includes('Cách luận vận hạn cho sâu'));
for (const p of [p1, p2]) {
  assert.ok(p.includes('Hỏi lại tối đa một câu'));
  assert.ok(p.includes('Cách luận vận hạn cho sâu'));
  assert.ok(!p.includes('hoi_nguoi_dung'));
  assert.ok(!p.includes('Dữ kiện lưu nguyệt khung 3 tháng'));
}
assert.ok(v3.initialInterpretationQuestion({ type: 'topic', key: 'career' }).includes('3 tháng'));
assert.ok(v3.initialInterpretationQuestion({ type: 'palace', branch: 3 }).includes('3 tháng'));
assert.ok(!v3.initialInterpretationQuestion({ type: 'topic', key: 'personality' }).includes('3 tháng'));
assert.equal(v3.initialInterpretationQuestion({ type: 'topic', key: 'kiem_chung' }), VERIFY_QUESTION);
const p3k = v3.buildInterpretationSystemPrompt(chart, { type: 'topic', key: 'kiem_chung' }, { window: { lunarYear: 2026, startMonth: 10 } });
assert.ok(!p3k.includes('Dữ kiện lưu nguyệt khung 3 tháng (JSON):'));
const p3p = v3.buildInterpretationSystemPrompt(chart, { type: 'topic', key: 'personality' }, { window: { lunarYear: 2026, startMonth: 10 } });
assert.ok(!p3p.includes('Dữ kiện lưu nguyệt khung 3 tháng (JSON):'));
assert.ok(p3p.includes('hoi_nguoi_dung'));
// Khung vắt năm: tháng 11/2026 → 1/2027
const p3y = v3.buildInterpretationSystemPrompt(chart, intent, { window: { lunarYear: 2026, startMonth: 11 } });
const facts = JSON.parse(p3y.split('Dữ kiện lưu nguyệt khung 3 tháng (JSON):\n\n')[1].split('\n\n')[0]);
assert.ok(facts.khung_đang_chọn.startsWith('tháng 11/2026 – 1/2027 âm'));
assert.deepEqual(facts.các_tháng.map((f: { năm_âm_lịch: number; tháng_âm: number }) => [f.năm_âm_lịch, f.tháng_âm]), [[2026, 11], [2026, 12], [2027, 1]]);
assert.ok(facts.các_tháng[0].lưu_nguyệt.dương_lịch);

// v4: như v3 + gói luật chủ đề; Kiểm chứng không có khung 3 tháng.
const v4 = getPromptSet('v4');
const win = { window: { lunarYear: 2026, startMonth: 10 } };
const p4l = v4.buildInterpretationSystemPrompt(chart, { type: 'topic', key: 'love' }, win);
assert.ok(p4l.includes('Gói luật Tình duyên'));
assert.ok(p4l.includes('hoi_nguoi_dung'));
const p4k = v4.buildInterpretationSystemPrompt(chart, { type: 'topic', key: 'kiem_chung' }, win);
assert.ok(p4k.includes('Gói luật Kiểm chứng'));
assert.ok(!p4k.includes('Dữ kiện lưu nguyệt khung 3 tháng'));
assert.equal(v4.initialInterpretationQuestion({ type: 'topic', key: 'kiem_chung' }), VERIFY_QUESTION);
assert.ok(!p3.includes('Gói luật'), 'v3 không đổi');
assert.deepEqual(['v1', 'v2', 'v3', 'v4'].map(usesTimeWindow), [false, false, true, true]);
const NO_ASK = 'mở mục tự động (người dùng chưa gõ gì) thì không hỏi lại';
assert.ok(!p4k.includes(NO_ASK), 'v4 kiem_chung không tự mâu thuẫn về hỏi khi mở tự động');
assert.ok(p4l.includes(NO_ASK));
assert.ok(p3k.includes(NO_ASK));
assert.equal(defaultPromptVersion({}), 'v2');

console.log('prompt-versions: ok');
