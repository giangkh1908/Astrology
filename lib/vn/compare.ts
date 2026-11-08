/**
 * So sánh lá số tính theo âm lịch Việt Nam với lá số tính theo âm lịch Trung Quốc (cách gốc của engine).
 *
 * Cả hai bản đều dùng CÙNG giờ mặt trời thật và CÙNG cách an sao (iztro). Khác biệt duy nhất là
 * múi giờ dùng để xác định ngày âm lịch: UTC+7 (Việt Nam) và UTC+8 (Bắc Kinh). Khi điểm Sóc rơi vào
 * khoảng 23:00–24:00 giờ Hà Nội, hai lịch lệch nhau một ngày (đôi khi lệch cả tháng nhuận, thậm chí cả năm).
 */
import { generateChart } from '@/lib/ziwei/algorithm';
import type { BirthInfo, ZiweiChart } from '@/lib/ziwei/types';
import { viBranch, viPalace, viStar, viStemBranch, viWuxingJu, viSiHua } from './terms';

/** Lá số theo cách gốc (âm lịch Trung Quốc, UTC+8) — cùng giờ mặt trời thật. */
export function generateChartCN(info: BirthInfo): ZiweiChart {
  return generateChart({ ...info, lunarTimeZone: undefined });
}

export interface ChartDiffItem {
  /** Nhóm khác biệt, dùng để nhóm/hiển thị */
  kind: 'lunar' | 'core' | 'palace';
  label: string;
  vn: string;
  cn: string;
}

function lunarText(c: ZiweiChart): string {
  const l = c.lunarInfo;
  const ganzhi = c.lunarInfo.fourPillarsLunar?.[0];
  return `${l.lunarDay}/${Math.abs(l.lunarMonth)}${l.isLeapMonth ? ' (nhuận)' : ''}/${l.lunarYear}`
    + (ganzhi ? ` ${viStemBranch(ganzhi)}` : '');
}

function starList(c: ZiweiChart, branch: number): string[] {
  const p = c.palaces.find(x => x.branch === branch);
  if (!p) return [];
  return p.stars.map(s => viStar(s.name) + (s.siHua ? ` (${viSiHua(s.siHua)})` : ''));
}

function palaceAt(c: ZiweiChart, branch: number): string {
  const p = c.palaces.find(x => x.branch === branch);
  return p ? viPalace(p.name) : '—';
}

/** Liệt kê khác biệt giữa lá số VN và lá số CN. Mảng rỗng = hai lá số giống hệt. */
export function diffCharts(vn: ZiweiChart, cn: ZiweiChart): ChartDiffItem[] {
  const out: ChartDiffItem[] = [];

  const lv = lunarText(vn);
  const lc = lunarText(cn);
  if (lv !== lc) out.push({ kind: 'lunar', label: 'Ngày âm lịch', vn: lv, cn: lc });

  if (vn.mingGongBranch !== cn.mingGongBranch)
    out.push({ kind: 'core', label: 'Cung Mệnh an tại', vn: viBranch(vn.mingGongBranch), cn: viBranch(cn.mingGongBranch) });
  if (vn.shenGongBranch !== cn.shenGongBranch)
    out.push({ kind: 'core', label: 'Cung Thân an tại', vn: viBranch(vn.shenGongBranch), cn: viBranch(cn.shenGongBranch) });
  if (vn.wuxingJuName !== cn.wuxingJuName)
    out.push({ kind: 'core', label: 'Cục', vn: viWuxingJu(vn.wuxingJuName), cn: viWuxingJu(cn.wuxingJuName) });
  if (vn.ziweiPos !== cn.ziweiPos)
    out.push({ kind: 'core', label: 'Sao Tử Vi tại', vn: viBranch(vn.ziweiPos), cn: viBranch(cn.ziweiPos) });
  if ((vn.mingZhu ?? '') !== (cn.mingZhu ?? ''))
    out.push({ kind: 'core', label: 'Mệnh chủ', vn: viStar(vn.mingZhu ?? ''), cn: viStar(cn.mingZhu ?? '') });
  if ((vn.shenZhu ?? '') !== (cn.shenZhu ?? ''))
    out.push({ kind: 'core', label: 'Thân chủ', vn: viStar(vn.shenZhu ?? ''), cn: viStar(cn.shenZhu ?? '') });
  if (vn.currentAge !== cn.currentAge)
    out.push({ kind: 'core', label: 'Tuổi mụ hiện tại', vn: String(vn.currentAge), cn: String(cn.currentAge) });

  // So từng ô địa bàn (theo địa chi): tên cung + danh sách sao
  for (let b = 0; b < 12; b++) {
    const pv = palaceAt(vn, b);
    const pc = palaceAt(cn, b);
    const sv = starList(vn, b);
    const sc = starList(cn, b);
    const svKey = [...sv].sort().join('|');
    const scKey = [...sc].sort().join('|');
    if (pv === pc && svKey === scKey) continue;
    const onlyVn = sv.filter(s => !sc.includes(s));
    const onlyCn = sc.filter(s => !sv.includes(s));
    const head = pv === pc ? pv : `${pv} ↔ ${pc}`;
    out.push({
      kind: 'palace',
      label: `Ô ${viBranch(b)} — ${head}`,
      vn: onlyVn.length ? onlyVn.join(', ') : (pv !== pc ? `(cung ${pv})` : '—'),
      cn: onlyCn.length ? onlyCn.join(', ') : (pv !== pc ? `(cung ${pc})` : '—'),
    });
  }
  return out;
}
