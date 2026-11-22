import assert from 'node:assert/strict';
import { buildChartTools, peachBranchOfLayer } from '../../lib/ai/tools/ziwei-tools';
import { viStar } from '../../lib/vn/terms';
type Any = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const info = { year: 1955, month: 12, day: 28, hour: 1, gender: 'male', lunarTimeZone: 7 } as never;
const tools = buildChartTools(info);
const quet = tools.find(t => t.name === 'quet_cac_nam')!;
const q = quet.run({ chu_de: 'phu_the', tu_nam: 1982, den_nam: 1986 }) as Any;
assert.equal(JSON.stringify(q).match(/[㐀-鿿]/), null, 'còn chữ Hán');
const y = (n: number) => q.các_năm.find((x: Any) => x.năm_âm_lịch === n);

// Tiểu hạn: Hợi Mão Mùi khởi Sửu, nam thuận → 28 tuổi Thìn, 29 Tị, 32 Thân
assert.equal(y(1982).tiểu_hạn, 'Thìn (cung gốc Nô Bộc)');
assert.equal(y(1983).tiểu_hạn, 'Tị (cung gốc Thiên Di)');
assert.equal(y(1986).tiểu_hạn, 'Thân (cung gốc Tử Tức)');
// Lưu Đào Hoa theo chi năm: Tuất → Mão, Hợi → Tý, Dần → Mão
assert.deepEqual([y(1982).lưu_đào_hoa, y(1983).lưu_đào_hoa, y(1986).lưu_đào_hoa], ['Mão', 'Tý', 'Mão']);
// Đại hạn 25–34 ở Dậu = Phu Thê
for (const n of [1982, 1983, 1986]) assert.equal(y(n).đại_hạn_ở_tam_hợp_phu_thê, true);

const has = (n: number, zh: string, where: string) =>
  assert.ok(y(n).hỷ_tín_tiểu_hạn.sao.includes(`${viStar(zh)} (${where})`), `${n}: thiếu ${zh} ${where}`);
// 1982 tiểu hạn Thìn: Thân (Hồng Loan, Hỷ Thần) và Tý (Đào Hoa, Hữu Bật) tam hợp → 4 điểm
has(1982, '红鸾', 'tam hợp'); has(1982, '喜神', 'tam hợp'); has(1982, '咸池', 'tam hợp'); has(1982, '右弼', 'tam hợp');
assert.equal(y(1982).hỷ_tín_tiểu_hạn.điểm, 4);
// 1983 tiểu hạn Tị: Hợi xung (Thiên Riêu, Long Trì), Sửu tam hợp (Thanh Long) → 3 điểm
has(1983, '天姚', 'xung chiếu'); has(1983, '龙池', 'xung chiếu'); has(1983, '青龙', 'tam hợp');
assert.equal(y(1983).hỷ_tín_tiểu_hạn.điểm, 3);
// 1986 tiểu hạn Thân: bản cung Hồng Loan + Hỷ Thần (2+2), Tý tam hợp (1+1), Dần xung Thiên Hỷ + Tả Phù (1+1) → 8
has(1986, '红鸾', 'vào bản cung'); has(1986, '天喜', 'xung chiếu'); has(1986, '左辅', 'xung chiếu');
assert.equal(y(1986).hỷ_tín_tiểu_hạn.điểm, 8);

// Chủ đề khác không có trường riêng của Tình duyên, nhưng vẫn có tiểu hạn
const career = quet.run({ chu_de: 'quan_loc', tu_nam: 1982, den_nam: 1982 }) as Any;
assert.equal(career.các_năm[0].hỷ_tín_tiểu_hạn, undefined);
assert.equal(career.các_năm[0].đại_hạn_ở_tam_hợp_phu_thê, undefined);
assert.equal(career.các_năm[0].tiểu_hạn, 'Thìn (cung gốc Nô Bộc)');

// xem_van_han: Lưu Đào Hoa có trong sao lưu năm
const v = tools.find(t => t.name === 'xem_van_han')!.run({ nam: 1982 }) as Any;
assert.equal(v.lưu_niên.sao_lưu.find((s: Any) => s.sao === 'Lưu Đào Hoa')?.địa_chi, 'Mão');

// Layer thiếu dữ liệu không làm vỡ
assert.equal(peachBranchOfLayer({}), undefined);
assert.equal(peachBranchOfLayer({ yearlyDecStar: { jiangqian12: [] } }), undefined);

console.log('AI love signals regression passed');
