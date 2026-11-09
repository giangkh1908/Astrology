import assert from 'node:assert/strict';
import { buildChartTools } from '../../lib/ai/tools/ziwei-tools';
import { buildInterpretationSystemPrompt, chartFacts, initialInterpretationQuestion } from '../../lib/prompts/astrology-interpretation';
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

// Thân cung: dữ kiện phải nói rõ là cung nào (lá số 19/08/2003 nam giờ Thân: Thân cư Quan Lộc, ở địa chi Thìn),
// không để lẫn với địa chi Thân / giờ Thân / cung Tài Bạch (đang ở địa chi Thân).
{
  const info = { year: 2003, month: 8, day: 19, hour: 8, gender: 'male', lunarTimeZone: 7 } as never;
  const c = generateChart(info);
  const facts = JSON.parse(JSON.stringify(chartFacts(c, {})));
  assert.equal(facts.thân_cư_cung.cung, 'Quan Lộc');
  assert.equal(facts.thân_cư_cung.địa_chi, 'Thìn');
  assert.equal(facts.giờ_sinh_địa_chi, 'Thân');
  assert.equal(facts.thân_cung, undefined, 'không còn trường thân_cung chỉ có địa chi');
  const flagged = facts.mười_hai_cung.filter((p: { là_cung_an_thân?: boolean }) => p.là_cung_an_thân);
  assert.deepEqual(flagged.map((p: { cung: string }) => p.cung), ['Quan Lộc']);
  const tai = facts.mười_hai_cung.find((p: { cung: string }) => p.cung === 'Tài Bạch');
  assert.equal(tai.địa_chi, 'Thân');
  assert.equal(tai.là_cung_an_thân, undefined, 'Tài Bạch ở địa chi Thân không phải cung an Thân');
  const cung = buildChartTools(info).find(t => t.name === 'xem_cung')!.run({ chu_de: 'quan_loc', lop: 'goc' }) as { tam_phương_tứ_chính: Array<{ cung_gốc: string; có_cung_an_thân?: boolean }> };
  assert.equal(cung.tam_phương_tứ_chính[0].có_cung_an_thân, true);
  assert.equal(cung.tam_phương_tứ_chính.find(x => x.cung_gốc === 'Tài Bạch')?.có_cung_an_thân, undefined);
  assert.match(prompt, /thân_cư_cung/);
}
console.log('AI prompt/tool match regression passed');
