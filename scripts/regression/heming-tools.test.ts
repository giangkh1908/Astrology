import assert from 'node:assert/strict';
import { buildChartTools } from '../../lib/ai/tools/ziwei-tools';
import { branchRelation, buildHemingTools } from '../../lib/ai/tools/heming-tools';
import { cleanPersonName, hemingNames } from '../../lib/ai/heming-names';
import { generateChart } from '../../lib/ziwei/algorithm';
import { viBranch, viPalace, viStar } from '../../lib/vn/terms';

// Tool hợp bàn: 5 tool lá số dùng lại cho từng người (tham số nguoi = TÊN người) + 1 tool đối chiếu chéo.
// Không bao giờ hiện "Người A"/"Người B".
type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const infoA = { name: 'Minh', year: 1990, month: 3, day: 5, hour: 2, gender: 'male', lunarTimeZone: 7 } as never;
const infoB = { name: 'Lan', year: 1992, month: 8, day: 20, hour: 7, gender: 'female', lunarTimeZone: 7 } as never;
const tools = buildHemingTools(infoA, infoB);
const byName = (n: string) => tools.find(t => t.name === n)!;
const single = buildChartTools(infoA).map(t => t.name);
const NO_AB = /Người [AB]\b/;

assert.deepEqual(tools.map(t => t.name), [...single, 'doi_chieu_hai_la_so']);
for (const t of tools) assert.doesNotMatch(JSON.stringify({ d: t.description, p: t.parameters }), NO_AB, `${t.name} còn Người A/B`);

// ── Tên: làm sạch, giới hạn, trùng tên thì phân biệt, thiếu thì dùng tên mặc định ──
assert.equal(cleanPersonName('  Lan\n\t"Anh"  '), 'Lan Anh');
assert.equal(cleanPersonName('a\u0000b‮c`<x>{y}\\'), 'abcxy');
assert.equal(cleanPersonName('x'.repeat(100)).length, 40);
assert.equal(cleanPersonName(undefined), '');
assert.equal(cleanPersonName(42), '');
assert.deepEqual(hemingNames('Lan', 'lan '), ['Lan (1)', 'lan (2)']);
assert.deepEqual(hemingNames('', undefined), ['Người thứ nhất', 'Người thứ hai']);
assert.deepEqual(hemingNames('Minh', 'Lan'), ['Minh', 'Lan']);

// Mỗi tool lá số bắt buộc chọn người bằng tên, kết quả đúng bằng tool đơn của người đó.
for (const name of single) {
  const t = byName(name);
  const params = t.parameters as { properties: Record<string, Any>; required?: string[] };
  assert.deepEqual(params.properties.nguoi.enum, ['Minh', 'Lan'], `${name}: nguoi phải là enum tên hai người`);
  assert.ok(params.required?.includes('nguoi'), `${name}: nguoi phải bắt buộc`);
  assert.match(t.description, /Minh/);
}
const sample: Record<string, Record<string, unknown>> = {
  xem_van_han: { nam: 2026, thang: 3 },
  xem_cung: { chu_de: 'phu_the', lop: 'luu_nien', nam: 2026 },
  xem_cac_thang: { nam: 2026, chu_de: 'phu_the' },
  quet_cac_nam: { chu_de: 'phu_the', tu_nam: 2026, den_nam: 2030 },
  xem_tu_hoa: { chu_de: 'phu_the' },
};
for (const [nguoi, info] of [['Minh', infoA], ['Lan', infoB]] as const) {
  const own = buildChartTools(info);
  for (const name of single) {
    const args = sample[name];
    assert.deepEqual(byName(name).run({ ...args, nguoi }), own.find(t => t.name === name)!.run(args), `${name} của ${nguoi}`);
  }
  assert.match(byName('xem_van_han').status({ nam: 2026, nguoi }), new RegExp(`của ${nguoi}$`));
}
// Thiếu / sai người → báo lỗi cho model (không lộ A/B), không đoán.
const err = byName('xem_van_han').run({ nam: 2026 }) as Any;
assert.ok(err.lỗi);
assert.doesNotMatch(err.lỗi, NO_AB);
assert.ok((byName('xem_van_han').run({ nam: 2026, nguoi: 'Hùng' }) as Any).lỗi);
// Khoan dung: tên không phân biệt hoa thường, và "A"/"B" nội bộ vẫn hiểu
assert.deepEqual(byName('xem_tu_hoa').run({ nguoi: ' lan ' }), buildChartTools(infoB).find(t => t.name === 'xem_tu_hoa')!.run({}));
assert.deepEqual(byName('xem_tu_hoa').run({ nguoi: 'b' }), buildChartTools(infoB).find(t => t.name === 'xem_tu_hoa')!.run({}));
assert.match(byName('xem_tu_hoa').status({ nguoi: 'A' }), /của Minh$/);

