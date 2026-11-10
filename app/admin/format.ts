/** Định dạng hiển thị cho trang quản trị (không phụ thuộc React, test được). */
import { VI_BRANCHES, viSiHua, viStar } from '@/lib/vn/terms';

const UNKNOWN = '(không rõ)';

const DATE_TIME = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

/** ISO → "dd/mm/yyyy HH:mm" theo giờ Việt Nam. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return UNKNOWN;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return UNKNOWN;
  const p = Object.fromEntries(DATE_TIME.formatToParts(d).map(x => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

const pad = (n: number) => String(n).padStart(2, '0');
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

/** birthInfo đã lưu → "Tên · 05/03/1990 · giờ Sửu · Nam · sinh đôi (Huynh Đệ)". */
export function describeBirth(b: unknown): string {
  if (typeof b !== 'object' || b === null) return UNKNOWN;
  const o = b as Record<string, unknown>;
  const { year, month, day, hour } = o;
  if (!isInt(year) || !isInt(month) || !isInt(day) || !isInt(hour) || hour < 0 || hour > 11) return UNKNOWN;
  const parts: string[] = [];
  if (typeof o.name === 'string' && o.name.trim()) parts.push(o.name.trim());
  parts.push(`${pad(day)}/${pad(month)}/${year}`, `giờ ${VI_BRANCHES[hour]}`);
  if (o.gender === 'male') parts.push('Nam');
  else if (o.gender === 'female') parts.push('Nữ');
  if (o.twinMethod === 'huynh_de') parts.push('sinh đôi (Huynh Đệ)');
  else if (o.twinMethod === 'thien_di') parts.push('sinh đôi (Thiên Di)');
  return parts.join(' · ');
}

const TOPIC_LABELS: Record<string, string> = {
  overview: 'Tổng quan · Mệnh cách',
  love: 'Tình cảm',
  career: 'Sự nghiệp',
  wealth: 'Tài vận',
  health: 'Sức khỏe',
  personality: 'Tính cách',
};
const VIEW_LABELS: Record<string, string> = { mingpan: 'Mệnh bàn', daxian: 'Đại hạn', liunian: 'Lưu niên' };

/**
 * Khóa luồng chat → nhãn tiếng Việt. palaceName (nếu có) tra tên cung theo chỉ số địa chi.
 * Khóa lạ giữ nguyên (React tự escape khi hiển thị).
 */
export function threadLabel(threadKey: string, palaceName?: (branch: number) => string | undefined): string {
  const topic = threadKey.startsWith('topic-') ? threadKey.slice(6) : threadKey;
  if (Object.hasOwn(TOPIC_LABELS, topic)) return TOPIC_LABELS[topic];
  if (threadKey === 'heming') return 'Hợp bàn';

  const palace = /^palace[:-](\d{1,2})$/.exec(threadKey);
  if (palace) {
    const branch = Number(palace[1]);
    if (branch <= 11) {
      const name = palaceName?.(branch);
      return name ? `Cung ${name}` : `Cung tại ${VI_BRANCHES[branch]}`;
    }
  }

  if (threadKey.startsWith('sihua:')) {
    const [, view = '', star = '', hua = ''] = threadKey.split(':');
    const viewLabel = Object.hasOwn(VIEW_LABELS, view) ? VIEW_LABELS[view] : view;
    return ['Tứ hóa', viewLabel, `${viStar(star)} hóa ${viSiHua(hua)}`].filter(Boolean).join(' · ');
  }
  return threadKey;
}
