/**
 * An sao theo lối Việt — port từ doanguyen/lasotuvi (MIT, https://github.com/doanguyen/lasotuvi),
 * file lasotuvi/App.py + AmDuong.py + DiaBan.py. Chỉ port VỊ TRÍ sao, để đối chiếu với engine (iztro, lối Trung).
 *
 * Quy ước của lasotuvi: cung đánh số 1..12 với 1 = Tý; giờ 1 = Tý; giới tính nam = 1, nữ = -1;
 * âm dương năm theo can (dương = 1, âm = -1). Hàm xuất ra dùng chỉ số địa chi 0..11 (0 = Tý)
 * và khóa tên sao tiếng Trung giống engine để so trực tiếp.
 *
 * Lưu ý: lasotuvi là một cài đặt mã nguồn mở theo sách cụ Thiên Lương / Vu Thiên, không phải "chuẩn Việt"
 * duy nhất — các trang lá số Việt khác có thể khác ở vài sao (Khôi Việt, Lưu Hà, Thiên Trù, Quang Quý...).
 */

export interface LasotuviInput {
  /** Ngày âm lịch (1..30), tháng âm (1..12, tháng nhuận tính như tháng thường), giờ 0..11 (0 = Tý) */
  lunarDay: number;
  lunarMonth: number;
  hour: number;
  /** Can năm 0..9 (0 = Giáp), chi năm 0..11 (0 = Tý) */
  yearStem: number;
  yearBranch: number;
  gender: 'male' | 'female';
}

export interface LasotuviChart {
  mingGongBranch: number;
  shenGongBranch: number;
  cucSo: number;
  /** khóa sao (tên Trung như engine) → danh sách địa chi 0..11 */
  stars: Record<string, number[]>;
  /** Tứ Hóa: khóa sao → 禄/权/科/忌 */
  siHua: Record<string, '禄' | '权' | '科' | '忌'>;
}

/** dichCung của lasotuvi: cộng dồn, kết quả 1..12 */
function dc(start: number, ...moves: number[]): number {
  let v = start;
  for (const m of moves) v += m;
  const r = ((v % 12) + 12) % 12;
  return r === 0 ? 12 : r;
}

// vitriDiaBan của Lộc Tồn theo can (1-based can)
const LOC_TON = [0, 3, 4, 6, 7, 6, 7, 9, 10, 12, 1];
const AM_DUONG_CAN = [0, 1, -1, 1, -1, 1, -1, 1, -1, 1, -1];

// 30 nạp âm theo cặp hoa giáp: 0 Kim, 1 Thủy, 2 Hỏa, 3 Thổ, 4 Mộc
const NAYIN = '金火木土金火水土金木水土火木水金火木土金火水土金木水土火木水';
const CUC_OF: Record<string, number> = { 水: 2, 木: 3, 金: 4, 土: 5, 火: 6 };

function napAmCuc(branch1: number, stem1: number): number {
  const s = stem1 - 1;
  const b = branch1 - 1;
  for (let n = 0; n < 60; n++) if (n % 10 === s && n % 12 === b) return CUC_OF[NAYIN[Math.floor(n / 2)]];
  throw new Error('nap am');
}

function timTuVi(cuc: number, ngay: number): number {
  let cungDan = 3;
  let c = cuc;
  while (c < ngay) { c += cuc; cungDan += 1; }
  let sai = c - ngay;
  if (sai % 2 === 1) sai = -sai;
  return dc(cungDan, sai);
}

function timTrangSinh(cuc: number): number {
  if (cuc === 6) return 3;
  if (cuc === 4) return 6;
  if (cuc === 2 || cuc === 5) return 9;
  return 12;
}

function timHoaLinh(chiNam: number, gio: number, gioiTinh: number, amDuong: number): [number, number] {
  let h: number, l: number;
  if ([3, 7, 11].includes(chiNam)) { h = 2; l = 4; }
  else if ([1, 5, 9].includes(chiNam)) { h = 3; l = 11; }
  else if ([6, 10, 2].includes(chiNam)) { h = 11; l = 4; }
  else { h = 10; l = 11; }
  if (gioiTinh * amDuong === -1) return [dc(h + 1, -gio), dc(l - 1, gio)];
  return [dc(h - 1, gio), dc(l + 1, -gio)];
}

const KHOI = [0, 2, 1, 12, 10, 8, 1, 8, 7, 6, 4];
const THIEN_QUAN = [0, 8, 5, 6, 3, 4, 10, 12, 10, 11, 7];
const THIEN_PHUC = [0, 10, 9, 1, 12, 4, 3, 7, 6, 7, 6];
const LUU_HA = [0, 10, 11, 8, 5, 6, 7, 9, 4, 12, 3];
const THIEN_TRU = [0, 6, 7, 1, 6, 7, 9, 3, 7, 10, 11];