// Trùng tên → enum phân biệt
{
  const same = buildHemingTools({ ...(infoA as object), name: 'Lan' } as never, infoB);
  assert.deepEqual((same[0].parameters as Any).properties.nguoi.enum, ['Lan (1)', 'Lan (2)']);
  assert.match(same[0].status({ nam: 2026, nguoi: 'Lan (2)' }), /của Lan \(2\)$/);
}
// Dữ liệu cũ không có tên → tên mặc định, vẫn chạy
{
  const old = buildHemingTools({ ...(infoA as object), name: undefined } as never, { ...(infoB as object), name: undefined } as never);
  assert.deepEqual((old[0].parameters as Any).properties.nguoi.enum, ['Người thứ nhất', 'Người thứ hai']);
  assert.ok((old[0].run({ nam: 2026, nguoi: 'Người thứ hai' }) as Any).năm_âm_lịch);
}

// ── doi_chieu_hai_la_so ──
{
  const chartA = generateChart(infoA);
  const chartB = generateChart(infoB);
  const d = byName('doi_chieu_hai_la_so').run({}) as Any;
  const raw = JSON.stringify(d);
  assert.equal(raw.match(/[㐀-鿿]/), null, `doi_chieu_hai_la_so còn chữ Hán: ${raw.match(/[㐀-鿿]+/g)?.slice(0, 5)}`);
  assert.doesNotMatch(raw, NO_AB);
  assert.doesNotMatch(raw, /_A\b|_B\b|"A"|"B"/, 'khóa/nhãn không dùng A/B');
  assert.deepEqual(Object.keys(d.năm_sinh), ['Minh', 'Lan']);

  // Tứ hóa năm sinh của Minh: sao đó nằm ở cung nào của Lan (đúng theo lá số Lan)
  const huaA = chartA.palaces.flatMap(p => p.stars.filter(s => s.siHua));
  const ab = d.tứ_hóa_năm_sinh_chéo.find((x: Any) => x.của === 'Minh' && x.vào_lá_số === 'Lan');
  assert.equal(ab.các_sao.length, huaA.length);
  for (const x of ab.các_sao) {
    const star = huaA.find(s => viStar(s.name) === x.sao)!;
    assert.ok(star, `sao ${x.sao} không phải sinh niên tứ hóa của Minh`);
    const inB = chartB.palaces.find(p => p.stars.some(s => s.name === star.name));
    if (inB) assert.equal(x.cung_của_Lan, `${viPalace(inB.name)} (${viBranch(inB.branch)})`);
    assert.ok(x.cung_của_Minh);
  }
  const ba = d.tứ_hóa_năm_sinh_chéo.find((x: Any) => x.của === 'Lan' && x.vào_lá_số === 'Minh');
  assert.equal(ba.các_sao.length, chartB.palaces.flatMap(p => p.stars.filter(s => s.siHua)).length);

  // Đặt cung Mệnh/Thân/Phu Thê của người này lên lá số người kia (theo địa chi)
  const ov = d.đặt_cung_lên_lá_số_người_kia.find((x: Any) => x.từ === 'Minh' && x.lên === 'Lan');
  assert.deepEqual(ov.các_cung.map((x: Any) => x.cung), ['Mệnh', 'Thân', 'Phu Thê']);
  assert.equal(ov.các_cung[0].địa_chi, viBranch(chartA.mingGongBranch));
  assert.equal(ov.các_cung[0].rơi_vào_cung_của_Lan, viPalace(chartB.palaces.find(p => p.branch === chartA.mingGongBranch)!.name));
  assert.equal(d.đặt_cung_lên_lá_số_người_kia.length, 2);

  // Quan hệ địa chi giữa các cung của hai người
  const rel = d.quan_hệ_địa_chi.find((x: Any) => x.cặp === 'Mệnh Minh – Mệnh Lan');
  assert.ok(rel, 'thiếu quan hệ Mệnh Minh – Mệnh Lan');
  assert.ok(['trùng', 'xung', 'tam hợp', 'lục hợp', 'không đặc biệt'].includes(rel.quan_hệ));
  assert.ok(d.quan_hệ_địa_chi.some((x: Any) => x.cặp === 'Phu Thê Minh – Mệnh Lan'));
  assert.ok(d.quan_hệ_địa_chi.some((x: Any) => x.cặp === 'Năm sinh Minh – Năm sinh Lan'));
  assert.ok(d.cách_đọc);
}

// Quan hệ địa chi đúng quy tắc: Tý–Ngọ xung, Tý–Thìn tam hợp, Tý–Sửu lục hợp.
{
  assert.equal(branchRelation(0, 0), 'trùng');
  assert.equal(branchRelation(0, 6), 'xung');
  assert.equal(branchRelation(0, 4), 'tam hợp');
  assert.equal(branchRelation(8, 0), 'tam hợp');
  assert.equal(branchRelation(0, 1), 'lục hợp');
  assert.equal(branchRelation(2, 11), 'lục hợp');
  assert.equal(branchRelation(0, 3), 'không đặc biệt');
}

console.log('heming tools regression passed');
