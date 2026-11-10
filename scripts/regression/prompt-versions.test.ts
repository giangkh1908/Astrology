import assert from 'node:assert/strict';
import { defaultPromptVersion, getPromptSet, PROMPT_VERSIONS } from '../../lib/prompts';
import { generateChart } from '../../lib/ziwei/algorithm';

// v1 = prompt trước khi đổi cách trình bày (nêu tên sao làm căn cứ); v2 = nói theo cung, kết luận chi tiết.
const chart = generateChart({ year: 1990, month: 3, day: 5, hour: 2, gender: 'male' } as never);
const twin = generateChart({ year: 1990, month: 3, day: 5, hour: 2, gender: 'male', twinMethod: 'huynh_de' } as never);
const intent = { type: 'topic' as const, key: 'career' };

assert.deepEqual(PROMPT_VERSIONS.map(v => v.id), ['v1', 'v2']);

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

console.log('prompt-versions: ok');
