import assert from 'node:assert/strict';
import { buildChartTools } from '../../lib/ai/tools/ziwei-tools';
import { buildInterpretationSystemPrompt, initialInterpretationQuestion } from '../../lib/prompts/astrology-interpretation';
import { generateChart } from '../../lib/ziwei/algorithm';

// Prompt và tool phải khớp nhau: tool nào cũng được hướng dẫn, prompt không nhắc tool/tham số/trường không tồn tại.
const birthInfo = { year: 1990, month: 5, day: 12, hour: 6, gender: 'female', lunarTimeZone: 7 } as never;
const tools = buildChartTools(birthInfo);
const chart = generateChart(birthInfo);
const prompt = buildInterpretationSystemPrompt(chart, { type: 'topic', key: 'love' }, { view: 'mingpan' });

const names = tools.map(t => t.name);
for (const n of names) assert.ok(prompt.includes(n), `prompt chưa hướng dẫn tool ${n}`);
for (const mentioned of new Set(prompt.match(/\b[a-z]+(?:_[a-z]+)+(?=\()/g) ?? [])) {
  assert.ok(names.includes(mentioned), `prompt nhắc tool không tồn tại: ${mentioned}`);
}
// Tham số trong ngoặc của prompt phải là tham số thật của tool đó
for (const [, name, args] of prompt.matchAll(/\b([a-z]+(?:_[a-z]+)+)\(([^)]*)\)/g)) {
  const props = Object.keys((tools.find(t => t.name === name)!.parameters as { properties: object }).properties);
  for (const arg of args.split(',').map(a => a.trim().split(/[ =]/)[0]).filter(Boolean)) {
    assert.ok(props.includes(arg), `${name}: prompt dùng tham số "${arg}" không có trong schema`);
  }
}
// Trường prompt bảo dùng phải có thật trong kết quả tool
const vanHan = JSON.stringify(tools[0].run({ nam: 2026, thang: 3 }));
for (const field of ['dương_lịch', 'hóa_chồng_tầng']) {
  assert.ok(prompt.includes(field), `prompt chưa nhắc trường ${field}`);
  assert.ok(vanHan.includes(`"${field}"`), `kết quả xem_van_han thiếu trường ${field}`);
}
assert.equal(prompt.match(/[㐀-鿿]/), null, 'prompt còn chữ Hán');
assert.match(initialInterpretationQuestion({ type: 'topic', key: 'love' }), /năm âm lịch hiện tại/);
assert.doesNotMatch(initialInterpretationQuestion({ type: 'topic', key: 'personality' }), /năm âm lịch hiện tại/);
console.log('AI prompt/tool match regression passed');
