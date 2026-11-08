/**
 * Âm lịch Việt Nam — thuật toán của Hồ Ngọc Đức (https://www.informatik.uni-leipzig.de/~duc/amlich/).
 *
 * Âm lịch Việt và âm lịch Trung Quốc dùng cùng một quy tắc (tháng bắt đầu từ ngày Sóc,
 * tháng không có Trung khí là tháng nhuận), chỉ khác MÚI GIỜ dùng để xác định "ngày":
 *   - Trung Quốc: UTC+8 (giờ Bắc Kinh)
 *   - Việt Nam:   UTC+7 (từ 1968 ở miền Bắc; cả nước từ 13/6/1975)
 * Khi điểm Sóc rơi vào khoảng 23:00–24:00 giờ Hà Nội (00:00–01:00 Bắc Kinh), tháng âm của Việt Nam
 * bắt đầu sớm hơn Trung Quốc một ngày; đôi khi tháng nhuận cũng lệch (vd. Tết Ất Sửu 1985:
 * VN 21/1/1985, TQ 20/2/1985).
 *
 * `timeZone` tính bằng giờ (7, 8, 9...). Với miền Nam 1960–1975 (UTC+8) truyền 8.
 */

const PI = Math.PI;
const INT = Math.floor;

export interface LunarDateVN {
  day: number;
  month: number;   // 1–12
  year: number;    // năm âm lịch (đổi năm ở mùng 1 Tết)
  leap: boolean;   // tháng nhuận
}

export function jdFromDate(dd: number, mm: number, yy: number): number {
  const a = INT((14 - mm) / 12);
  const y = yy + 4800 - a;
  const m = mm + 12 * a - 3;
  let jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045;
  if (jd < 2299161) jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
  return jd;
}

export function jdToDate(jd: number): { day: number; month: number; year: number } {
  let b: number;
  let c: number;
  if (jd > 2299160) {
    const a = jd + 32044;
    b = INT((4 * a + 3) / 146097);
    c = a - INT((b * 146097) / 4);
  } else {
    b = 0;
    c = jd + 32082;
  }
  const d = INT((4 * c + 3) / 1461);
  const e = c - INT((1461 * d) / 4);
  const m = INT((5 * e + 2) / 153);
  return {
    day: e - INT((153 * m + 2) / 5) + 1,
    month: m + 3 - 12 * INT(m / 10),
    year: b * 100 + d - 4800 + INT(m / 10),
  };
}

/** Thời điểm Sóc thứ k (tính từ 1/1/1900), Julian day (UT). */
function newMoon(k: number): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = PI / 180;
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
  C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr);
  C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
  C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
  C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
  C1 = C1 + 0.0010 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
  const deltat = T < -11
    ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
    : -0.000278 + 0.000265 * T + 0.000262 * T2;
  return Jd1 + C1 - deltat;
}

/** Kinh độ mặt trời (radian, 0..2π) tại Julian day jdn. */
function sunLongitude(jdn: number): number {
  const T = (jdn - 2451545.0) / 36525;
  const T2 = T * T;
  const dr = PI / 180;
  const M = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
  DL = DL + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.000290 * Math.sin(dr * 3 * M);
  let L = (L0 + DL) * dr;
  L = L - PI * 2 * INT(L / (PI * 2));
  return L;
}

function getNewMoonDay(k: number, timeZone: number): number {
  return INT(newMoon(k) + 0.5 + timeZone / 24);
}

/** Cung hoàng đạo (0..11) của mặt trời vào đầu ngày dayNumber. */
function getSunLongitude(dayNumber: number, timeZone: number): number {
  return INT((sunLongitude(dayNumber - 0.5 - timeZone / 24) / PI) * 6);
}

/** Ngày bắt đầu tháng 11 âm lịch (tháng chứa Đông chí) của năm yy. */
function getLunarMonth11(yy: number, timeZone: number): number {
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = INT(off / 29.530588853);
  let nm = getNewMoonDay(k, timeZone);
  const sunLong = getSunLongitude(nm, timeZone);
  if (sunLong >= 9) nm = getNewMoonDay(k - 1, timeZone);
  return nm;
}

function getLeapMonthOffset(a11: number, timeZone: number): number {
  const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last: number;
  let i = 1;
  let arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  do {
    last = arc;
    i++;
    arc = getSunLongitude(getNewMoonDay(k + i, timeZone), timeZone);
  } while (arc !== last && i < 14);
  return i - 1;
}

/** Dương lịch → âm lịch theo múi giờ `timeZone` (giờ). Mặc định 7 (Việt Nam). */
export function solarToLunarVN(dd: number, mm: number, yy: number, timeZone = 7): LunarDateVN {
  const dayNumber = jdFromDate(dd, mm, yy);
  const k = INT((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = getNewMoonDay(k + 1, timeZone);
  if (monthStart > dayNumber) monthStart = getNewMoonDay(k, timeZone);
  let a11 = getLunarMonth11(yy, timeZone);
  let b11 = a11;
  let lunarYear: number;
  if (a11 >= monthStart) {
    lunarYear = yy;
    a11 = getLunarMonth11(yy - 1, timeZone);
  } else {
    lunarYear = yy + 1;
    b11 = getLunarMonth11(yy + 1, timeZone);
  }
  const lunarDay = dayNumber - monthStart + 1;
  const diff = INT((monthStart - a11) / 29);
  let lunarLeap = false;
  let lunarMonth = diff + 11;
  if (b11 - a11 > 365) {
    const leapMonthDiff = getLeapMonthOffset(a11, timeZone);
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10;
      if (diff === leapMonthDiff) lunarLeap = true;
    }
  }
  if (lunarMonth > 12) lunarMonth -= 12;
  if (lunarMonth >= 11 && diff < 4) lunarYear -= 1;
  return { day: lunarDay, month: lunarMonth, year: lunarYear, leap: lunarLeap };
}

export function sameLunarDate(a: LunarDateVN, b: LunarDateVN): boolean {
  return a.day === b.day && a.month === b.month && a.year === b.year && a.leap === b.leap;
}

/** Current Vietnamese lunar-year label, using the Asia/Ho_Chi_Minh civil date and UTC+7 calendar. */
export function currentVnLunarYear(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return solarToLunarVN(Number(values.day), Number(values.month), Number(values.year), 7).year;
}

export interface LunarMonthRangeVN {
  year: number;
  month: number;
  leap: boolean;
  /** Ngày dương lịch đầu và cuối tháng âm */
  start: { day: number; month: number; year: number };
  end: { day: number; month: number; year: number };
}

/** Các tháng âm lịch VN (kể cả tháng nhuận) của năm âm `lunarYear`, kèm khoảng ngày dương lịch. */
export function lunarMonthsVN(lunarYear: number, timeZone = 7): LunarMonthRangeVN[] {
  const months: LunarMonthRangeVN[] = [];
  // Năm âm bắt đầu khoảng 21/1–20/2 dương lịch và kéo dài tới đầu năm dương sau.
  const from = jdFromDate(10, 1, lunarYear);
  const to = jdFromDate(10, 3, lunarYear + 1);
  for (let jd = from; jd <= to; jd++) {
    const d = jdToDate(jd);
    const l = solarToLunarVN(d.day, d.month, d.year, timeZone);
    if (l.year !== lunarYear) continue;
    const last = months[months.length - 1];
    if (last && last.month === l.month && last.leap === l.leap) last.end = d;
    else months.push({ year: l.year, month: l.month, leap: l.leap, start: d, end: d });
  }
  return months;
}
