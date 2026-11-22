import assert from 'node:assert/strict';
import { buildChartTools } from '../../lib/ai/tools/ziwei-tools';
import { ASK_TOOL_NAME, askToolDefinition } from '../../lib/ai/ask-user';
import { getPromptSet } from '../../lib/prompts';
import { LOVE_PACK, VERIFY_PACK, topicPackFor } from '../../lib/prompts/packs';
import { generateChart } from '../../lib/ziwei/algorithm';

const birthInfo = { year: 1990, month: 5, day: 12, hour: 6, gender: 'female', lunarTimeZone: 7 } as never;
const chart = generateChart(birthInfo);
const tools = [...buildChartTools(birthInfo), askToolDefinition as unknown as ReturnType<typeof buildChartTools>[number]];

const spouse = chart.palaces.find(p => p.name === '夫妻')!;
assert.equal(topicPackFor(chart, { type: 'topic', key: 'love' }), LOVE_PACK);
assert.equal(topicPackFor(chart, { type: 'palace', branch: spouse.branch }), LOVE_PACK);
assert.equal(topicPackFor(chart, { type: 'palace', branch: chart.mingGongBranch }), undefined);
assert.equal(topicPackFor(chart, { type: 'topic', key: 'kiem_chung' }), VERIFY_PACK);
assert.equal(topicPackFor(chart, { type: 'topic', key: 'career' }), undefined);

for (const pack of [LOVE_PACK, VERIFY_PACK]) {
  assert.equal(pack.match(/[㐀-鿿]/), null, 'gói còn chữ Hán');
  const names = tools.map(t => t.name);
  for (const mentioned of new Set(pack.match(/\b[a-z]+(?:_[a-z]+)+(?=\()/g) ?? [])) {
    assert.ok(names.includes(mentioned), `gói nhắc tool không tồn tại: ${mentioned}`);
  }
  for (const [, name, args] of pack.matchAll(/\b([a-z]+(?:_[a-z]+)+)\(([^)]*)\)/g)) {
    const tool = tools.find(t => t.name === name);
    assert.ok(tool, `gói nhắc tool không tồn tại: ${name}`);
    const props = Object.keys((tool!.parameters as { properties: object }).properties);
    for (const arg of args.split(',').map(a => a.trim().split(/[ =]/)[0]).filter(Boolean)) {
      assert.ok(props.includes(arg), `${name}: gói dùng tham số "${arg}" không có trong schema`);
    }
  }
}
assert.ok(tools.some(t => t.name === ASK_TOOL_NAME));

const quet = tools.find(t => t.name === 'quet_cac_nam')!;
const out = JSON.stringify(quet.run({ chu_de: 'phu_the', tu_nam: 2026, den_nam: 2027 }));
for (const field of ['đại_hạn_ở_tam_hợp_phu_thê', 'hỷ_tín_tiểu_hạn', 'tín_hiệu']) {
  assert.ok(LOVE_PACK.includes(field), `gói chưa nhắc ${field}`);
  assert.ok(out.includes(`"${field}"`), `kết quả quet_cac_nam thiếu trường ${field}`);
}

assert.ok(VERIFY_PACK.includes('dưới 20 tuổi âm'));
assert.ok(VERIFY_PACK.includes('giờ sinh chưa chuẩn'));

const v2 = getPromptSet('v2').buildInterpretationSystemPrompt(chart, { type: 'topic', key: 'love' }, { view: 'mingpan' });
assert.ok(!v2.includes('Gói luật Tình duyên'), 'v2 không được có gói luật');

console.log('topic-packs.test.ts passed');
