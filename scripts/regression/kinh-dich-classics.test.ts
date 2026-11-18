import assert from 'node:assert/strict';
import { classicsOf, CLASSICS_SOURCES } from '../../lib/kinh-dich/classics';

const nonEmpty = (v: unknown, label: string) =>
  assert.ok(typeof v === 'string' && v.trim().length > 0, `${label} rỗng`);
// Không còn mã wiki/HTML hay dấu chú thích lọt vào văn bản
const clean = (v: string, label: string) =>
  assert.ok(!/[{}[\]<>|=]|-\{|'''|\u0001/.test(v), `${label} còn markup: ${v.slice(0, 60)}`);

for (let n = 1; n <= 64; n++) {
  const c = classicsOf(n);
  for (const k of ['tuan', 'xugua', 'zagua'] as const) { nonEmpty(c[k], `${n}.${k}`); clean(c[k], `${n}.${k}`); }
  assert.equal(c.xiaoXiang.length, 6, `${n}: cần 6 câu 小象`);
  c.xiaoXiang.forEach((x, i) => { nonEmpty(x, `${n}.xiaoXiang[${i}]`); clean(x, `${n}.xiaoXiang[${i}]`); });
  nonEmpty(c.judgment.cheng, `${n}.judgment.cheng`);
  nonEmpty(c.judgment.benyi, `${n}.judgment.benyi`);
  assert.equal(c.lines.length, 6, `${n}: cần 6 hào`);
  c.lines.forEach((l, i) => {
    nonEmpty(l.cheng, `${n}.lines[${i}].cheng`);
    nonEmpty(l.benyi, `${n}.lines[${i}].benyi`);
    clean(l.cheng, `${n}.lines[${i}].cheng`);
    clean(l.benyi, `${n}.lines[${i}].benyi`);
    // Nhãn nguồn đã được bóc khỏi đầu đoạn
    assert.ok(!/^(本義|傳)/.test(l.benyi), `${n}.lines[${i}].benyi còn nhãn`);
  });
  if (n <= 2) {
    assert.ok(c.yong, `${n}: thiếu 用九/用六`);
    nonEmpty(c.yong.xiaoXiang, `${n}.yong.xiaoXiang`);
    nonEmpty(c.yong.cheng, `${n}.yong.cheng`);
    nonEmpty(c.yong.benyi, `${n}.yong.benyi`);
    nonEmpty(c.wenyan, `${n}.wenyan`);
  } else {
    assert.equal(c.yong, undefined, `${n}: không có 用九/用六`);
    assert.equal(c.wenyan, undefined, `${n}: không có 文言`);
  }
}
assert.throws(() => classicsOf(0));
assert.throws(() => classicsOf(65));

// Đối chiếu vài câu đã biết
const qian = classicsOf(1);
const kun = classicsOf(2);
assert.ok(qian.tuan.startsWith('大哉乾元'), qian.tuan.slice(0, 10));
assert.ok(qian.xiaoXiang[0].includes('陽在下也'));
assert.ok(qian.yong!.xiaoXiang.includes('天德不可為首'));
assert.ok(qian.wenyan!.includes('元者，善之長也'));
assert.ok(qian.zagua.includes('剛'));
assert.ok(qian.lines[0].cheng.includes('陽氣方萌'), qian.lines[0].cheng.slice(0, 40)); // 程傳 初九
assert.ok(qian.lines[0].benyi.includes('初九者'), qian.lines[0].benyi.slice(0, 40)); // 本義 初九
assert.ok(qian.judgment.cheng.startsWith('上古聖人始畫八卦'));
assert.ok(kun.tuan.startsWith('至哉坤元'));
assert.ok(kun.yong!.xiaoXiang.includes('以大終也'));
assert.ok(kun.wenyan!.includes('積善之家'));
assert.ok(kun.lines[0].benyi.includes('霜'));
assert.ok(classicsOf(3).xugua.includes('盈'));
assert.ok(classicsOf(3).xiaoXiang[0].includes('志行正也'));
assert.ok(classicsOf(31).xugua.includes('夫婦'));
assert.ok(classicsOf(64).zagua.includes('男之窮'));
// 程傳 và 本義 là hai văn bản khác nhau, không bị dồn nhầm
for (let n = 1; n <= 64; n++) {
  const c = classicsOf(n);
  c.lines.forEach((l, i) => assert.notEqual(l.cheng, l.benyi, `${n}.lines[${i}]: cheng trùng benyi`));
}
assert.ok(CLASSICS_SOURCES.chuanyi.includes('wikisource.org'));

console.log('kinh-dich-classics: OK');
