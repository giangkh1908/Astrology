/**
 * Phân tích tất định cho một lần gieo (thuần, không mạng): quẻ hỗ/thác/tổng, bảng vị trí hào (chính vị, trung,
 * ứng, thừa/cưỡi), hào chủ, thuộc tính bát quái, và thời lệnh lúc gieo (tiết khí, mùa, vượng tướng hưu tù tử,
 * can chi). Đây là các dữ kiện LLM KHÔNG được tự tính; prompt chỉ việc chèn kết quả analyzeCast().
 */
import { Solar } from 'lunar-javascript';
import { viStemBranch } from '@/lib/vn/terms';
import { hexagramByBits, lineName, type Cast, type HexInfo } from './core';

// ---------------------------------------------------------------- Quẻ liên quan

export interface RelatedHexagrams {
  /** Hỗ quái: hào 2-3-4 làm quẻ dưới, 3-4-5 làm quẻ trên. */
  hỗ: HexInfo;
  /** Thác quái (錯): đảo âm dương cả sáu hào. */
  thác: HexInfo;
  /** Tổng quái (綜): lật ngược thứ tự hào (hào 1 thành hào 6). */
  tổng: HexInfo;
  tổngLàChínhNó: boolean;
}

export function relatedHexagrams(h: HexInfo): RelatedHexagrams {
  const b = h.bits;
  const tổng = hexagramByBits([...b].reverse().join(''));
  return {
    hỗ: hexagramByBits(b.slice(1, 4) + b.slice(2, 5)),
    thác: hexagramByBits([...b].map(c => (c === '1' ? '0' : '1')).join('')),
    tổng,
    tổngLàChínhNó: tổng.number === h.number,
  };
}

// ---------------------------------------------------------------- Bát quái

export type Element = 'Kim' | 'Mộc' | 'Thủy' | 'Hỏa' | 'Thổ';

export interface Trigram { tên: string; tượng: string; đức: string; ngũ_hành: Element; gia_đình: string }

/** Khoá: 3 bit đáy → đỉnh, '1' = dương. */
const TRIGRAMS: Record<string, Trigram> = {
  '111': { tên: 'Càn', tượng: 'trời', đức: 'mạnh', ngũ_hành: 'Kim', gia_đình: 'cha' },
  '000': { tên: 'Khôn', tượng: 'đất', đức: 'thuận', ngũ_hành: 'Thổ', gia_đình: 'mẹ' },
  '100': { tên: 'Chấn', tượng: 'sấm', đức: 'động', ngũ_hành: 'Mộc', gia_đình: 'trưởng nam' },
  '011': { tên: 'Tốn', tượng: 'gió', đức: 'vào', ngũ_hành: 'Mộc', gia_đình: 'trưởng nữ' },
  '010': { tên: 'Khảm', tượng: 'nước', đức: 'hiểm', ngũ_hành: 'Thủy', gia_đình: 'trung nam' },
  '101': { tên: 'Ly', tượng: 'lửa', đức: 'sáng', ngũ_hành: 'Hỏa', gia_đình: 'trung nữ' },
  '001': { tên: 'Cấn', tượng: 'núi', đức: 'dừng', ngũ_hành: 'Thổ', gia_đình: 'thiếu nam' },
  '110': { tên: 'Đoài', tượng: 'đầm', đức: 'vui', ngũ_hành: 'Kim', gia_đình: 'thiếu nữ' },
};

export function trigramOf(bits3: string): Trigram {
  const t = TRIGRAMS[bits3];
  if (!t) throw new Error(`Mẫu quái đơn không hợp lệ: ${bits3}`);
  return { ...t };
}

// ---------------------------------------------------------------- Bảng hào

export interface LineRow {
  hào: number;
  tên: string;
  âm_dương: 'dương' | 'âm';
  /** Chỉ có ở quẻ chính. */
  động?: boolean;
  /** Dương ở vị lẻ (1,3,5) / âm ở vị chẵn (2,4,6) = đắc chính. */
  chính_vị: 'đắc chính' | 'thất chính';
  /** Vị 2 hoặc 5. */
  trung: boolean;
  /** Ứng: 1-4, 2-5, 3-6; khác âm dương = chính ứng. */
  ứng: { với: number; quan_hệ: 'chính ứng' | 'vô ứng' };
  /** Hào âm nằm dưới hào dương liền trên (承). */
  thừa?: string;
  /** Hào âm nằm trên hào dương liền dưới (乘, "thừa cương"). */
  cưỡi?: string;
}

