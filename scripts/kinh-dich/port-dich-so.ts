/**
 * Port dữ liệu 64 quẻ từ bản clone của docsachvathaoluan/dich-so sang lib/kinh-dich/data/.
 * Dùng: npx tsx scripts/kinh-dich/port-dich-so.ts <thư mục dich-so>
 * Chạy một lần khi cần cập nhật dữ liệu; kết quả được commit cùng NOTICE.md (ghi công, giấy phép).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const TRIGRAM_BITS: Record<string, string> = {
  // đáy → đỉnh, '1' = hào dương
  Càn: '111', Đoài: '110', Ly: '101', Chấn: '100', Tốn: '011', Khảm: '010', Cấn: '001', Khôn: '000',
};

interface Line { textHV: string; gloss: string; modern: string }

async function main() {
  const dir = process.argv[2];
  if (!dir) throw new Error('Thiếu đường dẫn tới bản clone dich-so');
  const load = (f: string) => import(pathToFileURL(resolve(dir, 'src/data', f)).href);
  const { KING_WEN } = await load('kingWenSequence.ts');
  const { HEXAGRAM_CONTENT } = await load('hexagramContent.ts');
  const { INTERPRETATIONS } = await load('interpretations.ts');
  let commit = 'unknown';
  try { commit = execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { /* không phải git */ }

  const pickLine = (l: Line): Line => ({ textHV: l.textHV, gloss: l.gloss, modern: l.modern });
  const hexagrams = (KING_WEN as { upper: string; lower: string; nameHanViet: string; hanzi: string }[]).map((k, i) => {
    const n = i + 1;
    const content = HEXAGRAM_CONTENT[n];
    const interp = INTERPRETATIONS[n];
    if (!content || !interp) throw new Error(`Thiếu dữ liệu quẻ ${n}`);
    const bits = TRIGRAM_BITS[k.lower] + TRIGRAM_BITS[k.upper];
    if (bits.length !== 6) throw new Error(`Quẻ đơn lạ ở quẻ ${n}: ${k.upper}/${k.lower}`);
    return {
      number: n,
      name: k.nameHanViet,
      hanzi: k.hanzi,
      upper: k.upper,
      lower: k.lower,
      bits,
      judgment: interp.judgmentClassic ?? '',
      image: interp.imageClassic ?? '',
      modernShort: interp.modernShort,
      lines: (content.lines as Line[]).map(pickLine),
      ...(content.extra ? { extra: pickLine(content.extra as Line) } : {}),
    };
  });

  const out = resolve('lib/kinh-dich/data');
  mkdirSync(out, { recursive: true });
  writeFileSync(resolve(out, 'hexagrams.json'), JSON.stringify({
    source: 'https://github.com/docsachvathaoluan/dich-so',
    commit,
    hexagrams,
  }, null, 1) + '\n');

  const licence = readFileSync(resolve(dir, 'LICENSE-CONTENT.md'), 'utf8');
  writeFileSync(resolve(out, 'NOTICE.md'), [
    '# Nguồn và giấy phép dữ liệu Kinh Dịch',
    '',
    `\`hexagrams.json\` được port từ dự án **dich-so** (https://github.com/docsachvathaoluan/dich-so), commit \`${commit}\`, bằng \`scripts/kinh-dich/port-dich-so.ts\`.`,
    '',
    '- `lines[].textHV` và `lines[].gloss` (Hán-Việt và nghĩa 384 hào), `extra` (Dụng Cửu / Dụng Lục): neo theo bản dịch **_Kinh Dịch trọn bộ_** của **Ngô Tất Tố** (1893–1954) — phạm vi công cộng, **bắt buộc ghi công**.',
    '- `judgment` (Thoán) và `image` (Đại Tượng): nguyên văn kinh văn cổ (phạm vi công cộng) kèm phần tóm ý của dự án dich-so.',
    '- `modernShort` và `lines[].modern`: diễn giải hiện đại của dự án dich-so, giấy phép **CC BY 4.0** (https://creativecommons.org/licenses/by/4.0/). **Không phải lời Ngô Tất Tố.** Ứng dụng này không sửa nội dung, chỉ chọn trường và đổi định dạng sang JSON.',
    '',
    'Nguyên văn giấy phép nội dung của dich-so (`LICENSE-CONTENT.md`) chép dưới đây.',
    '',
    '---',
    '',
    licence,
  ].join('\n'));
  console.log(`Đã ghi ${hexagrams.length} quẻ (commit ${commit.slice(0, 7)})`);
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
