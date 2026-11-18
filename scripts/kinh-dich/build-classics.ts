/**
 * Dựng lib/kinh-dich/data/classics.json từ Wikisource tiếng Trung (phạm vi công cộng — xem data/NOTICE.md).
 * Dùng: npx tsx scripts/kinh-dich/build-classics.ts [thư mục cache]
 *
 * Nguồn:
 *  - 周易/<quẻ> (經 + 彖 + 象 + 文言), 易傳/序卦, 易傳/雜卦: wikitext qua ?action=raw.
 *  - 周易傳義大全 (四庫全書本)/卷N: HTML qua api.php?action=parse (trang ghép từ bản quét 四庫全書).
 *    Lấy đoạn chữ lớn mở đầu bằng 「傳」 (程傳) và 「本義」 (朱子本義); chữ nhỏ song hành (諸儒、音注) bị bỏ.
 *
 * File tải về là dữ liệu không tin cậy: chỉ đọc như văn bản, lưu trong thư mục cache riêng ngoài repo,
 * không bao giờ thực thi. Chạy lại dùng cache (xoá thư mục cache để tải mới).
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const UA = 'kinh-dich-dataset-builder/1.0';
const API = 'https://zh.wikisource.org/w/api.php';
const INDEX = 'https://zh.wikisource.org/w/index.php';
const DELAY_MS = 3000;
const CACHE = resolve(process.argv[2] ?? join(tmpdir(), 'kinh-dich-classics-cache'));
const OUT = fileURLToPath(new URL('../../lib/kinh-dich/data/classics.json', import.meta.url));

const CHUANYI = '周易傳義大全 (四庫全書本)';
const CHUANYI_VOLUMES = [
  '卷一', '卷二', '卷三', '卷四', '卷五', '卷六', '卷七', '卷八', '卷九', '卷十', '卷十一', '卷十二',
  '卷十三', '卷十四', '卷十五', '卷十六', '卷十七', '卷十八', '卷十九', '卷二十', '卷二十一',
  '卷二十二1', '卷二十二2', '卷二十三', '卷二十四',
];

// Tên quẻ theo thứ tự Văn Vương, đúng tên trang trên Wikisource (周易/<tên>).
const NAMES = [
  '乾', '坤', '屯', '蒙', '需', '訟', '師', '比', '小畜', '履', '泰', '否', '同人', '大有', '謙', '豫',
  '隨', '蠱', '臨', '觀', '噬嗑', '賁', '剝', '復', '无妄', '大畜', '頤', '大過', '坎', '離', '咸', '恒',
  '遯', '大壯', '晉', '明夷', '家人', '睽', '蹇', '解', '損', '益', '夬', '姤', '萃', '升', '困', '井',
  '革', '鼎', '震', '艮', '漸', '歸妹', '豐', '旅', '巽', '兌', '渙', '節', '中孚', '小過', '既濟', '未濟',
];
const VARIANT: Record<string, string> = { 恆: '恒', 無妄: '无妄' };
const numberOf = (name: string): number => {
  const i = NAMES.indexOf(VARIANT[name] ?? name);
  return i < 0 ? 0 : i + 1;
};

export interface Commentary { cheng: string; benyi: string }
export interface Classic {
  tuan: string;
  xiaoXiang: string[];
  yong?: { xiaoXiang: string } & Commentary;
  wenyan?: string;
  xugua: string;
  zagua: string;
  judgment: Commentary;
  lines: Commentary[];
}

// ---------- tải có cache ----------
let lastFetch = 0;
async function cached(key: string, url: string): Promise<string> {
  mkdirSync(CACHE, { recursive: true });
  const file = join(CACHE, createHash('sha1').update(key).digest('hex').slice(0, 16) + '.txt');
  if (existsSync(file)) return readFileSync(file, 'utf8');
  const wait = lastFetch + DELAY_MS - Date.now();
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastFetch = Date.now();
  let res = await fetch(url, { headers: { 'User-Agent': UA } });
  for (let attempt = 1; res.status === 429 && attempt <= 5; attempt++) {
    const retry = Number(res.headers.get('retry-after')) || 30 * attempt;
    console.log(`429 cho ${key}, chờ ${retry}s`);
    await new Promise(r => setTimeout(r, retry * 1000));
    lastFetch = Date.now();
    res = await fetch(url, { headers: { 'User-Agent': UA } });
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} cho ${key}`);
  const body = await res.text();
  writeFileSync(file, body, 'utf8');
  return body;
}

async function raw(title: string, depth = 0): Promise<string> {
  const text = await cached('raw:' + title, `${INDEX}?action=raw&title=${encodeURIComponent(title)}`);
  const redirect = text.match(/^#(?:重定向|REDIRECT)\s*\[\[([^\]|]+)/i);
  if (redirect && depth < 3) return raw(redirect[1].trim(), depth + 1);
  return text;
}

async function parsedHtml(title: string): Promise<string> {
  const q = new URLSearchParams({ action: 'parse', page: title, prop: 'text', format: 'json', formatversion: '2', redirects: '1' });
  const body = await cached('parse:' + title, `${API}?${q}`);
  const j = JSON.parse(body) as { parse?: { text: string }; error?: { info: string } };
  if (!j.parse) throw new Error(`Không parse được ${title}: ${j.error?.info}`);
  return j.parse.text;
}

// ---------- wikitext → chữ ----------
function cleanWiki(s: string): string {
  return s
    .replace(/<ref[\s\S]*?<\/ref>|<ref[^>]*\/>/g, '')
    .replace(/\{\{\*\|[^{}]*\}\}/g, '') // chú thích dị bản {{*|...}}
    .replace(/\{\{另\|([^|{}]*)\|[^{}]*\}\}/g, '$1') // {{另|chữ chính|dị thể}}
    .replace(/\{\{(?:ruby|r)\|([^|{}]*)\|[^{}]*\}\}/gi, '$1')
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/-\{([^{}]*)\}-/g, '$1')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/'{2,}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/^[*#:;]+\s*/gm, '')
    .replace(/[ \t　]+/g, '')
    .trim();
}

