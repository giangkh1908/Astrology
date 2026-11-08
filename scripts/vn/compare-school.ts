/**
 * Đối chiếu an sao: engine (lối Trung, iztro) với lasotuvi (lối Việt).
 *   Một lá số:  npx tsx scripts/vn/compare-school.ts 2003-06-15 6 male
 *               (giờ 0..11, 0 = Tý; ngày dương lịch, âm lịch tính theo Việt Nam UTC+7)
 *   Thống kê:   npx tsx scripts/vn/compare-school.ts --stats 1950 2025
 * Hai bên dùng CÙNG ngày âm lịch (lấy từ engine), nên khác biệt ở đây chỉ do cách an sao.
 */
import { generateChart } from '../../lib/ziwei/algorithm';
import type { ZiweiChart } from '../../lib/ziwei/types';
import { lapLaSoLasotuvi, type LasotuviChart } from '../../lib/vn/school-lasotuvi';
import { viStar, viBranch } from '../../lib/vn/terms';

function engineStars(c: ZiweiChart): Record<string, number[]> {
  const m: Record<string, number[]> = {};
  for (const p of c.palaces) for (const s of p.stars) (m[s.name] ??= []).push(p.branch);
  if (m['副截']) { (m['截空'] ??= []).push(...m['副截']); delete m['副截']; }
  if (m['副旬']) { (m['旬空'] ??= []).push(...m['副旬']); delete m['副旬']; }
  for (const k of Object.keys(m)) m[k].sort((a, b) => a - b);
  return m;
}
function engineSiHua(c: ZiweiChart): Record<string, string> {
  const m: Record<string, string> = {};
  for (const p of c.palaces) for (const s of p.stars) if (s.siHua) m[s.name] = s.siHua;
  return m;
}

interface Diff { key: string; engine: string; viet: string }

function compare(c: ZiweiChart, v: LasotuviChart): { diffs: Diff[]; onlyViet: string[]; onlyEngine: string[] } {
  const e = engineStars(c);
  const diffs: Diff[] = [];
  const pos = (a?: number[]) => (a && a.length ? a.map(viBranch).join('+') : '—');
  if (c.mingGongBranch !== v.mingGongBranch) diffs.push({ key: 'Cung Mệnh', engine: viBranch(c.mingGongBranch), viet: viBranch(v.mingGongBranch) });
  if (c.shenGongBranch !== v.shenGongBranch) diffs.push({ key: 'Cung Thân', engine: viBranch(c.shenGongBranch), viet: viBranch(v.shenGongBranch) });
  if (c.wuxingJu !== v.cucSo) diffs.push({ key: 'Cục', engine: String(c.wuxingJu), viet: String(v.cucSo) });
  for (const k of Object.keys(v.stars)) {
    if (!(k in e)) continue;
    if (pos(e[k]) !== pos(v.stars[k])) diffs.push({ key: k, engine: pos(e[k]), viet: pos(v.stars[k]) });
  }
  const es = engineSiHua(c);
  for (const k of new Set([...Object.keys(es), ...Object.keys(v.siHua)])) {
    if (es[k] !== v.siHua[k]) diffs.push({ key: `Hóa của ${k}`, engine: es[k] ?? '—', viet: v.siHua[k] ?? '—' });
  }
  const onlyViet = Object.keys(v.stars).filter(k => !(k in e));
  const onlyEngine = Object.keys(e).filter(k => !(k in v.stars));
  return { diffs, onlyViet, onlyEngine };
}

function both(y: number, m: number, d: number, hour: number, gender: 'male' | 'female') {
  const c = generateChart({ year: y, month: m, day: d, hour, gender, lunarTimeZone: 7 });
  const l = c.lunarInfo;
  const v = lapLaSoLasotuvi({
    lunarDay: l.lunarDay, lunarMonth: Math.abs(l.lunarMonth), hour,
    yearStem: l.yearStem, yearBranch: l.yearBranch, gender,
  });
  return { c, v, ...compare(c, v) };
}

const args = process.argv.slice(2);
if (args[0] === '--stats') {
  const from = Number(args[1] ?? 1950), to = Number(args[2] ?? 2025);
  const count: Record<string, number> = {};
  let n = 0;
  for (let y = from; y <= to; y++) for (const m of [1, 4, 7, 10]) for (const d of [3, 17]) for (let h = 0; h < 12; h += 1) for (const g of ['male', 'female'] as const) {
    const { diffs } = both(y, m, d, h, g);
    n++;
    for (const x of new Set(diffs.map(x => x.key.startsWith('Hóa của') ? 'Tứ Hóa' : x.key))) count[x] = (count[x] ?? 0) + 1;
  }
  console.log(`${n} lá số mẫu (${from}–${to}). Tỉ lệ lá số mà mỗi mục KHÁC giữa engine và lasotuvi:`);
  for (const [k, c] of Object.entries(count).sort((a, b) => b[1] - a[1])) {
    const name = k.startsWith('Cung') || k === 'Cục' || k === 'Tứ Hóa' ? k : `${viStar(k)} (${k})`;
    console.log(`  ${(100 * c / n).toFixed(1).padStart(5)}%  ${name}`);
  }
} else {
  const [ds = '2003-06-15', hs = '6', gs = 'male'] = args;
  const [y, m, d] = ds.split('-').map(Number);
  const { c, diffs, onlyViet, onlyEngine } = both(y, m, d, Number(hs), gs as 'male' | 'female');
  const l = c.lunarInfo;
  console.log(`Dương ${d}/${m}/${y}, giờ ${viBranch(Number(hs))}, ${gs === 'male' ? 'nam' : 'nữ'} → âm ${l.lunarDay}/${Math.abs(l.lunarMonth)}/${l.lunarYear}`);
  console.log(`\nSao cùng có ở hai bên nhưng KHÁC vị trí (${diffs.length}):`);
  for (const x of diffs) {
    const name = x.key.startsWith('Hóa của ') ? `Hóa của ${viStar(x.key.slice(8))}` : (x.key.startsWith('Cung') || x.key === 'Cục' ? x.key : viStar(x.key));
    console.log(`  ${name.padEnd(18)} engine: ${x.engine.padEnd(12)} lasotuvi: ${x.viet}`);
  }
  console.log(`\nChỉ lasotuvi có: ${onlyViet.join(', ')}`);
  console.log(`Chỉ engine có:   ${onlyEngine.map(k => viStar(k)).join(', ')}`);
}