function timCoThan(chi: number): number {
  if ([12, 1, 2].includes(chi)) return 3;
  if ([3, 4, 5].includes(chi)) return 6;
  if ([6, 7, 8].includes(chi)) return 9;
  return 12;
}
function timThienMa(chi: number): number {
  return [6, 3, 12, 9][chi % 4];
}
function timPhaToai(chi: number): number {
  return [6, 10, 2][chi % 3];
}
function timTriet(can: number): [number, number] {
  if (can === 1 || can === 6) return [9, 10];
  if (can === 2 || can === 7) return [7, 8];
  if (can === 3 || can === 8) return [5, 6];
  if (can === 4 || can === 9) return [3, 4];
  return [1, 2];
}

export function lapLaSoLasotuvi(inp: LasotuviInput): LasotuviChart {
  const nn = inp.lunarDay;
  const tt = inp.lunarMonth;
  const gio = inp.hour + 1;
  const canNam = inp.yearStem + 1;
  const chiNam = inp.yearBranch + 1;
  const gioiTinh = inp.gender === 'male' ? 1 : -1;
  const amDuongNam = AM_DUONG_CAN[canNam];
  const amDuongNamNu = gioiTinh * amDuongNam;

  const cungThan = dc(3, tt - 1, gio - 1);
  const cungMenh = dc(3, tt - 1, -gio + 1);
  const cungNoBoc = dc(cungMenh, 5);
  const cungTatAch = dc(cungMenh, 7);

  // Cục: nạp âm của can-chi cung Mệnh
  const canThangGieng = (canNam * 2 + 1) % 10;
  let canThangMenh = ((((cungMenh - 3) % 12) + 12) % 12 + canThangGieng) % 10;
  if (canThangMenh === 0) canThangMenh = 10;
  const cucSo = napAmCuc(cungMenh, canThangMenh);

  const S: Record<string, number[]> = {};
  const put = (key: string, pos: number) => { (S[key] ??= []).push(pos - 1); };

  // Tử Vi tinh hệ
  const tuVi = timTuVi(cucSo, nn);
  const liem = dc(tuVi, 4), dong = dc(tuVi, 7), vu = dc(tuVi, 8), duong = dc(tuVi, 9), co = dc(tuVi, 11);
  put('紫微', tuVi); put('廉贞', liem); put('天同', dong); put('武曲', vu); put('太阳', duong); put('天机', co);
  // Thiên Phủ tinh hệ
  const phu = dc(3, 3 - tuVi);
  const am = dc(phu, 1), tham = dc(phu, 2), cu = dc(phu, 3), tuong = dc(phu, 4), luong = dc(phu, 5), sat = dc(phu, 6), pha = dc(phu, 10);
  put('天府', phu); put('太阴', am); put('贪狼', tham); put('巨门', cu); put('天相', tuong); put('天梁', luong); put('七杀', sat); put('破军', pha);

  // Vòng Lộc Tồn / Bác Sĩ
  const loc = LOC_TON[canNam];
  put('禄存', loc);
  const BOSHI = ['博士', '力士', '青龙', '小耗', '将军', '奏书', '飞廉', '喜神', '病符', '大耗', '伏兵', '官府'];
  BOSHI.forEach((k, i) => put(`${k}(博士)`, dc(loc, i * amDuongNamNu)));

  // Vòng Thái Tuế
  const SUI = ['岁建', '晦气', '丧门', '贯索', '官符', '小耗', '大耗', '龙德', '白虎', '天德', '吊客', '病符'];
  SUI.forEach((k, i) => put(`${k}(岁前)`, dc(chiNam, i)));
  put('天空', dc(chiNam, 1));
  put('月德', dc(chiNam, 5));
  put('天德(sao)', dc(chiNam, 9));

  // Vòng Tràng Sinh
  const ts = timTrangSinh(cucSo);
  const CS = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'];
  // lasotuvi đặt Thai = -1, Dưỡng = -2 (ngược thứ tự vòng thông thường Tuyệt → Thai → Dưỡng → Trường Sinh); port nguyên văn
  CS.forEach((k, i) => put(`${k}(长生)`, dc(ts, amDuongNamNu * (i <= 9 ? i : (k === '胎' ? -1 : -2)))));

  // Sao đôi
  const kinh = dc(loc, 1);
  put('陀罗', dc(loc, -1)); put('擎羊', kinh);
  const kiep = dc(11, gio);
  put('地劫', kiep); put('地空', dc(12, 12 - kiep));
  const [hoa, linh] = timHoaLinh(chiNam, gio, gioiTinh, amDuongNam);
  put('火星', hoa); put('铃星', linh);
  const longTri = dc(5, chiNam - 1);
  const phuongCac = dc(2, 2 - longTri);
  put('龙池', longTri); put('凤阁', phuongCac); put('年解', phuongCac);
  const taPhu = dc(5, tt - 1);
  put('左辅', taPhu); put('右弼', dc(2, 2 - taPhu));
  const vanKhuc = dc(5, gio - 1);
  const vanXuong = dc(2, 2 - vanKhuc);
  put('文曲', vanKhuc); put('文昌', vanXuong);
  const tamThai = dc(5, tt + nn - 2);
  put('三台', tamThai); put('八座', dc(2, 2 - tamThai));
  const anQuang = dc(vanXuong, nn - 2);
  put('恩光', anQuang); put('天贵', dc(2, 2 - anQuang));
  const khoi = KHOI[canNam];
  put('天魁', khoi); put('天钺', dc(5, 5 - khoi));
  put('天虚', dc(7, chiNam - 1)); put('天哭', dc(7, -chiNam + 1));
  put('天才', dc(cungMenh, chiNam - 1)); put('天寿', dc(cungThan, chiNam - 1));
  const hongLoan = dc(4, -chiNam + 1);
  put('红鸾', hongLoan); put('天喜', dc(hongLoan, 6));
  put('天官', THIEN_QUAN[canNam]); put('天福', THIEN_PHUC[canNam]);
  const hinh = dc(10, tt - 1);
  put('天刑', hinh); put('天姚', dc(hinh, 4)); put('天巫(Thiên Y)', dc(hinh, 4));
  const coThan = timCoThan(chiNam);
  put('孤辰', coThan); put('寡宿', dc(coThan, -4));
  const vanTinh = dc(kinh, 2), duongPhu = dc(vanTinh, 2), quocAn = dc(duongPhu, 3);
  put('Văn Tinh', vanTinh); put('Đường Phù', duongPhu); put('Quốc Ấn', quocAn);
  put('台辅', dc(vanKhuc, 2)); put('封诰', dc(vanKhuc, -2));
  put('Thiên Giải', dc(9, 2 * tt - 2)); put('Địa Giải', dc(taPhu, 3));
  put('Thiên La', 5); put('Địa Võng', 11);
  put('天伤', cungNoBoc); put('天使', cungTatAch);
  const ma = timThienMa(chiNam);
  const kiepSat = dc(ma, 3);
  put('天马', ma); put('华盖', dc(ma, 2)); put('劫煞', kiepSat); put('咸池', dc(kiepSat, 4));
  put('破碎', timPhaToai(chiNam));
  put('Đẩu Quân', dc(chiNam, -tt + gio));
  put('流霞', LUU_HA[canNam]); put('天厨', THIEN_TRU[canNam]);
  // Tuần, Triệt (mỗi cái 2 cung)
  const ketThucTuan = dc(chiNam, 10 - canNam);
  const tuan1 = dc(ketThucTuan, 1);
  put('旬空', tuan1); put('旬空', dc(tuan1, 1));
  const [t1, t2] = timTriet(canNam);
  put('截空', t1); put('截空', t2);

  // Tứ Hóa (theo 10 câu của cụ Thiên Lương)
  const HOA: Record<number, [string, string, string, string]> = {
    1: ['廉贞', '破军', '武曲', '太阳'],
    2: ['天机', '天梁', '紫微', '太阴'],
    3: ['天同', '天机', '文昌', '廉贞'],
    4: ['太阴', '天同', '天机', '巨门'],
    5: ['贪狼', '太阴', '右弼', '天机'],
    6: ['武曲', '贪狼', '天梁', '文曲'],
    7: ['太阳', '武曲', '天同', '太阴'],
    8: ['巨门', '太阳', '文曲', '文昌'],
    9: ['天梁', '紫微', '天府', '武曲'],
    10: ['破军', '巨门', '太阴', '贪狼'],
  };
  const [lu, quan, ke, ji] = HOA[canNam];
  const siHua: LasotuviChart['siHua'] = { [lu]: '禄', [quan]: '权', [ke]: '科', [ji]: '忌' };

  for (const k of Object.keys(S)) S[k].sort((a, b) => a - b);
  return { mingGongBranch: cungMenh - 1, shenGongBranch: cungThan - 1, cucSo, stars: S, siHua };
}
