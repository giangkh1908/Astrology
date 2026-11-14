/**
 * Tra lời kinh 64 quẻ (port từ dich-so — xem data/NOTICE.md). Chỉ đọc, không sửa nội dung.
 * textHV/gloss/extra: theo bản dịch Ngô Tất Tố; modern/modernShort: diễn giải hiện đại của dich-so (CC BY 4.0).
 */
import data from './data/hexagrams.json';

export interface LineText { textHV: string; gloss: string; modern: string }
export interface HexText {
  number: number;
  name: string;
  judgment: string;
  image: string;
  modernShort: string;
  lines: LineText[];
  extra?: LineText;
}

export const ATTRIBUTION =
  'Hào từ theo bản dịch “Kinh Dịch trọn bộ” của Ngô Tất Tố · Thoán, Tượng và diễn giải hiện đại: dự án dich-so (CC BY 4.0)';
export const DICH_SO_URL = data.source;

const BY_NUMBER = new Map<number, HexText>(data.hexagrams.map(h => [h.number, h as HexText]));

export function hexagramText(n: number): HexText {
  const t = BY_NUMBER.get(n);
  if (!t) throw new Error(`Không có quẻ số ${n}`);
  return t;
}
