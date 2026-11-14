/**
 * Lõi Kinh Dịch thuần (chạy được cả trình duyệt lẫn server): gieo 3 đồng xu, tính quẻ chính / hào động /
 * quẻ biến và trọng tâm luận theo số hào động (quy tắc Chu Hy). Không phụ thuộc dữ liệu lời kinh.
 */
import data from './data/hexagrams.json';

/** 6 = âm già (động), 7 = dương trẻ, 8 = âm trẻ, 9 = dương già (động). */
export type LineValue = 6 | 7 | 8 | 9;
export type Coin = 2 | 3;

export interface HexInfo {
  number: number;
  name: string;
  hanzi: string;
  upper: string;
  lower: string;
  /** Đáy → đỉnh, '1' = hào dương. */
  bits: string;
}

export type FocusKind = 'judgment' | 'lines' | 'both-judgments' | 'changed-static-lines' | 'use-all' | 'changed-judgment';
/** Trọng tâm luận: lines là số hào (1..6) của quẻ `of`; primary là hào làm chủ. */
export interface Focus { kind: FocusKind; of: 'main' | 'changed'; lines: number[]; primary?: number }

export interface Cast {
  lines: LineValue[];
  main: HexInfo;
  /** Số hào động 1..6, từ dưới lên. */
  moving: number[];
  changed: HexInfo | null;
  focus: Focus;
}

const BY_BITS = new Map<string, HexInfo>(
  data.hexagrams.map(h => [h.bits, { number: h.number, name: h.name, hanzi: h.hanzi, upper: h.upper, lower: h.lower, bits: h.bits }]),
);

/** Số ngẫu nhiên [0,1) từ crypto (an toàn cả trình duyệt lẫn Node). */
function cryptoRandom(): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
}

/** Một hào: 3 đồng xu, ngửa (rand >= 0.5) = 3, sấp = 2; tổng 6..9. */
export function castLine(rand: () => number = cryptoRandom): { coins: [Coin, Coin, Coin]; value: LineValue } {
  const coins = [0, 1, 2].map(() => (rand() >= 0.5 ? 3 : 2)) as [Coin, Coin, Coin];
  return { coins, value: (coins[0] + coins[1] + coins[2]) as LineValue };
}

/** Đúng 6 số nguyên trong 6..9, không thì null. */
export function parseLines(raw: unknown): LineValue[] | null {
  if (!Array.isArray(raw) || raw.length !== 6) return null;
  return raw.every(v => typeof v === 'number' && Number.isInteger(v) && v >= 6 && v <= 9) ? (raw as LineValue[]) : null;
}

export function hexagramByBits(bits: string): HexInfo {
  const h = BY_BITS.get(bits);
  if (!h) throw new Error(`Mẫu hào không hợp lệ: ${bits}`);
  return h;
}

export function hexagramByNumber(n: number): HexInfo | null {
  for (const h of BY_BITS.values()) if (h.number === n) return h;
  return null;
}

const isYang = (v: LineValue) => v === 7 || v === 9;
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

function focusOf(main: HexInfo, moving: number[]): Focus {
  const n = moving.length;
  if (n === 0) return { kind: 'judgment', of: 'main', lines: [] };
  if (n === 1 || n === 2) return { kind: 'lines', of: 'main', lines: moving, primary: moving[n - 1] };
  if (n === 3) return { kind: 'both-judgments', of: 'main', lines: moving };
  if (n === 6) {
    return main.number === 1 || main.number === 2
      ? { kind: 'use-all', of: 'main', lines: [] }
      : { kind: 'changed-judgment', of: 'changed', lines: [] };
  }
  const still = range(1, 6).filter(i => !moving.includes(i));
  return { kind: 'changed-static-lines', of: 'changed', lines: still, primary: still[0] };
}

export function computeCast(lines: LineValue[]): Cast {
  if (!parseLines(lines)) throw new Error('Cần đúng 6 hào, mỗi hào 6..9');
  const mainBits = lines.map(v => (isYang(v) ? '1' : '0')).join('');
  const moving = lines.flatMap((v, i) => (v === 6 || v === 9 ? [i + 1] : []));
  const main = hexagramByBits(mainBits);
  const changed = moving.length
    ? hexagramByBits(lines.map(v => (v === 9 ? '0' : v === 6 ? '1' : isYang(v) ? '1' : '0')).join(''))
    : null;
  return { lines: [...lines], main, moving, changed, focus: focusOf(main, moving) };
}

const POSITION = ['Sơ', 'Nhị', 'Tam', 'Tứ', 'Ngũ', 'Thượng'];

/** Tên hào truyền thống: Sơ Cửu, Lục Nhị, …, Thượng Lục. */
export function lineName(hex: HexInfo, n: number): string {
  const yinYang = hex.bits[n - 1] === '1' ? 'Cửu' : 'Lục';
  return n === 1 || n === 6 ? `${POSITION[n - 1]} ${yinYang}` : `${yinYang} ${POSITION[n - 1]}`;
}
