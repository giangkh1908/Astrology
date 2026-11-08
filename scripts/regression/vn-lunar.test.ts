/**
 * Hồi quy: âm lịch Việt Nam, múi giờ lịch sử và tích hợp vào generateChart.
 *
 * Âm lịch Việt Nam khác Trung Quốc ở múi giờ dùng để xác định "ngày" của điểm Sóc (UTC+7 so với UTC+8).
 * generateChart chỉ cần đổi ngày khi hai bên khác nhau; test này kiểm:
 *   1. solarToLunarVN cho đúng các mốc nổi tiếng (Tết 1985, Tết 2007, Tết Mậu Thân 1968, nhuận 2020);
 *   2. vnCivilOffsetMinutes / vnLunarTimeZone theo lịch sử từng miền;
 *   3. generateChart với lunarTimeZone: ngày âm VN, lá số đổi, can chi tiết khí vẫn tính từ ngày dương thật,
 *      còn khi VN trùng TQ (hoặc không truyền lunarTimeZone) kết quả y hệt bản gốc.
 */
import assert from 'node:assert/strict';
import { solarToLunarVN, sameLunarDate } from '../../lib/vn/lunar-vn';
import { vnCivilOffsetMinutes, vnLunarTimeZone } from '../../lib/vn/timezone-vn';
import { generateChart, applyLeapMonthPolicy, findSubstituteSolarDate } from '../../lib/ziwei/algorithm';
import type { BirthInfo } from '../../lib/ziwei/types';

const lun = (d: number, m: number, y: number, tz: number) => solarToLunarVN(d, m, y, tz);

// ── 1) Mốc âm lịch ──────────────────────────────────────────────
// Tết Ất Sửu 1985: 21/1/1985 theo VN (UTC+7), còn theo UTC+8 là 1/12 năm Giáp Tý (Tết TQ rơi 20/2).
assert.deepEqual(lun(21, 1, 1985, 7), { day: 1, month: 1, year: 1985, leap: false }, 'VN 21/1/1985 = mùng 1 Tết');
assert.deepEqual(lun(21, 1, 1985, 8), { day: 1, month: 12, year: 1984, leap: false }, 'TQ 21/1/1985 = 1/12 năm 1984');
assert.deepEqual(lun(20, 2, 1985, 8), { day: 1, month: 1, year: 1985, leap: false }, 'TQ 20/2/1985 = mùng 1 Tết');

// Tết Đinh Hợi 2007: VN 17/2/2007 là mùng 1, TQ là 30/12.
assert.deepEqual(lun(17, 2, 2007, 7), { day: 1, month: 1, year: 2007, leap: false }, 'VN 17/2/2007 = mùng 1 Tết');
assert.deepEqual(lun(17, 2, 2007, 8), { day: 30, month: 12, year: 2006, leap: false }, 'TQ 17/2/2007 = 30/12');

// Tết Mậu Thân 1968: miền Bắc (UTC+7) 29/1, miền Nam (UTC+8) 30/1.
assert.deepEqual(lun(29, 1, 1968, 7), { day: 1, month: 1, year: 1968, leap: false }, 'Bắc 29/1/1968 = mùng 1 Tết');
assert.deepEqual(lun(30, 1, 1968, 8), { day: 1, month: 1, year: 1968, leap: false }, 'Nam 30/1/1968 = mùng 1 Tết');
assert.deepEqual(lun(29, 1, 1968, 8), { day: 30, month: 12, year: 1967, leap: false }, 'Nam 29/1/1968 = 30 tháng Chạp');

// Tháng 4 nhuận 2020: 23/5/2020 là mùng 1 tháng 4 nhuận (cả hai múi giờ).
assert.deepEqual(lun(23, 5, 2020, 7), { day: 1, month: 4, year: 2020, leap: true }, '23/5/2020 = 1/4 nhuận');
assert.equal(sameLunarDate(lun(23, 5, 2020, 7), lun(23, 5, 2020, 8)), true);
assert.equal(sameLunarDate(lun(21, 1, 1985, 7), lun(21, 1, 1985, 8)), false);

// ── 2) Múi giờ lịch sử ──────────────────────────────────────────
assert.equal(vnCivilOffsetMinutes(1965, 6, 1, 12, 0, 'south'), 480, '1965 miền Nam UTC+8');
assert.equal(vnCivilOffsetMinutes(1965, 6, 1, 12, 0, 'north'), 420, '1965 miền Bắc UTC+7');
assert.equal(vnCivilOffsetMinutes(1944, 6, 1, 12, 0, 'north'), 480, '1944 UTC+8 (Đông Dương)');
assert.equal(vnCivilOffsetMinutes(1944, 6, 1, 12, 0, 'south'), 480, '1944 UTC+8 (Đông Dương), miền Nam');
assert.equal(vnCivilOffsetMinutes(1990, 6, 1, 12, 0, 'north'), 420, '1990 UTC+7');
assert.equal(vnCivilOffsetMinutes(1990, 6, 1, 12, 0, 'south'), 420, '1990 UTC+7, miền Nam');

assert.equal(vnLunarTimeZone(1960, 1, 1, 'north'), 8, 'trước 8/8/1967 cả nước tính âm lịch theo UTC+8');
assert.equal(vnLunarTimeZone(1968, 1, 29, 'north'), 7, 'Bắc từ 8/8/1967 dùng UTC+7');
assert.equal(vnLunarTimeZone(1968, 1, 30, 'south'), 8, 'Nam dùng UTC+8 tới 13/6/1975');
assert.equal(vnLunarTimeZone(1975, 6, 13, 'south'), 7, 'Nam từ 13/6/1975 dùng UTC+7');

