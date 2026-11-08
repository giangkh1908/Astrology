/**
 * Múi giờ lịch sử của Việt Nam — dùng để đổi "giờ đồng hồ lúc sinh" ra giờ mặt trời thật,
 * và để chọn múi giờ tính âm lịch.
 *
 * Giờ dân sự (theo tzdb Asia/Ho_Chi_Minh, mốc tính theo UTC):
 *   trước 30/4/1911        UTC+7:06:30 (giờ Phù Liễn)
 *   1911 → 31/12/1942      UTC+7
 *   1/1/1943 → 14/3/1945   UTC+8   (toàn Đông Dương)
 *   15/3/1945 → 1/9/1945   UTC+9   (Nhật chiếm đóng)
 *   Miền Nam: 1/4/1947 → 30/6/1955 UTC+8; 1/7/1955 → 31/12/1959 UTC+7;
 *             1/1/1960 → 12/6/1975 UTC+8; từ 13/6/1975 UTC+7.
 *   Miền Bắc: từ 2/9/1945 UTC+7.
 *   (1947–1954 vùng do Pháp kiểm soát ở miền Bắc cũng dùng UTC+8 — trường hợp này người dùng
 *    tự chọn múi giờ trong form.)
 *
 * Âm lịch: trước 8/8/1967 Việt Nam dùng lịch tính theo giờ Bắc Kinh (UTC+8). Miền Bắc chuyển
 * sang UTC+7 từ 8/8/1967 (Tết Mậu Thân 1968 hai miền lệch một ngày); miền Nam dùng UTC+8 tới 1975.
 */

export type VnRegion = 'north' | 'south';

interface Segment { untilUtcMs: number; offsetMin: number }

const U = (y: number, m: number, d: number, h = 0) => Date.UTC(y, m - 1, d, h);

const COMMON_BEFORE_1945: Segment[] = [
  { untilUtcMs: U(1911, 4, 30, 17), offsetMin: 426.5 },
  { untilUtcMs: U(1942, 12, 31, 16), offsetMin: 420 },
  { untilUtcMs: U(1945, 3, 14, 15), offsetMin: 480 },
  { untilUtcMs: U(1945, 9, 1, 15), offsetMin: 540 },
];

const SOUTH_AFTER_1945: Segment[] = [
  { untilUtcMs: U(1947, 3, 31, 17), offsetMin: 420 },
  { untilUtcMs: U(1955, 6, 30, 17), offsetMin: 480 },
  { untilUtcMs: U(1959, 12, 31, 16), offsetMin: 420 },
  { untilUtcMs: U(1975, 6, 12, 16), offsetMin: 480 },
  { untilUtcMs: Infinity, offsetMin: 420 },
];

const NORTH_AFTER_1945: Segment[] = [{ untilUtcMs: Infinity, offsetMin: 420 }];

function offsetAtUtc(utcMs: number, region: VnRegion): number {
  const table = [...COMMON_BEFORE_1945, ...(region === 'south' ? SOUTH_AFTER_1945 : NORTH_AFTER_1945)];
  for (const seg of table) if (utcMs < seg.untilUtcMs) return seg.offsetMin;
  return 420;
}

/** Độ lệch giờ dân sự (phút, so với UTC) tại thời điểm đồng hồ treo tường y-m-d hh:mi ở miền `region`. */
export function vnCivilOffsetMinutes(
  y: number, m: number, d: number, hh: number, mi: number, region: VnRegion,
): number {
  const wall = Date.UTC(y, m - 1, d, hh, mi);
  let off = 420;
  for (let i = 0; i < 3; i++) off = offsetAtUtc(wall - off * 60_000, region);
  return off;
}

/** Múi giờ (giờ) dùng để tính âm lịch cho ngày sinh ở miền `region`. */
export function vnLunarTimeZone(y: number, m: number, d: number, region: VnRegion): 7 | 8 {
  const t = Date.UTC(y, m - 1, d);
  const switchDate = region === 'south' ? Date.UTC(1975, 5, 13) : Date.UTC(1967, 7, 8);
  return t >= switchDate ? 7 : 8;
}

export function formatUtcOffset(offsetMin: number): string {
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const h = Math.floor(abs / 60);
  const m = Math.round(abs % 60);
  return `UTC${sign}${h}${m ? `:${String(m).padStart(2, '0')}` : ''}`;
}
