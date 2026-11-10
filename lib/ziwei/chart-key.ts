import type { BirthInfo } from './types';

/**
 * Khóa nhận diện một lá số: ngày giờ sinh, giới tính, múi giờ âm lịch, cách sinh đôi.
 * Dùng chung cho localStorage (InsightPanel) và DB. birthInfo có thể đến từ client nên mọi phần
 * được ép kiểu/whitelist: khóa chỉ gồm số và giá trị đã biết.
 */
export function chartKey(b: BirthInfo): string {
  const num = (v: unknown) => String(Math.trunc(Number(v)));
  const gender = b.gender === 'male' || b.gender === 'female' ? b.gender : 'unknown';
  const tz = b.lunarTimeZone === 7 ? 7 : 8;
  const twin = b.twinMethod === 'huynh_de' || b.twinMethod === 'thien_di' ? `-twin-${b.twinMethod}` : '';
  return `${num(b.year)}-${num(b.month)}-${num(b.day)}-${num(b.hour)}-${gender}-${tz}${twin}`;
}
