/**
 * Kiểm tra tự động (chỉ bằng code, không gọi AI) một bài luận quẻ đã viết xong, để đo tỉ lệ "bịa":
 *  - unknown_hexagram: nhắc tên quẻ không thuộc quẻ chính / biến / hỗ / thác / tổng (hay quẻ Tự quái, Tạp quái nêu).
 *  - trigram_position: đặt một quái đơn sai nửa (nội/ngoại, trên/dưới) so với quẻ đang nói tới.
 *  - unsourced_quote: cụm Hán Việt in đậm/trong ngoặc không có trong lời kinh được cấp (Hán Việt Ngô Tất Tố hoặc
 *    phiên âm từ nguyên văn chữ Hán của quẻ chính, quẻ biến).
 *  - example_copy: câu trùng phần lớn với câu trong phần ví dụ của prompt tĩnh.
 *  - banned_label / banned_phrase: lộ nhãn nội bộ, dùng cụm sáo bị cấm.
 *  - han_chars: có chữ Hán trong bài.
 * Ưu tiên độ chính xác hơn độ phủ: chỗ nào mơ hồ thì bỏ qua, không gắn cờ. Không sửa được bài đã stream; dùng
 * để ghi log và chấm eval.
 */
import data from './data/hexagrams.json';
import hanviet from './data/hanviet.json';
import { relatedHexagrams } from './analysis';
import { classicsOf } from './classics';
import type { Cast, HexInfo } from './core';
import { allowedHexagrams } from './prompt';
import { EXAMPLES } from './prompt-static';
import { hexagramText } from './texts';

export type VerifyFlagKind =
  | 'unknown_hexagram' | 'trigram_position' | 'image_phrase' | 'foreign_image' | 'unsourced_quote' | 'example_copy' | 'banned_label' | 'banned_phrase' | 'han_chars';
export interface VerifyFlag { kind: VerifyFlagKind; detail: string; excerpt?: string }
export interface VerifyResult { flags: VerifyFlag[] }

type Role = 'main' | 'changed' | 'hỗ' | 'thác' | 'tổng' | 'biến_hỗ';
export interface VerifyContext {
  /** Quẻ được phép nhắc, theo vai. */
  roles: Partial<Record<Role, HexInfo>>;
  /** Số các quẻ được phép nhắc (gồm cả quẻ Tự quái / Tạp quái của quẻ chính nêu tên). */
  allowed: Set<number>;
  /** Hán Việt (Ngô Tất Tố) của quẻ chính + biến, đã chuẩn hoá. */
  hvCorpus: string;
  /** Các đoạn nguyên văn chữ Hán (chỉ giữ chữ Hán) của quẻ chính + biến. */
  hanPassages: string[];
  /** Phần ví dụ của prompt tĩnh. */
  examples: string;
}

// ---------------------------------------------------------------- Chuẩn hoá

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const words = (s: string) => s.normalize('NFC').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
const foldWords = (s: string) => words(s).map(fold);
const isHan = (c: string) => /\p{Script=Han}/u.test(c);
const excerptAt = (text: string, i: number, len: number) =>
  text.slice(Math.max(0, i - 40), Math.min(text.length, i + len + 40)).replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------- Dữ liệu tĩnh

interface HexRow { number: number; name: string; hanzi: string; upper: string; lower: string; bits: string }
const HEXES = (data.hexagrams as HexRow[]).map(h => ({ ...h }));
const BY_NUMBER = new Map(HEXES.map(h => [h.number, h]));

const TRIGRAM_NAMES = ['Càn', 'Khôn', 'Chấn', 'Tốn', 'Khảm', 'Ly', 'Cấn', 'Đoài'] as const;
const TRIGRAM_IMAGE: Record<string, string> = { trời: 'Càn', đất: 'Khôn', sấm: 'Chấn', gió: 'Tốn', nước: 'Khảm', lửa: 'Ly', núi: 'Cấn', đầm: 'Đoài' };
/** Chữ Hán Việt trong tên ghép kiểu "Thủy Lôi Truân" (quái trên trước, quái dưới sau). */
const TRIGRAM_HAN: Record<string, string> = {
  Thiên: 'Càn', Địa: 'Khôn', Lôi: 'Chấn', Phong: 'Tốn', Thủy: 'Khảm', Thuỷ: 'Khảm', Hỏa: 'Ly', Hoả: 'Ly', Sơn: 'Cấn', Trạch: 'Đoài',
};