/** moving: số hào động của quẻ chính; bỏ trống (quẻ biến) thì không có trường `động`. */
export function lineTable(h: HexInfo, moving?: number[]): LineRow[] {
  const yang = (n: number) => h.bits[n - 1] === '1';
  return [1, 2, 3, 4, 5, 6].map(n => {
    const partner = n <= 3 ? n + 3 : n - 3;
    const row: LineRow = {
      hào: n,
      tên: lineName(h, n),
      âm_dương: yang(n) ? 'dương' : 'âm',
      ...(moving ? { động: moving.includes(n) } : {}),
      chính_vị: yang(n) === (n % 2 === 1) ? 'đắc chính' : 'thất chính',
      trung: n === 2 || n === 5,
      ứng: { với: partner, quan_hệ: yang(n) !== yang(partner) ? 'chính ứng' : 'vô ứng' },
    };
    if (!yang(n) && n < 6 && yang(n + 1)) row.thừa = `thừa hào ${n + 1} (âm dưới dương, thuận)`;
    if (!yang(n) && n > 1 && yang(n - 1)) row.cưỡi = `cưỡi hào ${n - 1} (âm trên dương — thừa cương, nghịch)`;
    return row;
  });
}

/** Cặp Nhị–Ngũ (vị trung của quẻ dưới và quẻ trên). */
function pairTwoFive(h: HexInfo) {
  const y2 = h.bits[1] === '1';
  const y5 = h.bits[4] === '1';
  return {
    hào_2: `${lineName(h, 2)} (${y2 ? 'thất chính' : 'đắc chính'})`,
    hào_5: `${lineName(h, 5)} (${y5 ? 'đắc chính' : 'thất chính'})`,
    quan_hệ: y2 !== y5 ? ('chính ứng' as const) : ('vô ứng' as const),
  };
}

// ---------------------------------------------------------------- Hào chủ

/**
 * Heuristic hào chủ quẻ (quái chủ), cố ý đơn giản:
 * 1) Có đúng một hào khác âm dương với năm hào còn lại → hào đó (vật hiếm làm chủ: Phục, Bác, Tỷ, Sư…).
 * 2) Không thì nếu hào 5 là dương (đắc trung đắc chính, ngôi tôn) → hào 5.
 * 3) Còn lại → null kèm lý do (cần đọc Thoán truyện, không tự suy).
 */
export function mainLine(h: HexInfo): { hào: number | null; lý_do: string } {
  const yangCount = [...h.bits].filter(c => c === '1').length;
  if (yangCount === 1 || yangCount === 5) {
    const odd = yangCount === 1 ? '1' : '0';
    const n = h.bits.indexOf(odd) + 1;
    return { hào: n, lý_do: `Hào ${n} là hào ${odd === '1' ? 'dương' : 'âm'} duy nhất — ít làm chủ nhiều` };
  }
  if (h.bits[4] === '1') return { hào: 5, lý_do: 'Hào 5 dương: đắc trung đắc chính, ngôi tôn' };
  return { hào: null, lý_do: 'Không có hào lẻ loi và hào 5 không đắc chính — không xác định bằng quy tắc đơn giản' };
}

// ---------------------------------------------------------------- Thời lệnh

export type WuxingState = 'vượng' | 'tướng' | 'hưu' | 'tù' | 'tử';

const GENERATES: Record<Element, Element> = { Mộc: 'Hỏa', Hỏa: 'Thổ', Thổ: 'Kim', Kim: 'Thủy', Thủy: 'Mộc' };
const CONTROLS: Record<Element, Element> = { Mộc: 'Thổ', Thổ: 'Thủy', Thủy: 'Hỏa', Hỏa: 'Kim', Kim: 'Mộc' };
const ELEMENTS: Element[] = ['Mộc', 'Hỏa', 'Thổ', 'Kim', 'Thủy'];

/** 当令者旺，令生者相，生令者休，克令者囚，令克者死. */
export function wuxingStates(ruling: Element): Record<Element, WuxingState> {
  const out = {} as Record<Element, WuxingState>;
  for (const e of ELEMENTS) {
    out[e] = e === ruling ? 'vượng'
      : GENERATES[ruling] === e ? 'tướng'
        : GENERATES[e] === ruling ? 'hưu'
          : CONTROLS[e] === ruling ? 'tù'
            : 'tử';
  }
  return out;
}

