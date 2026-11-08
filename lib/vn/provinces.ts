import type { VnRegion } from './timezone-vn';

/**
 * 63 tỉnh/thành Việt Nam (địa giới trước sáp nhập 7/2025 — đúng với nơi sinh của hầu hết người dùng).
 * Kinh độ lấy theo trung tâm tỉnh lỵ / thành phố, làm tròn 2 chữ số (sai số < 1 phút giờ mặt trời).
 * `region`: miền Bắc / miền Nam theo vĩ tuyến 17 (sông Bến Hải) — quyết định múi giờ lịch sử 1947–1975.
 */
export interface VnCity {
  name: string;
  longitude: number;
  /** Ghi đè miền của tỉnh (vd. Vĩnh Linh ở bờ bắc sông Bến Hải). */
  region?: VnRegion;
}

export interface VnProvince {
  name: string;
  region: VnRegion;
  cities: VnCity[];
}

const N: VnRegion = 'north';
const S: VnRegion = 'south';

export const VN_PROVINCES: VnProvince[] = [
  // ─── Miền Bắc (bắc vĩ tuyến 17) ───
  { name: 'Hà Nội', region: N, cities: [{ name: 'Hà Nội', longitude: 105.85 }, { name: 'Sơn Tây', longitude: 105.50 }] },
  { name: 'Hải Phòng', region: N, cities: [{ name: 'Hải Phòng', longitude: 106.68 }] },
  { name: 'Hà Giang', region: N, cities: [{ name: 'Hà Giang', longitude: 104.98 }] },
  { name: 'Cao Bằng', region: N, cities: [{ name: 'Cao Bằng', longitude: 106.26 }] },
  { name: 'Bắc Kạn', region: N, cities: [{ name: 'Bắc Kạn', longitude: 105.83 }] },
  { name: 'Tuyên Quang', region: N, cities: [{ name: 'Tuyên Quang', longitude: 105.22 }] },
  { name: 'Lào Cai', region: N, cities: [{ name: 'Lào Cai', longitude: 103.97 }, { name: 'Sa Pa', longitude: 103.84 }] },
  { name: 'Điện Biên', region: N, cities: [{ name: 'Điện Biên Phủ', longitude: 103.02 }] },
  { name: 'Lai Châu', region: N, cities: [{ name: 'Lai Châu', longitude: 103.46 }] },
  { name: 'Sơn La', region: N, cities: [{ name: 'Sơn La', longitude: 103.91 }] },
  { name: 'Yên Bái', region: N, cities: [{ name: 'Yên Bái', longitude: 104.87 }] },
  { name: 'Hòa Bình', region: N, cities: [{ name: 'Hòa Bình', longitude: 105.34 }] },
  { name: 'Thái Nguyên', region: N, cities: [{ name: 'Thái Nguyên', longitude: 105.84 }] },
  { name: 'Lạng Sơn', region: N, cities: [{ name: 'Lạng Sơn', longitude: 106.76 }] },
  { name: 'Quảng Ninh', region: N, cities: [
    { name: 'Hạ Long', longitude: 107.08 }, { name: 'Cẩm Phả', longitude: 107.29 },
    { name: 'Uông Bí', longitude: 106.78 }, { name: 'Móng Cái', longitude: 107.97 },
  ] },
  { name: 'Bắc Giang', region: N, cities: [{ name: 'Bắc Giang', longitude: 106.19 }] },
  { name: 'Phú Thọ', region: N, cities: [{ name: 'Việt Trì', longitude: 105.40 }] },
  { name: 'Vĩnh Phúc', region: N, cities: [{ name: 'Vĩnh Yên', longitude: 105.60 }] },
  { name: 'Bắc Ninh', region: N, cities: [{ name: 'Bắc Ninh', longitude: 106.07 }] },
  { name: 'Hải Dương', region: N, cities: [{ name: 'Hải Dương', longitude: 106.33 }] },
  { name: 'Hưng Yên', region: N, cities: [{ name: 'Hưng Yên', longitude: 106.05 }] },
  { name: 'Thái Bình', region: N, cities: [{ name: 'Thái Bình', longitude: 106.34 }] },
  { name: 'Hà Nam', region: N, cities: [{ name: 'Phủ Lý', longitude: 105.92 }] },
  { name: 'Nam Định', region: N, cities: [{ name: 'Nam Định', longitude: 106.17 }] },
  { name: 'Ninh Bình', region: N, cities: [{ name: 'Ninh Bình', longitude: 105.97 }] },
  { name: 'Thanh Hóa', region: N, cities: [{ name: 'Thanh Hóa', longitude: 105.78 }] },
  { name: 'Nghệ An', region: N, cities: [{ name: 'Vinh', longitude: 105.68 }] },
  { name: 'Hà Tĩnh', region: N, cities: [{ name: 'Hà Tĩnh', longitude: 105.90 }] },
  { name: 'Quảng Bình', region: N, cities: [{ name: 'Đồng Hới', longitude: 106.60 }] },

  // ─── Miền Trung & Tây Nguyên (nam vĩ tuyến 17) ───
  { name: 'Quảng Trị', region: S, cities: [
    { name: 'Đông Hà', longitude: 107.10 }, { name: 'Quảng Trị', longitude: 107.19 },
    { name: 'Vĩnh Linh (bắc Bến Hải)', longitude: 107.03, region: N },
  ] },
  { name: 'Thừa Thiên Huế', region: S, cities: [{ name: 'Huế', longitude: 107.59 }] },
  { name: 'Đà Nẵng', region: S, cities: [{ name: 'Đà Nẵng', longitude: 108.21 }] },
  { name: 'Quảng Nam', region: S, cities: [{ name: 'Tam Kỳ', longitude: 108.47 }, { name: 'Hội An', longitude: 108.33 }] },
  { name: 'Quảng Ngãi', region: S, cities: [{ name: 'Quảng Ngãi', longitude: 108.80 }] },
  { name: 'Bình Định', region: S, cities: [{ name: 'Quy Nhơn', longitude: 109.22 }] },
  { name: 'Phú Yên', region: S, cities: [{ name: 'Tuy Hòa', longitude: 109.32 }] },
  { name: 'Khánh Hòa', region: S, cities: [{ name: 'Nha Trang', longitude: 109.19 }, { name: 'Cam Ranh', longitude: 109.16 }] },
  { name: 'Ninh Thuận', region: S, cities: [{ name: 'Phan Rang – Tháp Chàm', longitude: 108.99 }] },
  { name: 'Bình Thuận', region: S, cities: [{ name: 'Phan Thiết', longitude: 108.10 }] },
  { name: 'Kon Tum', region: S, cities: [{ name: 'Kon Tum', longitude: 108.00 }] },
  { name: 'Gia Lai', region: S, cities: [{ name: 'Pleiku', longitude: 108.00 }] },
  { name: 'Đắk Lắk', region: S, cities: [{ name: 'Buôn Ma Thuột', longitude: 108.04 }] },
  { name: 'Đắk Nông', region: S, cities: [{ name: 'Gia Nghĩa', longitude: 107.69 }] },
  { name: 'Lâm Đồng', region: S, cities: [{ name: 'Đà Lạt', longitude: 108.44 }, { name: 'Bảo Lộc', longitude: 107.81 }] },

  // ─── Miền Nam ───
  { name: 'TP. Hồ Chí Minh', region: S, cities: [{ name: 'TP. Hồ Chí Minh', longitude: 106.70 }] },
  { name: 'Bình Phước', region: S, cities: [{ name: 'Đồng Xoài', longitude: 106.90 }] },
  { name: 'Tây Ninh', region: S, cities: [{ name: 'Tây Ninh', longitude: 106.10 }] },
  { name: 'Bình Dương', region: S, cities: [{ name: 'Thủ Dầu Một', longitude: 106.65 }] },
  { name: 'Đồng Nai', region: S, cities: [{ name: 'Biên Hòa', longitude: 106.82 }] },
  { name: 'Bà Rịa – Vũng Tàu', region: S, cities: [{ name: 'Vũng Tàu', longitude: 107.08 }, { name: 'Bà Rịa', longitude: 107.17 }] },
  { name: 'Long An', region: S, cities: [{ name: 'Tân An', longitude: 106.41 }] },
  { name: 'Tiền Giang', region: S, cities: [{ name: 'Mỹ Tho', longitude: 106.36 }] },
  { name: 'Bến Tre', region: S, cities: [{ name: 'Bến Tre', longitude: 106.38 }] },
  { name: 'Trà Vinh', region: S, cities: [{ name: 'Trà Vinh', longitude: 106.34 }] },
  { name: 'Vĩnh Long', region: S, cities: [{ name: 'Vĩnh Long', longitude: 105.97 }] },
  { name: 'Đồng Tháp', region: S, cities: [{ name: 'Cao Lãnh', longitude: 105.63 }, { name: 'Sa Đéc', longitude: 105.76 }] },
  { name: 'An Giang', region: S, cities: [{ name: 'Long Xuyên', longitude: 105.43 }, { name: 'Châu Đốc', longitude: 105.12 }] },
  { name: 'Kiên Giang', region: S, cities: [{ name: 'Rạch Giá', longitude: 105.08 }, { name: 'Phú Quốc', longitude: 103.96 }] },
  { name: 'Cần Thơ', region: S, cities: [{ name: 'Cần Thơ', longitude: 105.78 }] },
  { name: 'Hậu Giang', region: S, cities: [{ name: 'Vị Thanh', longitude: 105.47 }] },
  { name: 'Sóc Trăng', region: S, cities: [{ name: 'Sóc Trăng', longitude: 105.97 }] },
  { name: 'Bạc Liêu', region: S, cities: [{ name: 'Bạc Liêu', longitude: 105.72 }] },
  { name: 'Cà Mau', region: S, cities: [{ name: 'Cà Mau', longitude: 105.15 }] },
];

export function findVnCity(province: string, city: string): { province?: VnProvince; city?: VnCity; region: VnRegion } {
  const p = VN_PROVINCES.find(x => x.name === province);
  const c = p?.cities.find(x => x.name === city);
  return { province: p, city: c, region: c?.region ?? p?.region ?? 'north' };
}
