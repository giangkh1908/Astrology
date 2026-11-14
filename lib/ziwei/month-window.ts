/**
 * Khung 3 tháng âm lịch (prompt v3): luận tương lai gần theo từng tháng, nhảy 3 tháng một lần.
 * Đếm theo số tháng 1–12, không tính tháng nhuận riêng (đúng quy ước lưu nguyệt của tool xem_van_han).
 * Dùng được ở cả client lẫn server.
 */
import { lunarMonthsVN, solarToLunarVN, type LunarMonthRangeVN } from '@/lib/vn/lunar-vn';

export interface MonthWindow { lunarYear: number; startMonth: number }

export const WINDOW_SIZE = 3;

const toIndex = (w: MonthWindow) => w.lunarYear * 12 + (w.startMonth - 1);
const fromIndex = (i: number): MonthWindow => ({ lunarYear: Math.floor(i / 12), startMonth: (i % 12) + 1 });

/** Khung mặc định: bắt đầu ở tháng âm hiện tại theo giờ Việt Nam. */
export function defaultWindow(now: Date = new Date()): MonthWindow {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(now).map(p => [p.type, p.value]));
  const l = solarToLunarVN(Number(parts.day), Number(parts.month), Number(parts.year), 7);
  return { lunarYear: l.year, startMonth: l.month };
}

export function shiftWindow(w: MonthWindow, steps: number): MonthWindow {
  return fromIndex(toIndex(w) + steps * WINDOW_SIZE);
}

export function windowMonths(w: MonthWindow): Array<{ lunarYear: number; month: number }> {
  return Array.from({ length: WINDOW_SIZE }, (_, k) => {
    const m = fromIndex(toIndex(w) + k);
    return { lunarYear: m.lunarYear, month: m.startMonth };
  });
}

export function isBeforeDefault(w: MonthWindow, now: Date = new Date()): boolean {
  return toIndex(w) < toIndex(defaultWindow(now));
}

const fmt = (d: { day: number; month: number; year: number }) =>
  `${String(d.day).padStart(2, '0')}/${String(d.month).padStart(2, '0')}/${d.year}`;
const monthRange = (lunarYear: number, month: number): LunarMonthRangeVN | undefined =>
  lunarMonthsVN(lunarYear).find(m => m.month === month && !m.leap);

/** Nhãn khung: "Tháng 10 – 12 âm" (vắt năm: "Tháng 11/2026 – 1/2027 âm") + khoảng dương lịch. */
export function windowLabel(w: MonthWindow): { months: string; solar: string } {
  const list = windowMonths(w);
  const first = list[0];
  const last = list[list.length - 1];
  const months = first.lunarYear === last.lunarYear
    ? `Tháng ${first.month} – ${last.month} âm`
    : `Tháng ${first.month}/${first.lunarYear} – ${last.month}/${last.lunarYear} âm`;
  const start = monthRange(first.lunarYear, first.month);
  const end = monthRange(last.lunarYear, last.month);
  return { months, solar: start && end ? `${fmt(start.start)} – ${fmt(end.end)}` : '' };
}

/** Khung client gửi lên; sai kiểu hoặc ngoài phạm vi thì undefined. */
export function parseWindow(v: unknown): MonthWindow | undefined {
  if (typeof v !== 'object' || v === null) return undefined;
  const { lunarYear, startMonth } = v as Record<string, unknown>;
  if (!Number.isInteger(lunarYear) || !Number.isInteger(startMonth)) return undefined;
  const y = lunarYear as number;
  const m = startMonth as number;
  if (y < 1900 || y > 2100 || m < 1 || m > 12) return undefined;
  return { lunarYear: y, startMonth: m };
}
