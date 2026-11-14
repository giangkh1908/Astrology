/** Lá số dùng âm lịch Việt Nam (UTC+7 sau 1967 ở miền Bắc), không theo lịch TQ của engine. */
import assert from 'node:assert/strict';
import { generateChart } from '../../lib/ziwei/algorithm';
import type { BirthInfo } from '../../lib/ziwei/types';

const base = (y: number, m: number, d: number): BirthInfo => ({
  year: y, month: m, day: d, hour: 6, gender: 'male', longitude: 105.85, utcOffsetMinutes: 420, region: 'north', lunarTimeZone: 7,
});

// Tết Ất Sửu ở VN là 21/1/1985; lịch TQ hôm đó còn là mùng 1 tháng Chạp Giáp Tý
{
  const c = generateChart(base(1985, 1, 21));
  assert.equal(c.lunarInfo.lunarYear, 1985, 'năm âm phải là 1985');
  assert.equal(c.lunarInfo.lunarMonth, 1, 'tháng Giêng');
  assert.equal(c.lunarInfo.lunarDay, 1, 'mùng 1');
}

// Ngày trước đó vẫn là năm Giáp Tý
{
  const c = generateChart(base(1985, 1, 20));
  assert.equal(c.lunarInfo.lunarYear, 1984, '20/1/1985 vẫn là năm âm 1984');
}

console.log('VN chart regression passed');
