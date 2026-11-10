/**
 * Lá số người sinh sau trong cặp sinh đôi: dời cung Mệnh sang Huynh Đệ / Thiên Di của lá số gốc,
 * giữ nguyên sao; tên cung và đại hạn (kể cả vận hạn iztro mà tool AI dùng) theo cung Mệnh mới.
 * Dữ liệu giả.
 */
import assert from 'node:assert/strict';
import { generateChart, getHoroscope } from '../../lib/ziwei/algorithm';
import { formToBirthInfo, formToSearchParams, searchParamsToForm } from '../../lib/ziwei/share';
import { buildChartTools } from '../../lib/ai/tools/ziwei-tools';
import { chartFacts } from '../../lib/prompts';
import type { BirthInfo, ZiweiChart } from '../../lib/ziwei/types';
import type { BirthFormState } from '../../components/BirthForm';

const base: BirthInfo = { year: 1995, month: 3, day: 14, hour: 4, gender: 'female', lunarTimeZone: 7 };
const ORDER = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '仆役', '官禄', '田宅', '福德', '父母'];

const nameAt = (c: ZiweiChart, branch: number) => c.palaces.find(p => p.branch === branch)!.name;
const starsAt = (c: ZiweiChart, branch: number) => c.palaces.find(p => p.branch === branch)!.stars.map(s => `${s.name}${s.siHua ?? ''}`).sort();

const orig = generateChart(base);
const branchOf = (name: string) => orig.palaces.find(p => p.name === name)!.branch;

for (const [method, targetName] of [['huynh_de', '兄弟'], ['thien_di', '迁移']] as const) {
  const twin = generateChart({ ...base, twinMethod: method });
  const newMing = branchOf(targetName);

  assert.equal(twin.mingGongBranch, newMing, `${method}: cung Mệnh mới`);
  assert.equal(nameAt(twin, newMing), '命宫');
  assert.deepEqual(twin.palaces.filter(p => p.isMingGong).map(p => p.branch), [newMing]);

  // Thứ tự 12 cung vẫn đúng chiều tính từ Mệnh mới, giống lá số gốc.
  for (let k = 0; k < 12; k++) {
    const origNameK = ORDER[k];
    const offset = (branchOf(origNameK) - orig.mingGongBranch + 12) % 12;
    assert.equal(nameAt(twin, (newMing + offset) % 12), origNameK, `${method}: cung ${origNameK}`);
  }

  // Sao, cục, cung an Thân giữ nguyên theo địa chi.
  for (let b = 0; b < 12; b++) assert.deepEqual(starsAt(twin, b), starsAt(orig, b), `${method}: sao ở địa chi ${b}`);
  assert.equal(twin.wuxingJuName, orig.wuxingJuName);
  assert.equal(twin.shenGongBranch, orig.shenGongBranch);

  // Đại hạn khởi từ Mệnh mới, cùng số cục, cùng chiều.
  const firstOrig = orig.daXians[0];
  const firstTwin = twin.daXians[0];
  assert.equal(firstTwin.palaceBranch, newMing, `${method}: đại hạn đầu ở Mệnh mới`);
  assert.equal(firstTwin.startAge, firstOrig.startAge);
  const dir = (b: ZiweiChart) => (b.daXians[1].palaceBranch - b.daXians[0].palaceBranch + 12) % 12;
  assert.equal(dir(twin), dir(orig), `${method}: chiều đại hạn`);

  // Vận hạn iztro (tool AI dùng) theo cung Mệnh mới.
  const startYear = base.year + firstTwin.startAge - 1;
  const h = getHoroscope({ ...base, twinMethod: method }, { year: startYear + 1, month: 6, day: 1 });
  const idxToBranch = (i: number) => (i + 2) % 12;
  assert.equal(idxToBranch(h.decadal.index), newMing, `${method}: đại hạn iztro`);

  const facts = JSON.parse(JSON.stringify(chartFacts(twin, {})));
  assert.match(facts.lá_số_sinh_đôi, method === 'huynh_de' ? /Huynh Đệ/ : /Thiên Di/);
  const tools = buildChartTools({ ...base, twinMethod: method });
  const goc = tools.find(t => t.name === 'xem_cung')!.run({ chu_de: 'menh', lop: 'goc' }) as { tam_phương_tứ_chính: Array<{ địa_chi: string }> };
  assert.ok(goc.tam_phương_tứ_chính.length > 0);
}

// Không chọn sinh đôi: y hệt cũ, không có ghi chú sinh đôi.
assert.equal(JSON.parse(JSON.stringify(chartFacts(orig, {}))).lá_số_sinh_đôi, undefined);
assert.throws(() => generateChart({ ...base, twinMethod: 'bogus' as never }), RangeError);

// Form ↔ BirthInfo ↔ link chia sẻ giữ lựa chọn.
const form: BirthFormState = {
  name: '', year: '1995', month: '3', day: '14', clockHour: '8', clockMinute: '0', unknownTime: false,
  province: '', city: '', longitude: 105.85, tzOverride: '', gender: 'female', twin: 'thien_di',
};
assert.equal(formToBirthInfo(form).twinMethod, 'thien_di');
assert.equal(formToBirthInfo({ ...form, twin: '' }).twinMethod, undefined);
assert.equal(searchParamsToForm(formToSearchParams(form))!.twin, 'thien_di');
assert.equal(searchParamsToForm(new URLSearchParams('y=1995&m=3&d=14&tw=xx'))!.twin, '');

console.log('Twin chart regression passed');
