/**
 * Ngũ hành và tính chất cát/hung của sao — dùng để tô màu và xếp cột trên lá số theo lối Việt.
 * Nguồn: bảng Sao.py của doanguyen/lasotuvi (MIT): saoNguHanh (K/M/T/H/O) và saoLoai (< 10 tốt, > 10 xấu).
 * Khóa là tên sao tiếng Trung như engine. Sao không có trong lasotuvi (thần sát lối Trung) ghi chú riêng.
 */

export type Hanh = 'kim' | 'moc' | 'thuy' | 'hoa' | 'tho';

export interface StarMeta {
  hanh: Hanh;
  /** true = cát tinh (cột trái), false = hung/sát/bại tinh (cột phải) */
  good: boolean;
}

const K: Hanh = 'kim', M: Hanh = 'moc', T: Hanh = 'thuy', H: Hanh = 'hoa', O: Hanh = 'tho';

const META: Record<string, StarMeta> = {
  // 14 chính tinh
  紫微: { hanh: O, good: true }, 天机: { hanh: M, good: true }, 太阳: { hanh: H, good: true },
  武曲: { hanh: K, good: true }, 天同: { hanh: T, good: true }, 廉贞: { hanh: H, good: true },
  天府: { hanh: O, good: true }, 太阴: { hanh: T, good: true }, 贪狼: { hanh: T, good: true },
  巨门: { hanh: T, good: true }, 天相: { hanh: T, good: true }, 天梁: { hanh: M, good: true },
  七杀: { hanh: K, good: true }, 破军: { hanh: T, good: true },
  // Lục cát, Lộc, Mã
  左辅: { hanh: O, good: true }, 右弼: { hanh: O, good: true }, 文昌: { hanh: K, good: true },
  文曲: { hanh: T, good: true }, 天魁: { hanh: H, good: true }, 天钺: { hanh: H, good: true },
  禄存: { hanh: O, good: true }, 天马: { hanh: H, good: true },
  // Lục sát
  擎羊: { hanh: K, good: false }, 陀罗: { hanh: K, good: false }, 火星: { hanh: H, good: false },
  铃星: { hanh: H, good: false }, 地空: { hanh: H, good: false }, 地劫: { hanh: H, good: false },
  // Phụ tinh tốt
  龙池: { hanh: T, good: true }, 凤阁: { hanh: O, good: true }, 三台: { hanh: M, good: true },
  八座: { hanh: T, good: true }, 恩光: { hanh: M, good: true }, 天贵: { hanh: O, good: true },
  红鸾: { hanh: T, good: true }, 天喜: { hanh: T, good: true }, 年解: { hanh: M, good: true },
  解神: { hanh: M, good: true }, 台辅: { hanh: K, good: true }, 封诰: { hanh: O, good: true },
  天才: { hanh: O, good: true }, 天寿: { hanh: O, good: true }, 天官: { hanh: H, good: true },
  天福: { hanh: H, good: true }, 天厨: { hanh: O, good: true }, 天德: { hanh: H, good: true },
  月德: { hanh: H, good: true }, 龙德: { hanh: T, good: true }, 咸池: { hanh: M, good: true },
  天巫: { hanh: T, good: true }, // Thiên Vu — lasotuvi không có; xếp cát như Thiên Y
  蜚廉: { hanh: H, good: true }, // Phỉ/Phi Liêm — lasotuvi xếp loại 2 (phụ tinh), cột cát
  // Hung, bại, ám tinh
  天刑: { hanh: H, good: false }, 天姚: { hanh: T, good: false }, 天哭: { hanh: T, good: false },
  天虚: { hanh: T, good: false }, 孤辰: { hanh: O, good: false }, 寡宿: { hanh: O, good: false },
  破碎: { hanh: H, good: false }, 华盖: { hanh: K, good: false }, 劫煞: { hanh: H, good: false },
  天空: { hanh: T, good: false }, 天伤: { hanh: O, good: false }, 天使: { hanh: T, good: false },
  大耗: { hanh: H, good: false },
  阴煞: { hanh: T, good: false }, // Âm Sát — thần sát lối Trung
  天月: { hanh: H, good: false }, // Thiên Nguyệt (bệnh tinh) — thần sát lối Trung
};

const FALLBACK: StarMeta = { hanh: K, good: true };

export function starMeta(zh: string): StarMeta {
  return META[zh] ?? FALLBACK;
}