// ── 3) Chính sách nhuận dùng chung + ngày dương thay thế ────────────
// Chính sách áp trên ngày âm thô (không cần lunar-javascript cho phần ngày không nhuận).
{
  const plain = applyLeapMonthPolicy(1985, 1, 1, 'split');
  assert.deepEqual(
    { y: plain.lunarYear, m: plain.lunarMonth, d: plain.lunarDay, leap: plain.isLeapMonth },
    { y: 1985, m: 1, d: 1, leap: false },
  );
  const leapEarly = applyLeapMonthPolicy(2020, -4, 1, 'split');
  assert.equal(leapEarly.lunarMonth, 4, 'split: nửa đầu tháng nhuận thuộc tháng trước');
  const leapLate = applyLeapMonthPolicy(2020, -4, 20, 'split');
  assert.equal(leapLate.lunarMonth, 5, 'split: nửa sau tháng nhuận thuộc tháng sau');
  assert.equal(applyLeapMonthPolicy(2020, -4, 1, 'next-month').lunarMonth, 5);
  assert.equal(applyLeapMonthPolicy(2020, -4, 1, 'origin-month').isLeapMonth, true);
}

{
  const sub = findSubstituteSolarDate({ lunarYear: 1985, lunarMonth: 1, lunarDay: 1, isLeapMonth: false });
  assert.deepEqual(sub, { year: 1985, month: 2, day: 20, lunarYear: 1985 }, 'âm 1/1/1985 (lunar-javascript) = dương 20/2/1985');
}

// ── 4) generateChart ──────────────────────────────────────────────
const base: BirthInfo = { year: 1985, month: 1, day: 21, hour: 4, gender: 'male' };

const plain = generateChart(base);
const vn = generateChart({ ...base, lunarTimeZone: 7 });

// 21/1/1985: lịch TQ là 1/12/1984, VN là 1/1/1985.
assert.equal(plain.lunarInfo.lunarYear, 1984);
assert.equal(plain.lunarInfo.lunarMonth, 12);
assert.equal(vn.lunarInfo.lunarYear, 1985, 'lunarInfo dùng năm âm VN');
assert.equal(vn.lunarInfo.lunarMonth, 1, 'lunarInfo dùng tháng âm VN');
assert.equal(vn.lunarInfo.lunarDay, 1, 'lunarInfo dùng ngày âm VN');
assert.equal(vn.lunarInfo.isLeapMonth, false);
assert.equal(vn.lunarInfo.yearStem, 1, 'Ất');
assert.equal(vn.lunarInfo.yearBranch, 1, 'Sửu');

assert.notEqual(vn.mingGongBranch, plain.mingGongBranch, 'cung Mệnh đổi khi dùng âm lịch VN');

// birthInfo giữ ngày dương thật.
assert.deepEqual(
  { y: vn.birthInfo.year, m: vn.birthInfo.month, d: vn.birthInfo.day },
  { y: 1985, m: 1, d: 21 },
  'chart.birthInfo giữ ngày dương thật',
);

// Tứ trụ tiết khí vẫn theo ngày dương thật (trước Lập Xuân 4/2/1985: năm Giáp Tý), tứ trụ âm lịch theo năm âm VN (Ất Sửu).
assert.equal(vn.lunarInfo.fourPillars?.[0], '甲子', 'năm tiết khí vẫn là Giáp Tý');
assert.equal(vn.lunarInfo.fourPillarsLunar?.[0], '乙丑', 'năm âm lịch VN là Ất Sửu');
assert.equal(vn.lunarInfo.fourPillars?.[2], plain.lunarInfo.fourPillars?.[2], 'trụ ngày không đổi');

// Bất biến: lá số VN trùng lá số của ngày dương thay thế (20/2/1985 là mùng 1 Tết theo lunar-javascript).
const viaSubstitute = generateChart({ ...base, month: 2, day: 20 });
assert.equal(vn.mingGongBranch, viaSubstitute.mingGongBranch, 'Mệnh giống lá số ngày thay thế');
assert.equal(vn.shenGongBranch, viaSubstitute.shenGongBranch);
assert.equal(vn.ziweiPos, viaSubstitute.ziweiPos);
assert.equal(vn.wuxingJuName, viaSubstitute.wuxingJuName);
assert.equal(vn.currentAge, viaSubstitute.currentAge, 'tuổi hiện tại không lệch khi Y\' = Y');

// Khi lunarTimeZone = 8 (hoặc VN trùng TQ) thì y hệt bản gốc.
{
  const a = generateChart(base);
  const b = generateChart({ ...base, lunarTimeZone: 8 });
  assert.deepEqual({ ...b, birthInfo: undefined }, { ...a, birthInfo: undefined }, 'lunarTimeZone = 8: y hệt bản gốc');
}
{
  const info: BirthInfo = { ...base, year: 2000, month: 6, day: 15 };
  const a = generateChart(info);
  const b = generateChart({ ...info, lunarTimeZone: 7 });
  assert.equal(sameLunarDate(lun(15, 6, 2000, 7), lun(15, 6, 2000, 8)), true, 'tiền đề: 15/6/2000 VN = TQ');
  assert.deepEqual({ ...b, birthInfo: undefined }, { ...a, birthInfo: undefined }, 'VN trùng TQ: lá số y hệt');
}

console.log('VN lunar / timezone / generateChart regression passed');
