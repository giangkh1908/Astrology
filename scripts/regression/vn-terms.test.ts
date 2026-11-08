/** Regression coverage for lib/vn/terms.ts (Han -> Han-Viet display layer). */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  viTerm, viStar, viPalace, viStem, viBranch, viStemBranch, viSiHua, viBrightness,
  viWuxingJu, viShichen, viShichenRange, viHan, VI_STEMS, VI_BRANCHES,
} from '../../lib/vn/terms';

const HAN = /\p{Script=Han}/u;

// 14 chinh tinh
const main: Record<string, string> = {
  紫微: 'Tử Vi', 天机: 'Thiên Cơ', 太阳: 'Thái Dương', 武曲: 'Vũ Khúc', 天同: 'Thiên Đồng', 廉贞: 'Liêm Trinh',
  天府: 'Thiên Phủ', 太阴: 'Thái Âm', 贪狼: 'Tham Lang', 巨门: 'Cự Môn', 天相: 'Thiên Tướng', 天梁: 'Thiên Lương',
  七杀: 'Thất Sát', 破军: 'Phá Quân',
};
assert.equal(Object.keys(main).length, 14);
for (const [zh, vi] of Object.entries(main)) assert.equal(viStar(zh), vi, zh);

const spot: Record<string, string> = {
  左辅: 'Tả Phù', 右弼: 'Hữu Bật', 天钺: 'Thiên Việt', 擎羊: 'Kình Dương', 陀罗: 'Đà La', 铃星: 'Linh Tinh',
  红鸾: 'Hồng Loan', 天喜: 'Thiên Hỷ', 天姚: 'Thiên Diêu', 蜚廉: 'Phỉ Liêm', 飞廉: 'Phi Liêm',
  截路: 'Tiệt Lộ', 旬空: 'Tuần Không', 官符: 'Quan Phù', 帝旺: 'Đế Vượng', 攀鞍: 'Phan An',
};
for (const [zh, vi] of Object.entries(spot)) assert.equal(viTerm(zh), vi, zh);

assert.equal(viPalace('命宫'), 'Mệnh');
assert.equal(viPalace('子女宫'), 'Tử Tức');
assert.equal(viPalace('交友'), 'Nô Bộc');
assert.equal(viPalace('事业'), 'Quan Lộc');
assert.equal(viPalace('身宫'), 'Thân');
assert.equal(viStem(0), 'Giáp'); assert.equal(viStem('癸'), 'Quý');
assert.equal(viBranch(11), 'Hợi'); assert.equal(viBranch('子'), 'Tý');
assert.equal(viStemBranch('甲子'), 'Giáp Tý');
assert.equal(viStemBranch('甲子乙丑'), 'Giáp Tý Ất Sửu');
assert.equal(viSiHua('禄'), 'Lộc'); assert.equal(viSiHua('化忌'), 'Hóa Kỵ');
assert.equal(viSiHua('权'), 'Quyền'); assert.equal(viSiHua('科'), 'Khoa');
assert.equal(viBrightness('庙'), 'Miếu'); assert.equal(viBrightness('陷'), 'Hãm');
assert.equal(viWuxingJu('水二局'), 'Thủy Nhị Cục');
assert.equal(viWuxingJu('火六局'), 'Hỏa Lục Cục');
assert.equal(viShichen(0), 'Tý');
assert.equal(viShichenRange(0), '23:00–01:00');
assert.equal(viShichenRange(1), '01:00–03:00');
assert.equal(viShichenRange(11), '21:00–23:00');
assert.equal(VI_STEMS.length, 10); assert.equal(VI_BRANCHES.length, 12);
assert.equal(viTerm('杀破狼'), 'Sát Phá Lang');
assert.equal(viTerm('空宫'), 'Vô Chính Diệu');
assert.equal(viHan('贞贪巨'), 'Trinh Tham Cự');
assert.equal(viHan('X天'), 'X Thiên');

// Gom ten tu cac file lib/ziwei va bao dam viTerm khong con chu Han.
const dir = fileURLToPath(new URL('../../lib/ziwei/', import.meta.url));
const files = ['constants', 'school-data', 'shier-shen', 'sihua', 'algorithm'];
const tokens = new Set<string>();
for (const f of files) {
  const src = readFileSync(`${dir}${f}.ts`, 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  for (const m of src.matchAll(/['"]([\p{Script=Han}]{1,8})['"]/gu)) tokens.add(m[1]);
}
// Ten cach cuc trong patterns.ts (name: '...').
const pat = readFileSync(`${dir}patterns.ts`, 'utf8');
for (const m of pat.matchAll(/name:\s*['"]([\p{Script=Han}]+)['"]/gu)) tokens.add(m[1]);
assert.ok(tokens.size > 100, `chi gom duoc ${tokens.size} token`);
const bad = [...tokens].filter((t) => HAN.test(viTerm(t)));
assert.deepEqual(bad, [], `viTerm con chu Han: ${bad.join(' ')}`);
// Moi ten sao trong shier-shen/school-data phai nam trong bang sao (khong chi roi vao phien am).
const shen = readFileSync(`${dir}shier-shen.ts`, 'utf8');
for (const m of shen.matchAll(/['"]([\p{Script=Han}]{2,3})['"]/gu)) {
  assert.ok(!HAN.test(viStar(m[1])), m[1]);
}
console.log(`vn-terms: OK (${tokens.size} tokens)`);