/** Tên gọi của từng quẻ. Quẻ thuần chỉ nhận dạng đầy đủ ("Thuần Càn", "Bát Thuần Càn") vì "Càn" trần là tên quái đơn. */
const ALIASES: { number: number; alias: string; single: boolean }[] = (() => {
  const variants: Record<string, string[]> = { Tỷ: ['Tỉ'], Lý: ['Lí'], Tùy: ['Tuỳ'], Tụy: ['Tuỵ'], 'Tập Khảm': ['Thuần Khảm'], 'Đại Súc': ['Đại Xúc'], 'Tiểu Súc': ['Tiểu Xúc'] };
  const out: { number: number; alias: string; single: boolean }[] = [];
  for (const h of HEXES) {
    for (const a of [h.name, ...(variants[h.name] ?? [])]) out.push({ number: h.number, alias: a, single: !a.includes(' ') });
  }
  return out.sort((a, b) => b.alias.length - a.alias.length);
})();

const HV_SYLLABLES: Set<string> = (() => {
  const s = new Set<string>();
  for (const r of Object.values((hanviet as { chars: Record<string, string> }).chars)) for (const w of words(r)) s.add(w);
  for (const h of data.hexagrams as { lines: { textHV: string }[]; extra?: { textHV: string }; name: string }[]) {
    for (const l of [...h.lines, ...(h.extra ? [h.extra] : [])]) for (const w of words(l.textHV)) s.add(w);
    for (const w of words(h.name)) s.add(w);
  }
  return s;
})();
const HV_READINGS: Record<string, string[]> = Object.fromEntries(
  Object.entries((hanviet as { chars: Record<string, string> }).chars).map(([c, r]) => [c, foldWords(r)]),
);

/** Phần ví dụ của prompt (hằng EXAMPLES export riêng): thiếu hoặc đổi thẻ thì ném lỗi, không âm thầm tắt kiểm tra. */
function examplesSection(examples: string): string {
  const m = examples.match(/<vi_du>([\s\S]*?)<\/vi_du>/);
  if (!m || !m[1].trim()) throw new Error('verify: không tìm thấy phần <vi_du> trong EXAMPLES của prompt-static');
  return m[1];
}

// ---------------------------------------------------------------- Ngữ cảnh

const hanOnly = (s: string | undefined) => [...(s ?? '')].filter(isHan).join('');

/** Ngữ cảnh kiểm tra cho một lần gieo: chỉ cần cast. */
export function buildVerifyContext(cast: Cast): VerifyContext {
  const rel = relatedHexagrams(cast.main);
  const roles: VerifyContext['roles'] = { main: cast.main, hỗ: rel.hỗ, thác: rel.thác, tổng: rel.tổng };
  if (cast.changed) {
    roles.changed = cast.changed;
    roles.biến_hỗ = relatedHexagrams(cast.changed).hỗ;
  }
  // Cùng danh sách "chỉ được nêu tên" mà prompt đưa cho AI.
  const allowedNames = new Set(allowedHexagrams(cast));
  const allowed = new Set(HEXES.filter(h => allowedNames.has(h.name)).map(h => h.number));
  // Tự quái / Tạp quái của quẻ chính được cấp nguyên văn và hay nêu quẻ đứng cạnh: cho phép nhắc các quẻ ấy.
  const mc = classicsOf(cast.main.number);
  const neighbours = `${mc.xugua}${mc.zagua}`;
  for (const h of HEXES) if (h.hanzi.length > 1 ? neighbours.includes(h.hanzi) : false) allowed.add(h.number);

  // Văn bản đối chiếu: quẻ chính, quẻ biến và cả hỗ / thác / tổng (AI có thể trích Thoán, Tượng của chúng).
  const texted = [...new Map(Object.values(roles).filter((h): h is HexInfo => Boolean(h)).map(h => [h.number, h])).values()];
  const hv: string[] = [];
  const han: string[] = [];
  for (const h of texted) {
    const t = hexagramText(h.number);
    hv.push(h.name, ...t.lines.map(l => l.textHV), t.extra?.textHV ?? '');
    const c = classicsOf(h.number);
    han.push(
      hanOnly(t.judgment), hanOnly(t.image), hanOnly(c.tuan), hanOnly(c.wenyan), hanOnly(c.xugua), hanOnly(c.zagua),
      hanOnly(c.judgment.cheng), hanOnly(c.judgment.benyi), ...c.xiaoXiang.map(hanOnly),
      ...c.lines.flatMap(l => [hanOnly(l.cheng), hanOnly(l.benyi)]),
      hanOnly(c.yong?.xiaoXiang), hanOnly(c.yong?.cheng), hanOnly(c.yong?.benyi),
    );
  }
  return {
    roles,
    allowed,
    hvCorpus: ` ${hv.map(s => foldWords(s).join(' ')).join(' | ')} `,
    hanPassages: han.filter(Boolean),
    examples: examplesSection(EXAMPLES),
  };
}

// ---------------------------------------------------------------- 1. Tên quẻ

