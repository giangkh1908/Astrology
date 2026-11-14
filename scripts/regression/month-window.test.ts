import assert from 'node:assert/strict';
import {
  defaultWindow, isBeforeDefault, parseWindow, shiftWindow, windowLabel, windowMonths,
} from '../../lib/ziwei/month-window';
import { lunarMonthsVN, solarToLunarVN } from '../../lib/vn/lunar-vn';

// Khung 3 tháng âm lịch cho prompt v3: mặc định từ tháng âm hiện tại (giờ VN), nhảy 3 tháng một lần.

assert.deepEqual(shiftWindow({ lunarYear: 2026, startMonth: 11 }, 1), { lunarYear: 2027, startMonth: 2 });
assert.deepEqual(shiftWindow({ lunarYear: 2027, startMonth: 1 }, -1), { lunarYear: 2026, startMonth: 10 });
assert.deepEqual(shiftWindow({ lunarYear: 2026, startMonth: 4 }, 3), { lunarYear: 2027, startMonth: 1 });

// Khung vắt qua cuối năm âm
assert.deepEqual(windowMonths({ lunarYear: 2026, startMonth: 11 }), [
  { lunarYear: 2026, month: 11 }, { lunarYear: 2026, month: 12 }, { lunarYear: 2027, month: 1 },
]);

// Validate input từ client
assert.equal(parseWindow({ lunarYear: 2026, startMonth: 13 }), undefined);
assert.equal(parseWindow({ lunarYear: 1800, startMonth: 1 }), undefined);
assert.equal(parseWindow('x'), undefined);
assert.equal(parseWindow({ lunarYear: 2026.5, startMonth: 1 }), undefined);
assert.deepEqual(parseWindow({ lunarYear: 2026, startMonth: 10, extra: 1 }), { lunarYear: 2026, startMonth: 10 });

// Nhãn: tháng + khoảng dương lịch lấy từ lịch âm VN
const months2026 = lunarMonthsVN(2026).filter(m => !m.leap);
const fmt = (d: { day: number; month: number; year: number }) => `${String(d.day).padStart(2, '0')}/${String(d.month).padStart(2, '0')}/${d.year}`;
const l1 = windowLabel({ lunarYear: 2026, startMonth: 10 });
assert.equal(l1.months, 'Tháng 10 – 12 âm');
assert.equal(l1.solar, `${fmt(months2026.find(m => m.month === 10)!.start)} – ${fmt(months2026.find(m => m.month === 12)!.end)}`);
const l2 = windowLabel({ lunarYear: 2026, startMonth: 11 });
assert.equal(l2.months, 'Tháng 11/2026 – 1/2027 âm');
assert.equal(l2.solar.slice(-10), fmt(lunarMonthsVN(2027).find(m => m.month === 1 && !m.leap)!.end));

// Mặc định theo ngày hiện tại giờ Việt Nam
const now = new Date('2026-11-14T05:00:00Z');
const lunar = solarToLunarVN(14, 11, 2026, 7);
assert.deepEqual(defaultWindow(now), { lunarYear: lunar.year, startMonth: lunar.month });
// 23:30 ngày 30/11 giờ UTC = 06:30 ngày 1/12 giờ VN
const late = new Date('2026-11-30T23:30:00Z');
const lunarLate = solarToLunarVN(1, 12, 2026, 7);
assert.deepEqual(defaultWindow(late), { lunarYear: lunarLate.year, startMonth: lunarLate.month });

// Không lùi trước khung mặc định
const def = defaultWindow(now);
assert.equal(isBeforeDefault(def, now), false);
assert.equal(isBeforeDefault(shiftWindow(def, -1), now), true);
assert.equal(isBeforeDefault(shiftWindow(def, 1), now), false);

console.log('month-window: ok');