const SOLAR_TERMS: Record<string, string> = {
  立春: 'Lập Xuân', 雨水: 'Vũ Thủy', 惊蛰: 'Kinh Trập', 春分: 'Xuân Phân', 清明: 'Thanh Minh', 谷雨: 'Cốc Vũ',
  立夏: 'Lập Hạ', 小满: 'Tiểu Mãn', 芒种: 'Mang Chủng', 夏至: 'Hạ Chí', 小暑: 'Tiểu Thử', 大暑: 'Đại Thử',
  立秋: 'Lập Thu', 处暑: 'Xử Thử', 白露: 'Bạch Lộ', 秋分: 'Thu Phân', 寒露: 'Hàn Lộ', 霜降: 'Sương Giáng',
  立冬: 'Lập Đông', 小雪: 'Tiểu Tuyết', 大雪: 'Đại Tuyết', 冬至: 'Đông Chí', 小寒: 'Tiểu Hàn', 大寒: 'Đại Hàn',
  // lunar-javascript dùng khoá pinyin cho vài tiết ở rìa bảng năm
  DONG_ZHI: 'Đông Chí', XIAO_HAN: 'Tiểu Hàn', DA_HAN: 'Đại Hàn', LI_CHUN: 'Lập Xuân', YU_SHUI: 'Vũ Thủy', JING_ZHE: 'Kinh Trập',
};

/** Theo chi tháng (tháng tiết khí): mùa và hành đương lệnh; Thìn Tuất Sửu Mùi = tứ quý, Thổ vượng. */
const MONTH_BRANCH: Record<string, { mùa: 'Xuân' | 'Hạ' | 'Thu' | 'Đông'; hành: Element }> = {
  寅: { mùa: 'Xuân', hành: 'Mộc' }, 卯: { mùa: 'Xuân', hành: 'Mộc' }, 辰: { mùa: 'Xuân', hành: 'Thổ' },
  巳: { mùa: 'Hạ', hành: 'Hỏa' }, 午: { mùa: 'Hạ', hành: 'Hỏa' }, 未: { mùa: 'Hạ', hành: 'Thổ' },
  申: { mùa: 'Thu', hành: 'Kim' }, 酉: { mùa: 'Thu', hành: 'Kim' }, 戌: { mùa: 'Thu', hành: 'Thổ' },
  亥: { mùa: 'Đông', hành: 'Thủy' }, 子: { mùa: 'Đông', hành: 'Thủy' }, 丑: { mùa: 'Đông', hành: 'Thổ' },
};

const BRANCH_ORDER = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

/** Phần runtime của lunar-javascript mà .d.ts dự án chưa khai báo. */
interface LunarRuntime {
  getPrevJieQi(wholeDay?: boolean): { getName(): string };
  getNextJie(wholeDay?: boolean): { getName(): string; getSolar(): { toYmdHms(): string } };
  getMonthZhiExact(): string;
  getMonthInGanZhiExact(): string;
  getDayInGanZhi(): string;
  getYearInGanZhiExact(): string;
}
interface SolarRuntime { fromYmdHms(y: number, m: number, d: number, h: number, mi: number, s: number): { getLunar(): LunarRuntime } }

const VN_OFFSET_MS = 7 * 3600 * 1000;

export interface CastSeason {
  /** Giờ Việt Nam (UTC+7), dạng YYYY-MM-DD HH:mm. */
  giờ_VN: string;
  tiết_khí: string;
  mùa: 'Xuân' | 'Hạ' | 'Thu' | 'Đông';
  /** Tháng Thìn/Mùi/Tuất/Sửu: cuối mùa, Thổ đương lệnh. */
  tứ_quý: boolean;
  tháng_lệnh: string;
  hành_đương_lệnh: Element;
  vượng_suy: Record<Element, WuxingState>;
  can_chi_năm: string;
  can_chi_tháng: string;
  can_chi_ngày: string;
  /** Tháng đầu / giữa / cuối của mùa (theo chi tháng tiết khí). */
  vị_trí_trong_mùa: 'đầu' | 'giữa' | 'cuối';
  /** Chi ba tháng tiết khí kế tiếp, kèm mùa. */
  ba_tháng_tới: string[];
  /** Tiết lớn (mở tháng) kế tiếp và ngày theo giờ VN (YYYY-MM-DD). */
  tiết_kế: { tên: string; ngày: string };
}

