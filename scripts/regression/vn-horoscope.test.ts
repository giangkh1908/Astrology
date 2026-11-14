/** Lưu niên, lưu nguyệt tính theo âm lịch Việt Nam (UTC+7) của ngày xem, không theo lịch TQ của engine. */
import assert from 'node:assert/strict';
import { getHoroscope, createHoroscopeReader } from '../../lib/ziwei/algorithm';
import type { BirthInfo } from '../../lib/ziwei/types';

const info: BirthInfo = {
  year: 1990, month: 2, day: 3, hour: 4, gender: 'male', longitude: 105.85, utcOffsetMinutes: 420, region: 'north', lunarTimeZone: 7,
};

// 2/2/2030 là mùng 1 Tết Canh Tuất ở VN, TQ còn là 30 tháng Chạp Kỷ Dậu
{
  const h = getHoroscope(info, { year: 2030, month: 2, day: 2 });
  assert.equal(h.yearly.earthlyBranch, '戌', `2/2/2030 phải là năm Tuất, nhận ${h.yearly.earthlyBranch}`);
  const read = createHoroscopeReader(info);
  assert.equal(read({ year: 2030, month: 2, day: 2 }).yearly.earthlyBranch, '戌', 'reader cũng phải theo lịch VN');
}

// 14/12/2020: VN đã sang tháng 11 âm, TQ còn tháng 10
{
  const vn = getHoroscope(info, { year: 2020, month: 12, day: 14 });
  const next = getHoroscope(info, { year: 2020, month: 12, day: 20 });
  assert.equal(vn.monthly.earthlyBranch, next.monthly.earthlyBranch, '14/12/2020 cùng tháng âm với 20/12/2020 theo lịch VN');
}

// Ngày hai lịch trùng nhau: không đổi gì
{
  const h = getHoroscope(info, { year: 2026, month: 6, day: 15 });
  assert.equal(h.yearly.earthlyBranch, '午', '2026 là năm Ngọ');
}

console.log('VN horoscope regression passed');
