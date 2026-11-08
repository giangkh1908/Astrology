import type { BirthFormState } from '@/components/BirthForm';
import type { BirthInfo } from './types';
import { branchFromSolarMinutes, resolveZiweiDayOffset, shiftGregorianDate } from './true-solar-time';
import { findVnCity } from '../vn/provinces';
import { vnCivilOffsetMinutes, vnLunarTimeZone, type VnRegion } from '../vn/timezone-vn';

/** Kinh độ mặc định (Hà Nội) khi chưa chọn nơi sinh. */
export const DEFAULT_LONGITUDE = 105.85;

/**
 * Giờ mặt trời thật → chi giờ (0-11).
 * Phút giờ mặt trời = giờ đồng hồ + kinh độ x 4 - độ lệch múi giờ (phút).
 * `utcOffsetMinutes` mặc định 480 (UTC+8) để giữ tương thích với bản gốc (kinh tuyến chuẩn 120°).
 */
export function calcTrueSolarBranch(
  clockHour: number,
  clockMinute: number,
  longitude: number,
  utcOffsetMinutes = 480,
): number {
  const clockMins = clockHour * 60 + clockMinute;
  const solar = (((clockMins + longitude * 4 - utcOffsetMinutes) % 1440) + 1440) % 1440;
  return branchFromSolarMinutes(solar);
}

/** Độ lệch múi giờ (phút) và miền áp dụng cho một form, theo ngày giờ đồng hồ người dùng nhập. */
export function resolveFormTimeContext(form: BirthFormState): {
  region: VnRegion;
  utcOffsetMinutes: number;
  /** Kinh độ dùng để tính giờ mặt trời (chưa chọn tỉnh thì = kinh tuyến múi giờ, tức không hiệu chỉnh). */
  longitude: number;
} {
  const region: VnRegion = findVnCity(form.province, form.city).region;
  const y = parseInt(form.year) || 0;
  const m = parseInt(form.month) || 0;
  const d = parseInt(form.day) || 0;
  const hh = form.unknownTime ? 0 : (parseInt(form.clockHour) || 0);
  const mi = form.unknownTime ? 0 : (parseInt(form.clockMinute) || 0);
  const override = form.tzOverride ? parseInt(form.tzOverride) : NaN;
  const utcOffsetMinutes = Number.isFinite(override)
    ? override
    : (y > 0 && m > 0 && d > 0 ? vnCivilOffsetMinutes(y, m, d, hh, mi, region) : 420);
  const longitude = form.province ? form.longitude : utcOffsetMinutes / 4;
  return { region, utcOffsetMinutes, longitude };
}

/** BirthFormState → BirthInfo
 *
 * Quy tắc giờ Tý (giữ nguyên bản gốc):
 * - 23:00-23:59 = giờ Tý muộn, lập lá số theo **ngày hôm sau** (ngày +1)
 * - 00:00-00:59 = giờ Tý sớm, lập theo ngày hôm nay
 * Đều xét theo giờ mặt trời thật (không phải giờ đồng hồ).
 */
export function formToBirthInfo(form: BirthFormState): BirthInfo {
  let y = parseInt(form.year) || 0;
  let m = parseInt(form.month) || 0;
  let d = parseInt(form.day) || 0;
  let hour = 0;

  const { region, utcOffsetMinutes, longitude } = resolveFormTimeContext(form);

  if (!form.unknownTime) {
    const clockMins = (parseInt(form.clockHour) || 0) * 60 + (parseInt(form.clockMinute) || 0);
    const solar = clockMins + longitude * 4 - utcOffsetMinutes;
    const normalizedMinutes = ((solar % 1440) + 1440) % 1440;
    hour = branchFromSolarMinutes(normalizedMinutes);
    const dayOffset = resolveZiweiDayOffset({ dayOffset: Math.floor(solar / 1440), normalizedMinutes, branch: hour });
    if (dayOffset !== 0 && y > 0 && m > 0 && d > 0) {
      ({ year: y, month: m, day: d } = shiftGregorianDate({ year: y, month: m, day: d }, dayOffset));
    }
  }

  return {
    year: y, month: m, day: d,
    hour,
    gender: form.gender,
    name: form.name || undefined,
    province: form.province || undefined,
    city: form.city || undefined,
    longitude: form.province ? form.longitude : undefined,
    utcOffsetMinutes,
    region,
    lunarTimeZone: y > 0 && m > 0 && d > 0 ? vnLunarTimeZone(y, m, d, region) : undefined,
  };
}

/** BirthFormState → URLSearchParams（用于分享链接） */
export function formToSearchParams(form: BirthFormState): URLSearchParams {
  const p = new URLSearchParams();
  if (form.name) p.set('n', form.name);
  p.set('y', form.year);
  p.set('m', form.month);
  p.set('d', form.day);
  if (form.unknownTime) {
    p.set('u', '1');
  } else {
    p.set('h', form.clockHour);
    p.set('mi', form.clockMinute);
  }
  if (form.province) p.set('p', form.province);
  if (form.city) p.set('c', form.city);
  if (form.longitude && form.longitude !== DEFAULT_LONGITUDE) p.set('lo', String(form.longitude));
  if (form.tzOverride) p.set('tz', form.tzOverride);
  p.set('g', form.gender === 'male' ? 'm' : 'f');
  return p;
}

/** URLSearchParams → Partial<BirthFormState>，不完整时返回 null */
export function searchParamsToForm(params: URLSearchParams): Partial<BirthFormState> | null {
  const year = params.get('y');
  const month = params.get('m');
  const day = params.get('d');
  if (!year || !month || !day) return null;
  return {
    name: params.get('n') || '',
    year,
    month,
    day,
    unknownTime: params.get('u') === '1',
    clockHour: params.get('h') || '8',
    clockMinute: params.get('mi') || '0',
    province: params.get('p') || '',
    city: params.get('c') || '',
    tzOverride: ['420', '480', '540'].includes(params.get('tz') || '') ? (params.get('tz') as string) : '',
    longitude: parseFloat(params.get('lo') || String(DEFAULT_LONGITUDE)),
    gender: params.get('g') === 'f' ? 'female' : 'male',
  };
}
