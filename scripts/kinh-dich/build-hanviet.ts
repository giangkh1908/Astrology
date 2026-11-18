/**
 * Dựng lib/kinh-dich/data/hanviet.json: âm Hán Việt cho các chữ Hán xuất hiện trong hexagrams.json + classics.json.
 * Dùng để kiểm tra (lib/kinh-dich/verify.ts) cụm Hán Việt AI trích có đúng là phiên âm của lời kinh được cấp không.
 *
 * Dùng: npx tsx scripts/kinh-dich/build-hanviet.ts <đường dẫn Unihan_Readings.txt>
 * Nguồn: trường kVietnamese của Unicode Unihan (https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip,
 * giấy phép Unicode — xem data/NOTICE.md), cộng một bảng bổ sung nhỏ cho chữ hay gặp trong Kinh Dịch mà Unihan
 * thiếu âm. File tải về là dữ liệu không tin cậy: chỉ đọc như văn bản.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = process.argv[2];
if (!src) throw new Error('Cần đường dẫn tới Unihan_Readings.txt');

const dataDir = new URL('../../lib/kinh-dich/data/', import.meta.url);
const corpus = readFileSync(new URL('hexagrams.json', dataDir), 'utf8') + readFileSync(new URL('classics.json', dataDir), 'utf8');
const chars = new Set([...corpus].filter(c => /\p{Script=Han}/u.test(c)));

/** Âm Hán Việt thông dụng trong Kinh Dịch mà Unihan thiếu (gộp thêm, không thay). */
const SUPPLEMENT: Record<string, string> = {
  而: 'nhi', 異: 'dị', 攸: 'du', 號: 'hào', 咷: 'đào diêu', 莽: 'mãng', 侯: 'hầu', 喪: 'táng', 无: 'vô', 無: 'vô',
  咎: 'cữu', 悔: 'hối', 吝: 'lận', 厲: 'lệ', 孚: 'phu', 乘: 'thừa', 墉: 'dung', 弗: 'phất', 克: 'khắc', 遇: 'ngộ',
  宗: 'tông', 郊: 'giao', 巳: 'tị', 己: 'kỷ', 征: 'chinh', 牝: 'tẫn', 牡: 'mẫu', 履: 'lý', 霜: 'sương', 括: 'quát',
  囊: 'nang', 汔: 'hất', 繘: 'duật', 羸: 'luy', 瓶: 'bình', 甕: 'úng', 井: 'tỉnh', 邑: 'ấp', 改: 'cải', 汲: 'cấp',
  于: 'vu', 於: 'ư', 之: 'chi', 其: 'kỳ', 以: 'dĩ', 也: 'dã', 乎: 'hồ', 矣: 'hĩ', 焉: 'yên', 者: 'giả',
  亨: 'hanh', 貞: 'trinh', 利: 'lợi', 元: 'nguyên', 吉: 'cát', 凶: 'hung', 涉: 'thiệp', 往: 'vãng', 屯: 'truân',
  蒙: 'mông', 需: 'nhu', 訟: 'tụng', 師: 'sư', 比: 'tỷ tỉ', 畜: 'súc', 泰: 'thái', 否: 'bĩ phủ', 謙: 'khiêm',
  豫: 'dự', 隨: 'tùy', 蠱: 'cổ', 臨: 'lâm', 觀: 'quán quan', 噬: 'phệ', 嗑: 'hạp', 賁: 'bí bôn', 剝: 'bác',
  復: 'phục phúc', 妄: 'vọng', 頤: 'di', 過: 'quá', 坎: 'khảm', 離: 'ly li', 咸: 'hàm', 恆: 'hằng', 遯: 'độn',
  壯: 'tráng', 晉: 'tấn', 夷: 'di', 睽: 'khuê', 蹇: 'kiển', 解: 'giải', 損: 'tổn', 益: 'ích', 夬: 'quải',
  姤: 'cấu', 萃: 'tụy', 升: 'thăng', 困: 'khốn', 革: 'cách', 鼎: 'đỉnh', 震: 'chấn', 艮: 'cấn', 漸: 'tiệm',
  歸: 'quy', 妹: 'muội', 豐: 'phong', 旅: 'lữ', 巽: 'tốn', 兌: 'đoài', 渙: 'hoán', 節: 'tiết', 濟: 'tế',
  未: 'vị', 主: 'chủ', 二: 'nhị', 予: 'dư dữ', 功: 'công', 有: 'hữu', 大: 'đại', 小: 'tiểu', 中: 'trung', 正: 'chính',
};

const map: Record<string, string> = {};
for (const line of readFileSync(src, 'utf8').split('\n')) {
  const m = line.match(/^U\+([0-9A-F]+)\tkVietnamese\t(.+)$/);
  if (!m) continue;
  const c = String.fromCodePoint(parseInt(m[1], 16));
  if (chars.has(c)) map[c] = m[2].trim().normalize('NFC');
}
for (const [c, r] of Object.entries(SUPPLEMENT)) {
  if (!chars.has(c)) continue;
  const all = new Set([...(map[c] ?? '').split(/\s+/), ...r.split(/\s+/)].filter(Boolean));
  map[c] = [...all].join(' ').normalize('NFC');
}

const sorted = Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.codePointAt(0)! - b.codePointAt(0)!));
const out = fileURLToPath(new URL('hanviet.json', dataDir));
writeFileSync(out, JSON.stringify({ source: 'Unicode Unihan kVietnamese + bổ sung tay', chars: sorted }) + '\n');
console.log(`hanviet.json: ${Object.keys(sorted).length}/${chars.size} chữ có âm`);