const L = '\\p{L}';
const QUE_BEFORE = new RegExp(
  `(?:quẻ|biến thành|biến ra|hỗ quái|thác quái|tổng quái)(?:\\s+(?:biến|hỗ|thác|tổng|chính|gốc|là|thành|ra|của|đi))*(?:\\s+(?:${Object.keys(TRIGRAM_HAN).join('|')})){0,2}\\s+$`,
  'iu',
);
const COMPOUND_BEFORE = new RegExp(`(?:^|[^${L}])(${Object.keys(TRIGRAM_HAN).join('|')})\\s+(${Object.keys(TRIGRAM_HAN).join('|')})\\s+$`, 'u');
const HONORIFIC_BEFORE = /(?:anh|chị|ông|bà|em|cô|chú|bác|cậu|bạn)\s+$/iu;

interface Mention { number: number; index: number; length: number; strong: boolean }

/** Mọi chỗ nhắc tên quẻ. strong = chắc chắn là tên quẻ (đi sau "quẻ", tên ghép, hoặc tên hai chữ). */
function findMentions(text: string): Mention[] {
  const taken: [number, number][] = [];
  const out: Mention[] = [];
  for (const a of ALIASES) {
    const re = new RegExp(`(?<![${L}])${a.alias}(?![${L}])`, 'gu');
    for (const m of text.matchAll(re)) {
      const i = m.index!;
      const end = i + a.alias.length;
      if (taken.some(([s, e]) => i < e && end > s)) continue;
      const before = text.slice(Math.max(0, i - 60), i);
      const after = text.slice(end, end + 30);
      let strong = !a.single || QUE_BEFORE.test(before) || COMPOUND_BEFORE.test(before);
      if (!strong && a.single) {
        // Viết hoa giữa câu, không phải tên người (từ trước/sau không viết hoa, không có "anh/chị…"), trong câu có nói về quẻ/hào.
        const midSentence = /[\p{Ll},;:]\s+$/u.test(before);
        const prevCap = /\p{Lu}[\p{L}]*\s+$/u.test(before);
        const nextCap = /^\s+\p{Lu}/u.test(after);
        const sentence = sentenceAround(text, i);
        const hexContext = /(?:quẻ|hào|quái)/iu.test(sentence);
        strong = midSentence && !prevCap && !nextCap && !HONORIFIC_BEFORE.test(before) && hexContext;
      }
      taken.push([i, end]);
      out.push({ number: a.number, index: i, length: a.alias.length, strong });
    }
  }
  return out.sort((x, y) => x.index - y.index);
}

function sentenceAround(text: string, i: number): string {
  const start = Math.max(text.lastIndexOf('.', i - 1), text.lastIndexOf('\n', i - 1), text.lastIndexOf('!', i - 1), text.lastIndexOf('?', i - 1)) + 1;
  const ends = ['.', '\n', '!', '?'].map(c => text.indexOf(c, i)).filter(x => x >= 0);
  return text.slice(start, ends.length ? Math.min(...ends) : text.length);
}

function checkHexagrams(text: string, ctx: VerifyContext, flags: VerifyFlag[]) {
  const seen = new Set<number>();
  for (const m of findMentions(text)) {
    if (!m.strong || ctx.allowed.has(m.number) || seen.has(m.number)) continue;
    seen.add(m.number);
    flags.push({
      kind: 'unknown_hexagram',
      detail: `Nhắc quẻ ${BY_NUMBER.get(m.number)!.name} (số ${m.number}), không thuộc quẻ chính, biến, hỗ, thác, tổng của lần gieo.`,
      excerpt: excerptAt(text, m.index, m.length),
    });
  }
}

// ---------------------------------------------------------------- 2. Vị trí quái

type Half = 'upper' | 'lower';
const LOWER_LBL = '(?:nội quái|quái nội|hạ quái|quái dưới|quẻ dưới|quái trong|quẻ trong|quẻ đơn dưới|quái đơn dưới)';
const UPPER_LBL = '(?:ngoại quái|quái ngoại|thượng quái|quái trên|quẻ trên|quái ngoài|quẻ ngoài|quẻ đơn trên|quái đơn trên)';
const TNAME = `(${TRIGRAM_NAMES.join('|')})`;
const TIMG = `(${Object.keys(TRIGRAM_IMAGE).join('|')})`;
const TANY = `(${[...TRIGRAM_NAMES, ...Object.keys(TRIGRAM_IMAGE)].join('|')})`;
const NB = `(?![${L}])`;
const WB = `(?<![${L}])`;

interface Claim { trigram: string; half: Half; index: number; length: number; pair?: number }

const toTrigram = (w: string) => TRIGRAM_IMAGE[w.toLowerCase()] ?? (TRIGRAM_NAMES as readonly string[]).find(n => n === w) ?? null;

