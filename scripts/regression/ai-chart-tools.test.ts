import assert from 'node:assert/strict';
import { buildChartTools } from '../../lib/ai/tools/ziwei-tools';
import { generateChart } from '../../lib/ziwei/algorithm';
import { viBranch } from '../../lib/vn/terms';

// Tool vận hạn cho AI: số liệu phải khớp lá số đang hiển thị và không lộ chữ Hán.
type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const BRANCH_OF_YEAR = (y: number) => ((y - 4) % 12 + 12) % 12;

for (const info of [
  { year: 2000, month: 1, day: 1, hour: 2, gender: 'male', lunarTimeZone: 7 },
  { year: 1985, month: 7, day: 20, hour: 9, gender: 'female', lunarTimeZone: 7 },
  { year: 1992, month: 2, day: 4, hour: 0, gender: 'male' },
] as const) {
  const birthInfo = info as never;
  const chart = generateChart(birthInfo);
  const [vanHan, cung] = buildChartTools(birthInfo);

  for (const nam of [2024, 2026, 2031]) {
    const v = vanHan.run({ nam, thang: 3 }) as Any;
    const raw = JSON.stringify(v);
    assert.equal(raw.match(/[㐀-鿿]/), null, `xem_van_han ${nam} còn chữ Hán`);
    assert.equal(v.năm_âm_lịch, nam);
    // Mệnh lưu niên nằm ở địa chi của năm
    assert.equal(v.lưu_niên.mệnh_lưu_niên.địa_chi, viBranch(BRANCH_OF_YEAR(nam)));
    assert.equal(v.lưu_niên.mười_hai_cung_lưu_niên.length, 12);
    assert.equal(v.lưu_niên.mười_hai_cung_lưu_niên[0].cung_lưu_niên, 'Mệnh');
    assert.equal(v.lưu_niên.mười_hai_cung_lưu_niên[2].cung_lưu_niên, 'Phu Thê');
    assert.equal(v.lưu_niên.tứ_hóa_lưu_niên.length, 4);
    assert.ok(v.lưu_nguyệt, 'có thang thì phải có lưu nguyệt');

    // Đại hạn của tool khớp đại hạn trong lá số tại tuổi đó
    const dx = chart.daXians.find(d => v.tuổi_âm >= d.startAge && v.tuổi_âm <= d.endAge);
    if (dx) assert.equal(v.đại_hạn.mệnh_đại_hạn.địa_chi, viBranch(dx.palaceBranch), `đại hạn năm ${nam}`);

    // Phu Thê lưu niên của xem_cung = cung Phu Thê trong 12 cung lưu niên
    const c = cung.run({ chu_de: 'phu_the', lop: 'luu_nien', nam }) as Any;
    assert.equal(JSON.stringify(c).match(/[㐀-鿿]/), null, 'xem_cung còn chữ Hán');
    assert.equal(c.tam_phương_tứ_chính[0].địa_chi, v.lưu_niên.mười_hai_cung_lưu_niên[2].địa_chi);
    assert.equal(c.tam_phương_tứ_chính[0].cung_lưu_niên, 'Phu Thê');
  }

  // Lớp gốc: đúng cung Phu Thê của lá số
  const goc = cung.run({ chu_de: 'phu_the', lop: 'goc' }) as Any;
  const fuqi = chart.palaces.find(p => p.name === '夫妻')!;
  assert.equal(goc.tam_phương_tứ_chính[0].địa_chi, viBranch(fuqi.branch));
}

// Can Nhâm: Lộc Tồn ở Hợi, Kình Dương ở Tý, Đà La ở Tuất (an sao cố định theo can)
const v = buildChartTools({ year: 2000, month: 1, day: 1, hour: 2, gender: 'male', lunarTimeZone: 7 } as never)[0].run({ nam: 2026 }) as Any;
if (v.đại_hạn.can_cung.startsWith('Nhâm')) {
  const at = (name: string) => v.đại_hạn.sao_lưu_đại_hạn.find((s: Any) => s.sao === name)?.địa_chi;
  assert.equal(at('Đại hạn Lộc Tồn'), 'Hợi');
  assert.equal(at('Đại hạn Kình Dương'), 'Tý');
  assert.equal(at('Đại hạn Đà La'), 'Tuất');
}

