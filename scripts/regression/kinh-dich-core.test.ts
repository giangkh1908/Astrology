import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { castLine, computeCast, hexagramByBits, parseLines, type LineValue } from '../../lib/kinh-dich/core';
import { ATTRIBUTION, hexagramText } from '../../lib/kinh-dich/texts';

// Gieo xu: ngửa = 3, sấp = 2 (rand >= 0.5 là ngửa).
const seq = (...xs: number[]) => { let i = 0; return () => xs[i++ % xs.length]; };
assert.equal(castLine(seq(0.9, 0.9, 0.9)).value, 9);
assert.equal(castLine(seq(0.1, 0.1, 0.1)).value, 6);
assert.equal(castLine(seq(0.9, 0.1, 0.1)).value, 7);
assert.equal(castLine(seq(0.9, 0.9, 0.1)).value, 8);
assert.deepEqual(castLine(seq(0.9, 0.1, 0.9)).coins, [3, 2, 3]);
for (let i = 0; i < 200; i++) assert.ok([6, 7, 8, 9].includes(castLine().value));

// 64 mẫu bit → 64 quẻ khác nhau
const seen = new Set<number>();
for (let n = 0; n < 64; n++) {
  const bits = n.toString(2).padStart(6, '0');
  const h = hexagramByBits(bits);
  assert.ok(h.number >= 1 && h.number <= 64);
  assert.equal(h.bits, bits);
  seen.add(h.number);
}
assert.equal(seen.size, 64);
assert.equal(hexagramByBits('111111').number, 1);
assert.equal(hexagramByBits('111111').name, 'Thuần Càn');
assert.equal(hexagramByBits('000000').number, 2);
assert.equal(hexagramByBits('100010').number, 3); // Truân: Chấn dưới, Khảm trên
assert.equal(hexagramByBits('100010').name, 'Truân');
assert.equal(hexagramByBits('111000').number, 11); // Thái: Càn dưới, Khôn trên

// Quẻ chính, hào động, quẻ biến, trọng tâm
const c1 = computeCast([9, 7, 7, 7, 7, 7]);
assert.equal(c1.main.number, 1);
assert.deepEqual(c1.moving, [1]);
assert.equal(c1.changed?.number, 44);
assert.deepEqual(c1.focus, { kind: 'lines', of: 'main', lines: [1], primary: 1 });

const L = (s: string) => s.split('').map(Number) as LineValue[];
assert.deepEqual(computeCast(L('787878')).focus, { kind: 'judgment', of: 'main', lines: [] });
assert.equal(computeCast(L('787878')).changed, null);
assert.deepEqual(computeCast(L('797798')).focus, { kind: 'lines', of: 'main', lines: [2, 5], primary: 5 });
assert.equal(computeCast(L('969787')).focus.kind, 'both-judgments');
assert.deepEqual(computeCast(L('969677')).focus, { kind: 'changed-static-lines', of: 'changed', lines: [5, 6], primary: 5 });
assert.deepEqual(computeCast(L('969697')).focus, { kind: 'changed-static-lines', of: 'changed', lines: [6], primary: 6 });
assert.deepEqual(computeCast(L('999999')).focus, { kind: 'use-all', of: 'main', lines: [] });
assert.deepEqual(computeCast(L('666666')).focus, { kind: 'use-all', of: 'main', lines: [] });
assert.deepEqual(computeCast(L('969696')).focus, { kind: 'changed-judgment', of: 'changed', lines: [] });
assert.equal(computeCast(L('999999')).changed?.number, 2);

// Kiểm tra lines
assert.deepEqual(parseLines([6, 7, 8, 9, 7, 8]), [6, 7, 8, 9, 7, 8]);
assert.equal(parseLines([7, 7, 7, 7, 7]), null);
assert.equal(parseLines([7, 7, 7, 7, 7, 5]), null);
assert.equal(parseLines(['7', 7, 7, 7, 7, 7]), null);
assert.equal(parseLines([7.5, 7, 7, 7, 7, 7]), null);
assert.equal(parseLines('777777'), null);

// Dữ liệu lời kinh
for (let n = 1; n <= 64; n++) {
  const t = hexagramText(n);
  assert.ok(t.judgment.trim(), `quẻ ${n} thiếu Thoán`);
  assert.ok(t.image.trim(), `quẻ ${n} thiếu Tượng`);
  assert.equal(t.lines.length, 6);
  for (const l of t.lines) { assert.ok(l.textHV.trim() && l.gloss.trim(), `quẻ ${n} thiếu hào từ`); }
}
assert.ok(hexagramText(1).extra?.textHV.startsWith('Dụng Cửu'));
assert.ok(hexagramText(2).extra?.textHV.startsWith('Dụng Lục'));
assert.equal(hexagramText(3).extra, undefined);
assert.match(ATTRIBUTION, /Ngô Tất Tố/);
const notice = resolve('lib/kinh-dich/data/NOTICE.md');
assert.ok(existsSync(notice));
assert.match(readFileSync(notice, 'utf8'), /Ngô Tất Tố/);
assert.match(readFileSync(notice, 'utf8'), /CC BY 4\.0/);

console.log('kinh-dich-core: ok');