function findClaims(text: string): Claim[] {
  const out: Claim[] = [];
  const add = (re: RegExp, fn: (m: RegExpMatchArray) => [string, Half][]) => {
    for (const m of text.matchAll(re)) {
      const got = fn(m);
      const pair = got.length === 2 ? m.index! : undefined;
      for (const [w, half] of got) {
        const t = toTrigram(w);
        if (t) out.push({ trigram: t, half, index: m.index!, length: m[0].length, pair });
      }
    }
  };
  const halfOf = (lbl: string): Half => (new RegExp(`^${LOWER_LBL}$`, 'iu').test(lbl) ? 'lower' : 'upper');
  const posHalf = (w: string): Half => (/dưới|trong/iu.test(w) ? 'lower' : 'upper');
  // "nội quái Khảm", "quẻ trên là Khảm"
  add(new RegExp(`${WB}(${LOWER_LBL}|${UPPER_LBL})\\s+(?:là\\s+)?(?:quái\\s+|quẻ\\s+)?${TNAME}${NB}`, 'giu'), m => [[m[2], halfOf(m[1])]]);
  // "Khảm là ngoại quái", "Khảm ở quẻ trên"
  add(new RegExp(`${WB}${TNAME}\\s+(?:là|làm|ở|nằm ở|thuộc)\\s+(?:phần\\s+)?(${LOWER_LBL}|${UPPER_LBL})${NB}`, 'gu'), m => [[m[1], halfOf(m[2])]]);
  // "Khảm ở trên", "nước ở dưới," (ảnh tượng chỉ khi đứng trước dấu câu, tránh "nước ở dưới giếng")
  add(new RegExp(`${WB}${TNAME}\\s+(?:ở|nằm)\\s+(?:phía\\s+)?(trên|dưới|trong|ngoài)${NB}`, 'gu'), m => [[m[1], posHalf(m[2])]]);
  add(new RegExp(`${WB}${TIMG}\\s+ở\\s+(?:phía\\s+)?(trên|dưới|trong|ngoài)\\s*(?=[,.;:)(—–-]|$)`, 'giu'), m => [[m[1], posHalf(m[2])]]);
  // "trên Khảm dưới Chấn", "trên lửa dưới đầm", "dưới X trên Y"
  add(new RegExp(`${WB}(trên|dưới)\\s+${TANY}\\s*,?\\s*(trên|dưới)\\s+${TANY}${NB}`, 'giu'), m =>
    m[1].toLowerCase() === m[3].toLowerCase() ? [] : [[m[2], posHalf(m[1])], [m[4], posHalf(m[3])]]);
  // "Khảm trên, Chấn dưới"
  add(new RegExp(`${WB}${TANY}\\s+(trên|dưới)\\s*,\\s*${TANY}\\s+(trên|dưới)${NB}`, 'giu'), m =>
    m[2].toLowerCase() === m[4].toLowerCase() ? [] : [[m[1], posHalf(m[2])], [m[3], posHalf(m[4])]]);
  return out;
}

const ROLE_PHRASES: [RegExp, Role][] = [
  [/quẻ biến|biến quái/giu, 'changed'],
  [/quẻ hỗ|hỗ quái/giu, 'hỗ'],
  [/quẻ thác|thác quái/giu, 'thác'],
  [/quẻ tổng|tổng quái/giu, 'tổng'],
  [/quẻ chính|quẻ gốc|bản quái/giu, 'main'],
];

const fits = (h: HexInfo, c: Claim) => (c.half === 'upper' ? h.upper : h.lower) === c.trigram;