interface ZhouyiPage { tuan: string; daXiang: string; xiaoXiang: string[]; wenyan: string }

/** Tách trang 周易/<quẻ> theo các mục '''彖曰：''' / '''象曰：''' / '''文言曰：'''. */
function parseZhouyiPage(text: string, n: number): ZhouyiPage {
  const lines = text.split(/\r?\n/);
  const sections: Record<string, string[]> = {};
  let cur: string | null = null;
  for (const line of lines) {
    const head = line.match(/^\*\s*(?:<[^>]*>)?'''\s*(易經|彖曰|象曰|文言曰)[：:]?\s*'''/);
    if (head) { cur = head[1]; sections[cur] = []; continue; }
    if (cur && /^[*#:]/.test(line)) sections[cur].push(line);
    else if (cur && line.trim() === '') continue;
    else if (cur && !/^[*#:]/.test(line)) cur = null;
  }
  const tuanLines = sections['彖曰'] ?? [];
  const xiangLines = sections['象曰'] ?? [];
  const tuan = tuanLines.map(cleanWiki).filter(Boolean).join('');
  const daXiang = xiangLines.filter(l => /^\*\*/.test(l)).map(cleanWiki).join('');
  const xiaoXiang = xiangLines.filter(l => /^\*#/.test(l)).map(cleanWiki).filter(Boolean);
  const wenyan = (sections['文言曰'] ?? []).map(cleanWiki).filter(Boolean).join('\n');
  const expected = n <= 2 ? 7 : 6;
  if (!tuan) throw new Error(`周易/${NAMES[n - 1]}: thiếu 彖`);
  if (xiaoXiang.length !== expected) throw new Error(`周易/${NAMES[n - 1]}: ${xiaoXiang.length} câu 小象, cần ${expected}`);
  return { tuan, daXiang, xiaoXiang, wenyan };
}

/** 序卦: mỗi dòng gán cho các quẻ được liên kết trong dòng đó (乾/坤 chung câu đầu). */
function parseXugua(text: string): Map<number, string> {
  const out = new Map<number, string>();
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith(':')) continue;
    const links = [...line.matchAll(/\[\[周易\/([^\]|]+)/g)].map(m => numberOf(m[1]));
    const sentence = cleanWiki(line);
    for (const n of links) if (n) out.set(n, out.has(n) ? out.get(n) + sentence : sentence);
  }
  return out;
}

/** 雜卦: mỗi quẻ nhận nguyên câu đối chứa nó (雜卦 nói theo cặp tương phản). */
function parseZagua(text: string): Map<number, string> {
  const out = new Map<number, string>();
  const body = text.split(/==校詁版==/)[0];
  for (const line of body.split(/\r?\n/)) {
    if (!line.startsWith(':')) continue;
    const sentence = cleanWiki(line);
    for (const m of line.matchAll(/\[\[周易\/([^\]|]+)/g)) {
      const n = numberOf(m[1]);
      if (n) out.set(n, sentence);
    }
  }
  return out;
}

// ---------- 周易傳義大全: HTML → các khối ----------
interface Segment { indent: boolean; parts: { small: boolean; text: string }[] }

function htmlToSegments(html: string): Segment[] {
  const h = html
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<link[^>]*>/g, '')
    .replace(/<span class="wst-dl-bracket">[^<]*<\/span>/g, '')
    .replace(/<span><span class="pagenum[\s\S]*?<\/span><\/span><\/span>/g, '')
    .replace(/<small[\s\S]*?<\/small>/g, '\u0001') // chữ nhỏ song hành: 諸儒、音注、dị bản
    .replace(/<sup[\s\S]*?<\/sup>/g, '')
    .replace(/<table[\s\S]*?<\/table>/g, '');
  const segs: Segment[] = [];
  for (const rawLine of h.split(/<br\s*\/?>|<\/p>|\n/)) {
    const line = rawLine.replace(/^\s*(?:<p>)?\s*/, '');
    const indent = /^<span style="display:inline-block; inline-size:\d/.test(line);
    const text = line.replace(/<[^>]+>/g, '').replace(/&#8203;|​|[\s　]/g, '')
      .replace(/&#95;/g, '_').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    if (!text.replace(/\u0001/g, '')) {
      if (text) segs.push({ indent, parts: [{ small: true, text: '' }] });
      continue;
    }
    const parts: Segment['parts'] = [];
    text.split(/(\u0001)/).forEach(p => {
      if (p === '\u0001') parts.push({ small: true, text: '' });
      else if (p) parts.push({ small: false, text: p });
    });
    segs.push({ indent, parts });
  }
  return segs;
}

type Target = { kind: 'judgment' } | { kind: 'line'; i: number } | { kind: 'yong' } | null;
interface Raw { judgment: { cheng: string[]; benyi: string[] }; lines: { cheng: string[]; benyi: string[] }[]; yong: { cheng: string[]; benyi: string[] } }

const LINE_LABEL = /^(初[六九]|[六九][二三四五]|上[六九])/;
const LINE_INDEX: Record<string, number> = { 初: 0, 二: 1, 三: 2, 四: 3, 五: 4, 上: 5 };
const NON_TEXT = /^(欽定四庫全書|周易傳義大全|周易[上下]經|[上下]經|卷)/;
const emptyRaw = (): Raw => ({
  judgment: { cheng: [], benyi: [] },
  lines: Array.from({ length: 6 }, () => ({ cheng: [], benyi: [] })),
  yong: { cheng: [], benyi: [] },
});

/** Duyệt tuần tự các trang 傳義大全, gán khối 傳/本義 cho 卦辭, hào hoặc 用九/用六 đứng ngay trước. */
function parseChuanyi(pages: string[]): Map<number, Raw> {
  const out = new Map<number, Raw>();
  let hex = 0;
  let target: Target = null;
  let seenLines = new Set<string>();
  let afterHeader = false;
  let block: { kind: 'cheng' | 'benyi'; text: string[] } | null = null;
  let prevMainFull = false;
  let prevEndedFull = false; // dòng trước kết thúc bằng chữ lớn đầy cột → dòng này là nối tiếp

  const flushBlock = () => {
    if (block && hex && target) {
      const r = out.get(hex)!;
      const slot = target.kind === 'judgment' ? r.judgment : target.kind === 'yong' ? r.yong : r.lines[target.i];
      const t = block.text.join('');
      // 「本義」 có thể nằm giữa dòng hoặc bị ngắt dòng giữa 本|義 — tách sau khi đã nối cả khối
      const k = block.kind === 'cheng' ? t.indexOf('本義') : -1;
      if (k >= 0) {
        if (k > 0) slot.cheng.push(t.slice(0, k));
        if (t.slice(k + 2)) slot.benyi.push(t.slice(k + 2));
      } else if (t) slot[block.kind].push(t);
    }
    block = null;
  };
  const startMain = (text: string) => {
    flushBlock();
    const sym = [...text].find(c => c >= '䷀' && c <= '䷿');
    if (sym) {
      // Các quẻ xuất hiện đúng thứ tự Văn Vương; ký hiệu ䷀–䷿ trong bản chép đôi khi sai (觀 bị chép thành ䷺)
      const bySymbol = sym.codePointAt(0)! - 0x4dc0 + 1;
      if (bySymbol !== hex + 1) console.warn(`傳義大全: ký hiệu ${sym} (quẻ ${bySymbol}) ở vị trí quẻ ${hex + 1} — dùng thứ tự`);
      hex = hex + 1;
      if (!out.has(hex)) out.set(hex, emptyRaw());
      target = { kind: 'judgment' }; // 程傳 mở quẻ (dẫn 序卦, giải thể quẻ) đứng ngay sau ký hiệu quẻ
      seenLines = new Set();
      afterHeader = true;
      const rest = text.slice(text.indexOf(sym) + sym.length);
      if (rest) startMain(rest);
      return;
    }
    if (!hex) return;
    const label = text.match(LINE_LABEL)?.[1];
    const yong = /^用[六九]/.test(text);
    if (label && !seenLines.has(label)) {
      seenLines.add(label);
      target = { kind: 'line', i: LINE_INDEX[label[0] === '初' || label[0] === '上' ? label[0] : label[1]] };
    } else if (yong && !seenLines.has('用')) {
      seenLines.add('用');
      target = { kind: 'yong' };
    } else if (NON_TEXT.test(text)) {
      return; // tiêu đề quyển/篇: giữ nguyên trạng thái
    } else if (afterHeader && !/^(彖|象)曰/.test(text)) {
      target = { kind: 'judgment' };
    } else if (target && !/^(彖|象|文言)曰/.test(text)) {
      // câu kinh bị 傳義大全 cắt thành nhiều đoạn (vd. 坤 卦辭): vẫn là cùng một mục
    } else {
      target = null;
    }
    afterHeader = false;
  };

  for (const html of pages) {
    prevEndedFull = false;
    prevMainFull = false;
    for (const seg of htmlToSegments(html)) {
      if (!seg.indent) {
        // dòng kinh/truyện (không thụt lề): chữ lớn
        const text = seg.parts.filter(p => !p.small).map(p => p.text).join('');
        if (!text) continue;
        if (!prevMainFull) startMain(text); // dòng trước đầy cột thì đây là phần nối của câu kinh
        const last = seg.parts[seg.parts.length - 1];
        prevMainFull = !last.small && [...text].length >= 19;
        prevEndedFull = false;
        continue;
      }
      prevMainFull = false;
      seg.parts.forEach((p, idx) => {
        if (p.small) { if (block) prevEndedFull = false; return; }
        let t = p.text;
        const atLineStart = idx === 0;
        const label = t.match(/^(本義|傳|𫝊)/)?.[1];
        if (label && (label === '本義' || (atLineStart && !prevEndedFull) || !block)) {
          flushBlock();
          block = { kind: label === '本義' ? 'benyi' : 'cheng', text: [] };
          t = t.slice(label.length);
        }
        if (block) block.text.push(t);
      });
      const last = seg.parts[seg.parts.length - 1];
      prevEndedFull = !last.small && [...last.text].length >= 19;
    }
    flushBlock();
  }
  return out;
}

async function main() {
  console.log('Cache:', CACHE);
  const classics: Record<number, Classic> = {};
  const gaps: string[] = [];

  const xugua = parseXugua(await raw('易傳/序卦'));
  const zagua = parseZagua(await raw('易傳/雜卦'));

  const pages: string[] = [];
  for (const v of CHUANYI_VOLUMES) {
    const html = await parsedHtml(`${CHUANYI}/${v}`);
    pages.push(html);
    if (html.includes('䷿')) break; // đã tới quẻ 未濟: phần kinh xong
  }
  const chuanyi = parseChuanyi(pages);

  const join = (xs: string[]) => xs.join('');
  for (let n = 1; n <= 64; n++) {
    const page = parseZhouyiPage(await raw(`周易/${NAMES[n - 1]}`), n);
    const r = chuanyi.get(n) ?? emptyRaw();
    const c: Classic = {
      tuan: page.tuan,
      xiaoXiang: page.xiaoXiang.slice(0, 6),
      xugua: xugua.get(n) ?? '',
      zagua: zagua.get(n) ?? '',
      judgment: { cheng: join(r.judgment.cheng), benyi: join(r.judgment.benyi) },
      lines: r.lines.map(l => ({ cheng: join(l.cheng), benyi: join(l.benyi) })),
    };
    if (n <= 2) {
      c.yong = { xiaoXiang: page.xiaoXiang[6], cheng: join(r.yong.cheng), benyi: join(r.yong.benyi) };
      c.wenyan = page.wenyan;
    }
    const check = (label: string, v: string | undefined) => { if (!v) gaps.push(`${n} ${NAMES[n - 1]}: thiếu ${label}`); };
    check('序卦', c.xugua); check('雜卦', c.zagua);
    check('judgment.cheng', c.judgment.cheng); check('judgment.benyi', c.judgment.benyi);
    c.lines.forEach((l, i) => { check(`lines[${i}].cheng`, l.cheng); check(`lines[${i}].benyi`, l.benyi); });
    if (c.yong) { check('yong.cheng', c.yong.cheng); check('yong.benyi', c.yong.benyi); check('wenyan', c.wenyan); }
    classics[n] = c;
  }

  const json = {
    sources: {
      zhouyi: 'https://zh.wikisource.org/wiki/周易',
      xugua: 'https://zh.wikisource.org/wiki/易傳/序卦',
      zagua: 'https://zh.wikisource.org/wiki/易傳/雜卦',
      chuanyi: 'https://zh.wikisource.org/wiki/周易傳義大全_(四庫全書本)',
    },
    license: 'Public domain (Wikisource PD-old); see NOTICE.md',
    hexagrams: classics,
  };
  writeFileSync(OUT, JSON.stringify(json, null, 1) + '\n', 'utf8');
  const size = Buffer.byteLength(readFileSync(OUT));
  console.log(`Ghi ${OUT} (${(size / 1024).toFixed(0)} KB)`);
  if (gaps.length) { console.log(`Thiếu ${gaps.length} mục:`); gaps.forEach(g => console.log('  ' + g)); process.exitCode = 1; }
}

main().catch(e => { console.error(e); process.exit(1); });