// ── xem_cac_thang / quet_cac_nam / xem_tu_hoa ──
{
  const birthInfo = { year: 2000, month: 1, day: 1, hour: 2, gender: 'male', lunarTimeZone: 7 } as never;
  const tools = buildChartTools(birthInfo);
  const byName = (n: string) => tools.find(t => t.name === n)!;
  const DATE_RANGE = /^\d{2}\/\d{2}\/\d{4} – \d{2}\/\d{2}\/\d{4}$/;

  // Năm 2025 âm lịch VN có tháng 6 nhuận → 13 tháng; mỗi tháng có khoảng dương lịch nối liền nhau
  const m = byName('xem_cac_thang').run({ nam: 2025, chu_de: 'phu_the' }) as Any;
  assert.equal(JSON.stringify(m).match(/[㐀-鿿]/), null, 'xem_cac_thang còn chữ Hán');
  assert.equal(m.các_tháng.length, 13);
  assert.deepEqual(m.các_tháng.map((x: Any) => x.tháng_âm).slice(5, 8), ['6', 'nhuận 6', '7']);
  assert.ok(m.các_tháng[0].dương_lịch.startsWith('29/01/2025'), 'Tết Ất Tỵ là 29/01/2025');
  for (const x of m.các_tháng) assert.match(x.dương_lịch, DATE_RANGE);
  assert.match(m.dương_lịch, DATE_RANGE);

  // quet_cac_nam: tối đa 15 năm, năm liên tiếp, có dương lịch
  const q = byName('quet_cac_nam').run({ chu_de: 'phu_the', tu_nam: 2026, den_nam: 2060 }) as Any;
  assert.equal(JSON.stringify(q).match(/[㐀-鿿]/), null, 'quet_cac_nam còn chữ Hán');
  assert.equal(q.các_năm.length, 15);
  assert.deepEqual([q.các_năm[0].năm_âm_lịch, q.các_năm[14].năm_âm_lịch], [2026, 2040]);
  assert.ok(q.các_năm[0].dương_lịch.startsWith('17/02/2026'), 'Tết Bính Ngọ là 17/02/2026');
  assert.equal(q.các_năm[0].can_chi, 'Bính Ngọ');

  // xem_tu_hoa: phi hóa theo can cung, tự hóa khớp với phi hóa ra, không chữ Hán
  const chart = generateChart(birthInfo);
  const all = byName('xem_tu_hoa').run({}) as Any;
  assert.equal(JSON.stringify(all).match(/[㐀-鿿]/), null, 'xem_tu_hoa còn chữ Hán');
  assert.equal(all.phi_hóa_12_cung.length, 12);
  assert.equal(all.sinh_niên_tứ_hóa.length, chart.palaces.flatMap(p => p.stars.filter(s => s.siHua)).length);
  for (const key of ['menh', 'phu_the', 'quan_loc', 'tai_bach']) {
    const f = byName('xem_tu_hoa').run({ chu_de: key }) as Any;
    assert.equal(f.phi_hóa_ra.length, 4);
    const selfFromFly = f.phi_hóa_ra.filter((x: string) => x.endsWith('tự hóa')).length;
    assert.equal(f.tự_hóa.length, selfFromFly, `${key}: tự hóa phải khớp với phi hóa vào chính cung`);
  }

  // hóa chồng tầng: mỗi mục có ít nhất 2 tầng
  const v = byName('xem_van_han').run({ nam: 2026, thang: 3 }) as Any;
  assert.ok(Array.isArray(v.hóa_chồng_tầng));
  for (const x of v.hóa_chồng_tầng) assert.ok(x.các_tầng.length >= 2);
}

console.log('AI chart tools regression passed');
