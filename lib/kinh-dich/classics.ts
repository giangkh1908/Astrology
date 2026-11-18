/**
 * Kinh văn cổ chữ Hán (phồn thể, nguyên văn Wikisource — phạm vi công cộng, xem data/NOTICE.md) cho 64 quẻ:
 * 彖傳, 小象, 文言 (乾/坤), 序卦, 雜卦, cùng 程傳 (Trình Di) và 本義 (Chu Hy) cho thoán từ và từng hào.
 * Dựng bằng scripts/kinh-dich/build-classics.ts. Chỉ đọc.
 */
import data from './data/classics.json';

export interface Commentary {
  /** 程傳 — 伊川易傳 của Trình Di (1033–1107) */
  cheng: string;
  /** 本義 — 周易本義 của Chu Hy (1130–1200) */
  benyi: string;
}

export interface Classics {
  /** 彖傳 (Thoán truyện) */
  tuan: string;
  /** 小象 của 6 hào, từ hào sơ đến hào thượng */
  xiaoXiang: string[];
  /** 用九 (乾) / 用六 (坤) */
  yong?: { xiaoXiang: string } & Commentary;
  /** 文言 — chỉ 乾 và 坤 */
  wenyan?: string;
  /** 序卦: câu nói vì sao quẻ này nối quẻ trước */
  xugua: string;
  /** 雜卦: nguyên câu (thường là cặp quẻ đối nhau) có quẻ này */
  zagua: string;
  /** 程傳/本義 cho thoán từ (卦辭) */
  judgment: Commentary;
  /** 程傳/本義 cho 6 hào, từ hào sơ đến hào thượng */
  lines: Commentary[];
}

export const CLASSICS_SOURCES = data.sources;

const BY_NUMBER = data.hexagrams as unknown as Record<string, Classics>;

export function classicsOf(n: number): Classics {
  const c = BY_NUMBER[String(n)];
  if (!c) throw new Error(`Không có kinh văn cho quẻ số ${n}`);
  return c;
}
