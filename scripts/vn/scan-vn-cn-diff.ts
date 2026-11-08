/**
 * Quét các ngày dương lịch mà âm lịch Việt Nam (UTC+7) khác âm lịch Trung Quốc (UTC+8).
 * Chạy: npx tsx scripts/vn/scan-vn-cn-diff.ts [từ năm] [đến năm]
 * Chỉ tính từ khi Việt Nam dùng UTC+7 cho lịch (Bắc: 8/8/1967; Nam: 13/6/1975).
 */
import { solarToLunarVN, sameLunarDate } from '../../lib/vn/lunar-vn';
import { vnLunarTimeZone } from '../../lib/vn/timezone-vn';

const from = Number(process.argv[2] ?? 1967);
const to = Number(process.argv[3] ?? 2100);

for (const region of ['north', 'south'] as const) {
  let days = 0, diffDays = 0, newYearShift = 0, leapShift = 0;
  const tetDiff: string[] = [];
  for (let t = Date.UTC(from, 0, 1); t <= Date.UTC(to, 11, 31); t += 86_400_000) {
    const d = new Date(t);
    const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, dd = d.getUTCDate();
    days++;
    const tz = vnLunarTimeZone(y, m, dd, region);
    if (tz === 8) continue;
    const vn = solarToLunarVN(dd, m, y, 7);
    const cn = solarToLunarVN(dd, m, y, 8);
    if (sameLunarDate(vn, cn)) continue;
    diffDays++;
    if (vn.year !== cn.year) newYearShift++;
    if (vn.leap !== cn.leap || vn.month !== cn.month) leapShift++;
    if (vn.day === 1 && vn.month === 1 && !vn.leap) tetDiff.push(`${dd}/${m}/${y}`);
  }
  console.log(`\n== Miền ${region === 'north' ? 'Bắc' : 'Nam'} ${from}–${to}: ${days} ngày`);
  console.log(`  Âm lịch VN ≠ TQ: ${diffDays} ngày (${(100 * diffDays / days).toFixed(2)}%)`);
  console.log(`  — trong đó khác tháng âm (kể cả nhuận): ${leapShift} ngày; khác năm âm: ${newYearShift} ngày`);
  console.log(`  Tết Nguyên đán VN khác TQ: ${tetDiff.length} năm${tetDiff.length ? ' → ' + tetDiff.join(', ') : ''}`);
}