/**
 * Tiết khí / tháng lệnh theo giờ Việt Nam. lunar-javascript tính mốc tiết theo giờ Bắc Kinh (UTC+8), nên ta
 * đổi giờ VN sang UTC+8 trước khi tra (mốc thật không phụ thuộc múi giờ); ngày âm–can chi ngày lấy theo lịch VN.
 * Can chi tháng theo tiết (chính xác tới phút), can chi năm đổi ở Lập Xuân, can chi ngày đổi lúc 0h.
 */
export function castSeason(at: Date): CastSeason {
  const vn = new Date(at.getTime() + VN_OFFSET_MS);
  const cn = new Date(at.getTime() + VN_OFFSET_MS + 3600 * 1000);
  const S = Solar as unknown as SolarRuntime;
  const lunarOf = (d: Date) => S.fromYmdHms(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()).getLunar();
  const term = lunarOf(cn);
  const day = lunarOf(vn);
  const zhi = term.getMonthZhiExact();
  const m = MONTH_BRANCH[zhi];
  const termName = term.getPrevJieQi(false).getName();
  const idx = BRANCH_ORDER.indexOf(zhi);
  const nextJie = term.getNextJie(false);
  // Mốc của lunar-javascript theo giờ Bắc Kinh: lùi 1 giờ ra giờ VN.
  const jieAt = new Date(`${nextJie.getSolar().toYmdHms().replace(' ', 'T')}Z`).getTime() - 3600 * 1000;
  return {
    giờ_VN: vn.toISOString().slice(0, 16).replace('T', ' '),
    tiết_khí: SOLAR_TERMS[termName] ?? termName,
    mùa: m.mùa,
    tứ_quý: m.hành === 'Thổ',
    tháng_lệnh: viStemBranch(zhi),
    hành_đương_lệnh: m.hành,
    vượng_suy: wuxingStates(m.hành),
    can_chi_năm: viStemBranch(term.getYearInGanZhiExact()),
    can_chi_tháng: viStemBranch(term.getMonthInGanZhiExact()),
    can_chi_ngày: viStemBranch(day.getDayInGanZhi()),
    vị_trí_trong_mùa: (['đầu', 'giữa', 'cuối'] as const)[(idx + 12 - 2) % 3],
    ba_tháng_tới: [1, 2, 3].map(k => {
      const b = BRANCH_ORDER[(idx + k) % 12];
      return `${viStemBranch(b)} (${MONTH_BRANCH[b].mùa})`;
    }),
    tiết_kế: { tên: SOLAR_TERMS[nextJie.getName()] ?? nextJie.getName(), ngày: new Date(jieAt).toISOString().slice(0, 10) },
  };
}

// ---------------------------------------------------------------- Tổng hợp

const brief = (h: HexInfo) => ({ số: h.number, tên: h.name, chữ_Hán: h.hanzi });

export function analyzeCast(cast: Cast, castAt: Date) {
  const rel = relatedHexagrams(cast.main);
  const season = castSeason(castAt);
  const upper = trigramOf(cast.main.bits.slice(3));
  const lower = trigramOf(cast.main.bits.slice(0, 3));
  const chủ = mainLine(cast.main);
  return {
    hỗ_quái: brief(rel.hỗ),
    quẻ_thác: brief(rel.thác),
    quẻ_tổng: { ...brief(rel.tổng), ...(rel.tổngLàChínhNó ? { ghi_chú: 'tổng quái là chính nó (quẻ đối xứng)' } : {}) },
    quái_trên: { ...upper, vượng_suy: season.vượng_suy[upper.ngũ_hành] },
    quái_dưới: { ...lower, vượng_suy: season.vượng_suy[lower.ngũ_hành] },
    bảng_hào: lineTable(cast.main, cast.moving),
    cặp_nhị_ngũ: pairTwoFive(cast.main),
    hào_chủ: chủ,
    quẻ_biến: cast.changed
      ? {
        ...brief(cast.changed),
        hỗ_quái: brief(relatedHexagrams(cast.changed).hỗ),
        quái_trên: trigramOf(cast.changed.bits.slice(3)).tên,
        quái_dưới: trigramOf(cast.changed.bits.slice(0, 3)).tên,
        bảng_hào: lineTable(cast.changed),
      }
      : null,
    thời_điểm_gieo: season,
  };
}

export type CastAnalysis = ReturnType<typeof analyzeCast>;
