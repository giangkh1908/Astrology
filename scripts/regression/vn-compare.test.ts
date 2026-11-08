/** So sánh lá số âm lịch VN và TQ (lib/vn/compare). */
import assert from 'node:assert/strict';
import { generateChart } from '../../lib/ziwei/algorithm';
import { generateChartCN, diffCharts } from '../../lib/vn/compare';
import type { BirthInfo } from '../../lib/ziwei/types';

const base = (y: number, m: number, d: number): BirthInfo => ({
  year: y, month: m, day: d, hour: 6, gender: 'male', longitude: 105.85, utcOffsetMinutes: 420, region: 'north', lunarTimeZone: 7,
});

// Ngày VN trùng TQ → không khác biệt
{
  const info = base(2000, 6, 15);
  assert.deepEqual(diffCharts(generateChart(info), generateChartCN(info)), [], '2000-06-15: hai lá số giống hệt');
}

// Tết Ất Sửu VN 21/1/1985 (TQ còn là 1/12 Giáp Tý) → khác cả năm âm
{
  const info = base(1985, 1, 21);
  const vn = generateChart(info);
  const cn = generateChartCN(info);
  assert.equal(cn.lunarInfo.lunarYear, 1984, 'CN: năm âm 1984');
  assert.equal(vn.lunarInfo.lunarYear, 1985, 'VN: năm âm 1985');
  const diff = diffCharts(vn, cn);
  assert.ok(diff.length > 0, 'phải có khác biệt');
  const lunar = diff.find(d => d.kind === 'lunar');
  assert.ok(lunar && lunar.vn.startsWith('1/1/1985') && lunar.cn.startsWith('1/12/1984'), `ngày âm: ${JSON.stringify(lunar)}`);
  assert.ok(!/[一-鿿]/.test(JSON.stringify(diff)), 'bảng khác biệt không còn chữ Hán');
}

// generateChartCN bỏ qua lunarTimeZone nhưng giữ nguyên giờ/kinh độ
{
  const info = base(1985, 1, 21);
  const cn = generateChartCN(info);
  const orig = generateChart({ ...info, lunarTimeZone: undefined });
  assert.equal(cn.mingGongBranch, orig.mingGongBranch);
  assert.equal(cn.ziweiPos, orig.ziweiPos);
}

console.log('VN/CN compare regression passed');