/** Sao Tuần, Triệt: không vẽ trong cung mà vẽ trên ranh giới hai cung */
export const TUAN_KEYS = new Set(['旬空', '副旬']);
export const TRIET_KEYS = new Set(['截空', '副截']);

/** Độ sáng 7 mức lối Trung → 5 ký hiệu lối Việt */
const BRIGHT_VN: Record<string, { short: string; full: string }> = {
  庙: { short: 'M', full: 'Miếu' },
  旺: { short: 'V', full: 'Vượng' },
  得: { short: 'Đ', full: 'Đắc' },
  利: { short: 'Đ', full: 'Lợi (lối Trung, quy về Đắc)' },
  平: { short: 'B', full: 'Bình' },
  闲: { short: 'B', full: 'Nhàn (lối Trung, quy về Bình)' },
  不: { short: 'H', full: 'Bất (lối Trung, quy về Hãm)' },
  陷: { short: 'H', full: 'Hãm' },
  地: { short: 'Đ', full: 'Địa (lối Trung, quy về Đắc)' },
};

export function brightnessVN(raw?: string): { short: string; full: string } | null {
  return raw && BRIGHT_VN[raw] ? BRIGHT_VN[raw] : null;
}

/** 30 nạp âm (theo cặp hoa giáp, bắt đầu Giáp Tý) */
const NAP_AM = [
  'Hải Trung Kim', 'Lư Trung Hỏa', 'Đại Lâm Mộc', 'Lộ Bàng Thổ', 'Kiếm Phong Kim', 'Sơn Đầu Hỏa',
  'Giản Hạ Thủy', 'Thành Đầu Thổ', 'Bạch Lạp Kim', 'Dương Liễu Mộc', 'Tuyền Trung Thủy', 'Ốc Thượng Thổ',
  'Tích Lịch Hỏa', 'Tùng Bách Mộc', 'Trường Lưu Thủy', 'Sa Trung Kim', 'Sơn Hạ Hỏa', 'Bình Địa Mộc',
  'Bích Thượng Thổ', 'Kim Bạch Kim', 'Phú Đăng Hỏa', 'Thiên Hà Thủy', 'Đại Trạch Thổ', 'Thoa Xuyến Kim',
  'Tang Đố Mộc', 'Đại Khê Thủy', 'Sa Trung Thổ', 'Thiên Thượng Hỏa', 'Thạch Lựu Mộc', 'Đại Hải Thủy',
];

/** Nạp âm của can chi (can 0..9, chi 0..11) */
export function napAm(stem: number, branch: number): string {
  for (let n = 0; n < 60; n++) if (n % 10 === stem && n % 12 === branch) return NAP_AM[Math.floor(n / 2)];
  return '';
}

const HANH_OF_WORD: Record<string, Hanh> = { Kim: K, Mộc: M, Thủy: T, Hỏa: H, Thổ: O };
const HANH_OF_ZH: Record<string, Hanh> = { 金: K, 木: M, 水: T, 火: H, 土: O };
const HANH_NAME: Record<Hanh, string> = { kim: 'Kim', moc: 'Mộc', thuy: 'Thủy', hoa: 'Hỏa', tho: 'Thổ' };
const SINH: Record<Hanh, Hanh> = { kim: T, thuy: M, moc: H, hoa: O, tho: K };

export function hanhOfNapAm(name: string): Hanh | null {
  const w = name.split(' ').pop() ?? '';
  return HANH_OF_WORD[w] ?? null;
}

export function hanhOfCuc(wuxingJuName: string): Hanh | null {
  return HANH_OF_ZH[wuxingJuName[0]] ?? null;
}

export function hanhName(h: Hanh): string {
  return HANH_NAME[h];
}

/** Quan hệ Mệnh (nạp âm năm) và Cục, cách ghi thường gặp trên lá số Việt */
export function menhCucRelation(menh: Hanh, cuc: Hanh): string {
  if (menh === cuc) return 'Mệnh Cục bình hòa';
  if (SINH[cuc] === menh) return 'Cục sinh Mệnh';
  if (SINH[menh] === cuc) return 'Mệnh sinh Cục';
  // khắc: A khắc B khi SINH[SINH[A]] === B
  if (SINH[SINH[cuc]] === menh) return 'Cục khắc Mệnh';
  return 'Mệnh khắc Cục';
}