function checkTrigrams(text: string, ctx: VerifyContext, flags: VerifyFlag[]) {
  const byNumber = new Map(Object.values(ctx.roles).map(h => [h!.number, h!]));
  // Mốc ngữ cảnh: chỗ nhắc quẻ được phép hoặc cụm vai ("quẻ biến"…).
  const marks: { index: number; hex: HexInfo }[] = [];
  for (const m of findMentions(text)) {
    const h = byNumber.get(m.number) ?? (ctx.allowed.has(m.number) ? (BY_NUMBER.get(m.number) as HexInfo) : undefined);
    if (h) marks.push({ index: m.index, hex: h });
  }
  for (const [re, role] of ROLE_PHRASES) for (const m of text.matchAll(re)) {
    const h = ctx.roles[role];
    if (h) marks.push({ index: m.index!, hex: h });
  }
  marks.sort((a, b) => a.index - b.index);

  // Tên ghép "Thủy Lôi Truân": quái trên trước, quái dưới sau.
  const compound = new RegExp(`${WB}(${Object.keys(TRIGRAM_HAN).join('|')})\\s+(${Object.keys(TRIGRAM_HAN).join('|')})\\s+(\\p{Lu}[\\p{L}]*(?:\\s+\\p{Lu}[\\p{L}]*)?)`, 'gu');
  for (const m of text.matchAll(compound)) {
    const name = m[3];
    const hex = HEXES.find(h => h.name === name || h.name === name.split(/\s+/)[0]);
    if (!hex) continue;
    const up = TRIGRAM_HAN[m[1]], low = TRIGRAM_HAN[m[2]];
    if (hex.upper !== up || hex.lower !== low) {
      flags.push({ kind: 'trigram_position', detail: `Tên ghép "${m[0]}" sai: quẻ ${hex.name} là ${hex.upper} trên, ${hex.lower} dưới.`, excerpt: excerptAt(text, m.index!, m[0].length) });
    }
  }

  const paragraphs: [number, number][] = [];
  { let s = 0; for (const m of text.matchAll(/\n\s*\n/g)) { paragraphs.push([s, m.index!]); s = m.index! + m[0].length; } paragraphs.push([s, text.length]); }
  const seen = new Set<string>();
  const claims = findClaims(text);
  // Câu ghép đủ hai quái ("trên lửa dưới đầm") trùng đúng quẻ chính hoặc quẻ biến: đúng ở bất cứ đâu trong bài.
  const core = [ctx.roles.main!, ...(ctx.roles.changed ? [ctx.roles.changed] : [])];
  const okPairs = new Set<number>();
  for (const id of new Set(claims.filter(c => c.pair !== undefined).map(c => c.pair!))) {
    const both = claims.filter(c => c.pair === id);
    if (both.length === 2 && core.some(h => both.every(c => fits(h, c)))) okPairs.add(id);
  }
  for (const c of claims) {
    if (c.pair !== undefined && okPairs.has(c.pair)) continue;
    const [ps] = paragraphs.find(([s, e]) => c.index >= s && c.index < e) ?? [0, text.length];
    const sentence = sentenceBounds(text, c.index);
    const inSentence = marks.filter(k => k.index >= sentence[0] && k.index < sentence[1]).map(k => k.hex);
    const prior = marks.filter(k => k.index >= ps && k.index < c.index).at(-1)?.hex ?? ctx.roles.main!;
    const candidates = [...inSentence, prior];
    if (candidates.some(h => fits(h, c))) continue;
    const key = `${c.trigram}|${c.half}|${prior.number}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const h = inSentence[0] ?? prior;
    flags.push({
      kind: 'trigram_position',
      detail: `Đặt ${c.trigram} ở quái ${c.half === 'upper' ? 'trên (ngoại)' : 'dưới (nội)'}, nhưng quẻ ${h.name} là ${h.upper} trên, ${h.lower} dưới.`,
      excerpt: excerptAt(text, c.index, c.length),
    });
  }
}

// ---------------------------------------------------------------- 2b. Câu hình ảnh kiểu Đại Tượng

/** Ảnh tượng → quái (rộng hơn TRIGRAM_IMAGE: mây, mưa = Khảm; cây, gỗ = Tốn). */
const IMAGE_WORD: Record<string, string> = { ...TRIGRAM_IMAGE, mây: 'Khảm', mưa: 'Khảm', cây: 'Tốn', gỗ: 'Tốn' };
const IMG = `(${Object.keys(IMAGE_WORD).join('|')})`;

interface ImageClaim { upper: string; lower: string; index: number; length: number }
/** Không bắt "lửa dưới đầm" khi nó nằm trong "trên lửa dưới đầm" (đã có mẫu riêng). */
const NOT_POS = '(?<!(?:trên|dưới)\\s+)';

function findImageClaims(text: string): ImageClaim[] {
  const out: ImageClaim[] = [];
  const add = (re: RegExp, fn: (m: RegExpMatchArray) => [string, string]) => {
    for (const m of text.matchAll(re)) {
      const [u, l] = fn(m);
      const upper = IMAGE_WORD[u.toLowerCase()], lower = IMAGE_WORD[l.toLowerCase()];
      if (upper && lower && upper !== lower) out.push({ upper, lower, index: m.index!, length: m[0].length });
    }
  };
  // "Trên lửa dưới đầm" (Đại Tượng Khuê): lửa trên, đầm dưới; "dưới đầm trên lửa" cũng vậy.
  add(new RegExp(`${WB}trên\\s+${IMG}\\s*,?\\s*dưới\\s+${IMG}${NB}`, 'giu'), m => [m[1], m[2]]);
  add(new RegExp(`${WB}dưới\\s+${IMG}\\s*,?\\s*trên\\s+${IMG}${NB}`, 'giu'), m => [m[2], m[1]]);
  // "Trên núi có cây": núi dưới, cây trên.
  add(new RegExp(`${WB}trên\\s+${IMG}\\s+có\\s+${IMG}${NB}`, 'giu'), m => [m[2], m[1]]);
  // "Dưới núi có sấm": núi trên, sấm dưới.
  add(new RegExp(`${WB}dưới\\s+${IMG}\\s+có\\s+${IMG}${NB}`, 'giu'), m => [m[1], m[2]]);
  // "Lửa ở trên trời", "lửa trên trời": lửa trên, trời dưới.
  add(new RegExp(`${NOT_POS}${WB}${IMG}\\s+(?:ở\\s+)?trên\\s+${IMG}${NB}`, 'giu'), m => [m[1], m[2]]);
  // "Lửa ở dưới nước": lửa dưới, nước trên.
  add(new RegExp(`${NOT_POS}${WB}${IMG}\\s+(?:ở\\s+)?dưới\\s+${IMG}${NB}`, 'giu'), m => [m[2], m[1]]);
  // "Núi trên đầm dưới" / "trời trên, lửa dưới"
  add(new RegExp(`${NOT_POS}${WB}${IMG}\\s+trên\\s*,?\\s*${IMG}\\s+dưới${NB}`, 'giu'), m => [m[1], m[2]]);
  return out;
}

function checkImages(text: string, ctx: VerifyContext, flags: VerifyFlag[]) {
  const byNumber = new Map(Object.values(ctx.roles).map(h => [h!.number, h!]));
  const marks: { index: number; hex: HexInfo }[] = [];
  for (const m of findMentions(text)) {
    const h = byNumber.get(m.number);
    if (h) marks.push({ index: m.index, hex: h });
  }
  for (const [re, role] of ROLE_PHRASES) for (const m of text.matchAll(re)) {
    const h = ctx.roles[role];
    if (h) marks.push({ index: m.index!, hex: h });
  }
  marks.sort((a, b) => a.index - b.index);
  const paragraphs: [number, number][] = [];
  { let s = 0; for (const m of text.matchAll(/\n\s*\n/g)) { paragraphs.push([s, m.index!]); s = m.index! + m[0].length; } paragraphs.push([s, text.length]); }
  for (const c of findImageClaims(text)) {
    const [ps] = paragraphs.find(([s, e]) => c.index >= s && c.index < e) ?? [0, text.length];
    const sentence = sentenceBounds(text, c.index);
    const inSentence = marks.filter(k => k.index >= sentence[0] && k.index < sentence[1]).map(k => k.hex);
    const prior = marks.filter(k => k.index >= ps && k.index < c.index).at(-1)?.hex ?? ctx.roles.main!;
    // Đúng hình ảnh quẻ chính / quẻ biến thì đúng ở bất cứ đâu; còn lại xét quẻ nêu tên gần nhất.
    const core = [ctx.roles.main!, ...(ctx.roles.changed ? [ctx.roles.changed] : [])];
    if ([...core, ...inSentence, prior].some(h => h.upper === c.upper && h.lower === c.lower)) continue;
    const h = inSentence[0] ?? prior;
    flags.push({
      kind: 'image_phrase',
      detail: `Hình ảnh đặt ${c.upper} trên, ${c.lower} dưới, nhưng quẻ ${h.name} là ${h.upper} trên, ${h.lower} dưới.`,
      excerpt: excerptAt(text, c.index, c.length),
    });
  }
}

// ---------------------------------------------------------------- 2c. Vật tượng lạ

/** Vật tượng dùng để dò hình ảnh lạ (bỏ cây / gỗ / mưa vì hay dùng nghĩa thường). */
const FOREIGN_WORD: Record<string, string> = { trời: 'Càn', đất: 'Khôn', sấm: 'Chấn', gió: 'Tốn', nước: 'Khảm', mây: 'Khảm', lửa: 'Ly', núi: 'Cấn', đầm: 'Đoài' };
/** Cụm thường ngày chứa vật tượng nhưng không phải hình ảnh quái. */
/** Vật tượng dùng chung cho hơn một quái: "nước" cũng là nước đầm (Đoài), vd "lửa bốc lên, nước chảy xuống" của Khuê. */
const ALSO: Record<string, string[]> = { nước: ['Đoài'] };
const COMMON_PHRASE = /trời đất|đất trời|đất nước|nước đi|nước cờ|nước ngoài|ông trời|trời ơi|ngoài trời|bầu trời riêng|đầm ấm|giữ lửa|tiền nước|đất đai|mặt đất|xuống nước|cất cánh|gió chiều nào/giu;

/**
 * Câu nói về hình ảnh quái (có ≥ 2 vật tượng, ít nhất một thuộc quẻ chính / quẻ biến) mà lại có vật tượng của quái
 * không có trong quẻ chính / quẻ biến (hỗ / thác / tổng chỉ tính khi nêu tên ngay trong câu) → gắn cờ, vd
 * "sấm nổi dưới chân núi" trong quẻ Truân (không có Cấn).
 */
function checkForeignImages(text: string, ctx: VerifyContext, flags: VerifyFlag[]) {
  const core = [ctx.roles.main!, ...(ctx.roles.changed ? [ctx.roles.changed] : [])];
  const coreT = new Set(core.flatMap(h => [h.upper, h.lower]));
  const byNumber = new Map(Object.values(ctx.roles).map(h => [h!.number, h!]));
  const masked = text.replace(COMMON_PHRASE, m => ' '.repeat(m.length));
  const wordRe = new RegExp(`${WB}(${Object.keys(FOREIGN_WORD).join('|')})${NB}`, 'giu');
  const seen = new Set<string>();
  let start = 0;
  for (const end of [...[...masked.matchAll(/[.!?\n]/g)].map(m => m.index! + 1), masked.length]) {
    if (end <= start) continue;
    const sent = masked.slice(start, end);
    const words = [...sent.matchAll(wordRe)].map(m => ({ w: m[1].toLowerCase(), i: start + m.index! }));
    const s0 = start;
    start = end;
    if (words.length < 2 || !words.some(x => coreT.has(FOREIGN_WORD[x.w]))) continue;
    const named = findMentions(text.slice(s0, end)).map(m => byNumber.get(m.number)).filter((h): h is HexInfo => Boolean(h));
    const allowedT = new Set([...coreT, ...named.flatMap(h => [h.upper, h.lower])]);
    for (const x of words) {
      const t = FOREIGN_WORD[x.w];
      if (allowedT.has(t) || (ALSO[x.w] ?? []).some(a => allowedT.has(a)) || seen.has(x.w)) continue;
      seen.add(x.w);
      flags.push({
        kind: 'foreign_image',
        detail: `Hình ảnh "${x.w}" (quái ${t}) không thuộc quẻ ${core.map(h => h.name).join(' / ')}.`,
        excerpt: excerptAt(text, x.i, x.w.length),
      });
    }
  }
}

function sentenceBounds(text: string, i: number): [number, number] {
  let s = i;
  while (s > 0 && !/[.!?\n]/.test(text[s - 1])) s--;
  let e = i;
  while (e < text.length && !/[.!?\n]/.test(text[e])) e++;
  return [s, e];
}

// ---------------------------------------------------------------- 3. Trích Hán Việt

const QUOTE_RE = /\*\*([^*\n]{3,120}?)\*\*|"([^"\n]{3,120}?)"|“([^”\n]{3,120}?)”|«([^»\n]{3,120}?)»/g;

/** Cụm có vẻ là Hán Việt: ≥3 âm tiết, mọi âm tiết (đúng dấu) đều là âm Hán Việt đã biết. */
function looksHanViet(phrase: string): boolean {
  const ws = words(phrase);
  return ws.length >= 3 && ws.every(w => HV_SYLLABLES.has(w));
}

/** Khớp phiên âm với một đoạn chữ Hán liên tiếp (chữ không có trong bảng âm = ký tự đại diện, cho sai ≤ n/4). */
function matchesHan(sylls: string[], passages: string[]): boolean {
  const n = sylls.length;
  const maxMiss = Math.floor(n / 4);
  for (const p of passages) {
    const chars = [...p];
    for (let i = 0; i + n <= chars.length; i++) {
      let miss = 0, known = 0;
      for (let k = 0; k < n && miss <= maxMiss; k++) {
        const r = HV_READINGS[chars[i + k]];
        if (!r) continue;
        if (r.includes(sylls[k])) known++;
        else miss++;
      }
      if (miss <= maxMiss && known * 2 >= n) return true;
    }
  }
  return false;
}

/** Từ dẫn trích ngay trước cụm in đậm: có thì cụm 3 âm tiết cũng coi là lời trích. */
const QUOTE_CUE = /(?:lời hào|lời quẻ|lời kinh|lời thoán|thoán truyện|tiểu tượng|đại tượng|nói|rằng|viết|dạy|câu|chữ)\s*(?:là\s*)?[:,]?\s*$/iu;

function checkQuotes(text: string, ctx: VerifyContext, flags: VerifyFlag[]) {
  const seen = new Set<string>();
  for (const m of text.matchAll(QUOTE_RE)) {
    const bold = m[1] !== undefined;
    // In đậm chỉ để nhấn mạnh (vd **chính trực, kiên nhẫn**) không phải lời trích: chỉ xét khi có từ dẫn hoặc ≥4 âm tiết.
    const cued = QUOTE_CUE.test(text.slice(Math.max(0, m.index! - 40), m.index!));
    const raw = (m[1] ?? m[2] ?? m[3] ?? m[4]).replace(/^["“'«\s]+|["”'»\s]+$/g, '');
    for (const seg of raw.split(/\s*[—–]\s*|:\s+/)) {
      if (!looksHanViet(seg)) continue;
      // "chính trực, kiên nhẫn" là liệt kê nhấn mạnh: tính độ dài theo từng vế giữa dấu phẩy.
      if (bold && !cued && Math.max(...seg.split(/[,;]/).map(x => words(x).length)) < 4) continue;
      const sylls = foldWords(seg);
      const key = sylls.join(' ');
      if (seen.has(key)) continue;
      seen.add(key);
      if (ctx.hvCorpus.includes(` ${key} `) || ctx.hvCorpus.includes(key)) continue;
      if (matchesHan(sylls, ctx.hanPassages)) continue;
      flags.push({ kind: 'unsourced_quote', detail: `Cụm Hán Việt "${seg}" không có trong lời kinh, truyện, chú giải của quẻ chính, quẻ biến hay hỗ / thác / tổng.`, excerpt: excerptAt(text, m.index!, m[0].length) });
    }
  }
}

// ---------------------------------------------------------------- 4. Chép ví dụ

const NGRAM = 4;
const ngrams = (ws: string[]) => Array.from({ length: Math.max(0, ws.length - NGRAM + 1) }, (_, i) => ws.slice(i, i + NGRAM).join(' '));
const exampleGramCache = new Map<string, Set<string>>();

const TECH_WORDS = new Set([
  'hào', 'quẻ', 'quái', 'động', 'tĩnh', 'biến', 'chính', 'trung', 'đắc', 'thất', 'ứng', 'vô', 'với', 'và', 'là', 'của', 'ở', 'vị',
  'âm', 'dương', 'ngôi', 'tôn', 'trên', 'dưới', 'nội', 'ngoại', 'thừa', 'cưỡi', 'bạn', 'cũng', 'nhưng', 'lời', 'tượng', 'tiểu', 'đại',
  'sơ', 'nhị', 'tam', 'tứ', 'ngũ', 'thượng', 'cửu', 'lục', '1', '2', '3', '4', '5', '6',
]);

/** Tỉ lệ 4-gram của câu trùng với phần ví dụ từ mức này trở lên thì coi là chép. */
export const EXAMPLE_COPY_RATIO = 0.5;

function checkExamples(text: string, ctx: VerifyContext, flags: VerifyFlag[]) {
  if (!ctx.examples) return;
  let grams = exampleGramCache.get(ctx.examples);
  if (!grams) {
    grams = new Set(ctx.examples.split(/(?<=[.!?…:])\s+|\n+/).flatMap(s => ngrams(words(s))));
    exampleGramCache.set(ctx.examples, grams);
  }
  for (const m of text.matchAll(/[^.!?…\n]+[.!?…]?/g)) {
    const ws = words(m[0]);
    if (ws.length < 8) continue;
    // Bỏ cụm toàn thuật ngữ hào vị ("đắc chính đắc trung", "chính ứng với hào 5"): ai luận cũng phải dùng.
    const gs = ngrams(ws).filter(g => !g.split(' ').every(w => TECH_WORDS.has(w)));
    if (gs.length < 4) continue;
    const hit = gs.filter(g => grams!.has(g)).length;
    const ratio = hit / gs.length;
    if (ratio >= EXAMPLE_COPY_RATIO) {
      flags.push({ kind: 'example_copy', detail: `Câu trùng ${Math.round(ratio * 100)}% cụm 4 chữ với phần ví dụ trong prompt.`, excerpt: m[0].trim().slice(0, 200) });
    }
  }
}

// ---------------------------------------------------------------- 5–6. Nhãn, cụm cấm, chữ Hán

const BANNED_LABELS = ['bảng vị trí hào', 'bảng hào', 'JSON', 'dữ kiện quẻ', 'phần dữ kiện', 'dữ liệu được cung cấp', 'theo dữ liệu', 'trong_tam', 'lam_chu', 'van_ban', 'du_kien'];
const BANNED_PHRASES = ['Tóm lại', 'Điều quan trọng là', 'Hãy nhớ rằng', 'Dưới đây là', 'hành trình', 'năng lượng', 'vũ trụ', 'Chúc bạn'];

function checkPhrases(text: string, list: string[], kind: VerifyFlagKind, flags: VerifyFlag[]) {
  for (const p of list) {
    const re = new RegExp(`(?<![\\p{L}_])${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}_])`, 'iu');
    const m = text.match(re);
    if (m) flags.push({ kind, detail: `Có "${p}".`, excerpt: excerptAt(text, m.index!, m[0].length) });
  }
}

function checkHan(text: string, flags: VerifyFlag[]) {
  const han = [...text].filter(isHan);
  if (!han.length) return;
  flags.push({ kind: 'han_chars', detail: `Có ${han.length} chữ Hán (${[...new Set(han)].slice(0, 10).join('')}).`, excerpt: excerptAt(text, text.indexOf(han[0]), han[0].length) });
}

// ---------------------------------------------------------------- Tổng

export function verifyReading(text: string, ctx: VerifyContext): VerifyResult {
  const flags: VerifyFlag[] = [];
  checkHexagrams(text, ctx, flags);
  checkTrigrams(text, ctx, flags);
  checkImages(text, ctx, flags);
  checkForeignImages(text, ctx, flags);
  checkQuotes(text, ctx, flags);
  checkExamples(text, ctx, flags);
  checkPhrases(text, BANNED_LABELS, 'banned_label', flags);
  checkPhrases(text, BANNED_PHRASES, 'banned_phrase', flags);
  checkHan(text, flags);
  return { flags };
}
