/**
 * Lớp dịch hiển thị: tên Trung (giản thể, khóa của engine) -> Hán-Việt.
 * Engine vẫn dùng chữ Hán làm khóa; file này chỉ dùng để hiển thị.
 */

import { VN_STAR_NAMES } from './ten-chuan';
export const VI_STEMS: readonly string[] = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
export const VI_BRANCHES: readonly string[] = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];

const ZH_STEMS = '甲乙丙丁戊己庚辛壬癸';
const ZH_BRANCHES = '子丑寅卯辰巳午未申酉戌亥';

/** Bảng "khóa:giá trị" gọn, tách bằng khoảng trắng; dấu _ trong giá trị là khoảng trắng. */
function table(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const item of src.trim().split(/\s+/)) {
    const i = item.indexOf(':');
    out[item.slice(0, i)] = item.slice(i + 1).replace(/_/g, ' ');
  }
  return out;
}

function has(t: Record<string, string>, k: string): boolean {
  return Object.prototype.hasOwnProperty.call(t, k);
}

// ---------------------------------------------------------------- Sao
const MAIN_STARS = table(`
紫微:Tử_Vi 天机:Thiên_Cơ 太阳:Thái_Dương 武曲:Vũ_Khúc 天同:Thiên_Đồng 廉贞:Liêm_Trinh
天府:Thiên_Phủ 太阴:Thái_Âm 贪狼:Tham_Lang 巨门:Cự_Môn 天相:Thiên_Tướng 天梁:Thiên_Lương
七杀:Thất_Sát 破军:Phá_Quân
`);

const AUX_STARS = table(`
左辅:Tả_Phù 右弼:Hữu_Bật 文昌:Văn_Xương 文曲:Văn_Khúc 天魁:Thiên_Khôi 天钺:Thiên_Việt
禄存:Lộc_Tồn 天马:Thiên_Mã
擎羊:Kình_Dương 陀罗:Đà_La 火星:Hỏa_Tinh 铃星:Linh_Tinh 地空:Địa_Không 地劫:Địa_Kiếp
红鸾:Hồng_Loan 天喜:Thiên_Hỷ 天姚:Thiên_Diêu 天刑:Thiên_Hình 咸池:Hàm_Trì 桃花:Đào_Hoa
天哭:Thiên_Khốc 天虚:Thiên_Hư 龙池:Long_Trì 凤阁:Phượng_Các 三台:Tam_Thai 八座:Bát_Tọa
恩光:Ân_Quang 天贵:Thiên_Quý 天官:Thiên_Quan 天福:Thiên_Phúc 天厨:Thiên_Trù 天才:Thiên_Tài
天寿:Thiên_Thọ 孤辰:Cô_Thần 寡宿:Quả_Tú 蜚廉:Phỉ_Liêm 破碎:Phá_Toái 华盖:Hoa_Cái
解神:Giải_Thần 天巫:Thiên_Vu 天月:Thiên_Nguyệt 阴煞:Âm_Sát 台辅:Thai_Phụ 封诰:Phong_Cáo
天空:Thiên_Không 截空:Tiệt_Không 截路:Tiệt_Lộ 旬空:Tuần_Không 副截:Phó_Tiệt 副旬:Phó_Tuần
天伤:Thiên_Thương 天使:Thiên_Sứ 天罗:Thiên_La 地网:Địa_Võng 劫煞:Kiếp_Sát 龙德:Long_Đức
大耗:Đại_Hao 天德:Thiên_Đức 月德:Nguyệt_Đức 年解:Niên_Giải 空亡:Không_Vong
天医:Thiên_Y 红艳:Hồng_Diễm 孤寡:Cô_Quả
`);

const BOSHI12 = table(`
博士:Bác_Sĩ 力士:Lực_Sĩ 青龙:Thanh_Long 小耗:Tiểu_Hao 将军:Tướng_Quân 奏书:Tấu_Thư
飞廉:Phi_Liêm 喜神:Hỷ_Thần 病符:Bệnh_Phù 大耗:Đại_Hao 伏兵:Phục_Binh 官府:Quan_Phủ
`);

const CHANGSHENG12 = table(`
长生:Trường_Sinh 沐浴:Mộc_Dục 冠带:Quan_Đới 临官:Lâm_Quan 帝旺:Đế_Vượng 衰:Suy
病:Bệnh 死:Tử 墓:Mộ 绝:Tuyệt 胎:Thai 养:Dưỡng
`);

const JIANGQIAN12 = table(`
将星:Tướng_Tinh 攀鞍:Phan_An 岁驿:Tuế_Dịch 息神:Tức_Thần 华盖:Hoa_Cái 劫煞:Kiếp_Sát
灾煞:Tai_Sát 天煞:Thiên_Sát 指背:Chỉ_Bối 咸池:Hàm_Trì 月煞:Nguyệt_Sát 亡神:Vong_Thần
`);

const SUIQIAN12 = table(`
岁建:Tuế_Kiến 晦气:Hối_Khí 丧门:Tang_Môn 贯索:Quán_Sách 官符:Quan_Phù 小耗:Tiểu_Hao
大耗:Đại_Hao 龙德:Long_Đức 白虎:Bạch_Hổ 天德:Thiên_Đức 吊客:Điếu_Khách 病符:Bệnh_Phù
岁破:Tuế_Phá
`);

const STAR_TABLES = [MAIN_STARS, AUX_STARS, BOSHI12, JIANGQIAN12, SUIQIAN12, CHANGSHENG12];

function lookupStar(zh: string): string | undefined {
  for (const t of STAR_TABLES) if (has(t, zh)) return t[zh];
  return undefined;
}

export function viStar(zh: string): string {
  return (has(VN_STAR_NAMES, zh) ? VN_STAR_NAMES[zh] : undefined) ?? lookupStar(zh) ?? viHan(zh);
}

// ---------------------------------------------------------------- Cung
const PALACES = table(`
命:Mệnh 兄弟:Huynh_Đệ 夫妻:Phu_Thê 子女:Tử_Tức 财帛:Tài_Bạch 疾厄:Tật_Ách 迁移:Thiên_Di
仆役:Nô_Bộc 交友:Nô_Bộc 奴仆:Nô_Bộc 官禄:Quan_Lộc 事业:Quan_Lộc 田宅:Điền_Trạch
福德:Phúc_Đức 父母:Phụ_Mẫu 身:Thân
`);

function lookupPalace(zh: string): string | undefined {
  const k = zh.endsWith('宫') ? zh.slice(0, -1) : zh;
  if (k && has(PALACES, k)) return PALACES[k];
  return undefined;
}

export function viPalace(zh: string): string {
  return lookupPalace(zh) ?? viHan(zh);
}

// ---------------------------------------------------------------- Can chi
export function viStem(idxOrZh: number | string): string {
  if (typeof idxOrZh === 'number') return VI_STEMS[((idxOrZh % 10) + 10) % 10];
  const i = ZH_STEMS.indexOf(idxOrZh);
  return i >= 0 && idxOrZh.length === 1 ? VI_STEMS[i] : viHan(idxOrZh);
}

export function viBranch(idxOrZh: number | string): string {
  if (typeof idxOrZh === 'number') return VI_BRANCHES[((idxOrZh % 12) + 12) % 12];
  const i = ZH_BRANCHES.indexOf(idxOrZh);
  return i >= 0 && idxOrZh.length === 1 ? VI_BRANCHES[i] : viHan(idxOrZh);
}

function stemBranchOrNull(zh: string): string | null {
  const chars = Array.from(zh.replace(/\s+/g, ''));
  if (chars.length === 0) return null;
  const out: string[] = [];
  for (const c of chars) {
    const s = ZH_STEMS.indexOf(c);
    if (s >= 0) { out.push(VI_STEMS[s]); continue; }
    const b = ZH_BRANCHES.indexOf(c);
    if (b >= 0) { out.push(VI_BRANCHES[b]); continue; }
    return null;
  }
  return out.join(' ');
}

export function viStemBranch(zh: string): string {
  return stemBranchOrNull(zh) ?? viHan(zh);
}

// ---------------------------------------------------------------- Tứ hóa, độ sáng, cục
const SIHUA = table('禄:Lộc 权:Quyền 科:Khoa 忌:Kỵ');

function sihuaOrNull(zh: string): string | null {
  if (zh.length === 2 && zh[0] === '化' && has(SIHUA, zh[1])) return 'Hóa ' + SIHUA[zh[1]];
  if (zh.length === 3 && zh.startsWith('自化') && has(SIHUA, zh[2])) return 'Tự Hóa ' + SIHUA[zh[2]];
  if (zh.length === 1 && has(SIHUA, zh)) return SIHUA[zh];
  return null;
}

export function viSiHua(zh: string): string {
  return sihuaOrNull(zh) ?? viHan(zh);
}

const BRIGHTNESS = table('庙:Miếu 旺:Vượng 得:Đắc 利:Lợi 平:Bình 不:Bất 闲:Nhàn 陷:Hãm 地:Địa');

export function viBrightness(zh: string): string {
  return has(BRIGHTNESS, zh) ? BRIGHTNESS[zh] : viHan(zh);
}

const WUXING = table('水:Thủy 木:Mộc 金:Kim 火:Hỏa 土:Thổ');
const JU_NUM = table('二:Nhị 三:Tam 四:Tứ 五:Ngũ 六:Lục');

function wuxingJuOrNull(zh: string): string | null {
  if (zh.length === 3 && zh[2] === '局' && has(WUXING, zh[0]) && has(JU_NUM, zh[1])) {
    return `${WUXING[zh[0]]} ${JU_NUM[zh[1]]} Cục`;
  }
  return null;
}

export function viWuxingJu(zh: string): string {
  return wuxingJuOrNull(zh) ?? viHan(zh);
}

// ---------------------------------------------------------------- Giờ
export function viShichen(branchIdx: number): string {
  return viBranch(branchIdx);
}

export function viShichenRange(branchIdx: number): string {
  const i = ((branchIdx % 12) + 12) % 12;
  const start = (23 + i * 2) % 24;
  const end = (start + 2) % 24;
  const f = (h: number) => `${String(h).padStart(2, '0')}:00`;
  return `${f(start)}–${f(end)}`;
}

// ---------------------------------------------------------------- Thuật ngữ chung
const GLOSSARY = table(`
命主:Mệnh_Chủ 身主:Thân_Chủ 大限:Đại_Hạn 小限:Tiểu_Hạn 流年:Lưu_Niên 流月:Lưu_Nguyệt 流日:Lưu_Nhật 流时:Lưu_Thời
本命:Bản_Mệnh 三方四正:Tam_Phương_Tứ_Chính 三方会照:Tam_Phương_Hội_Chiếu 会照:Hội_Chiếu 空宫:Vô_Chính_Diệu
阳男:Dương_Nam 阴男:Âm_Nam 阳女:Dương_Nữ 阴女:Âm_Nữ 五行局:Ngũ_Hành_Cục 四化:Tứ_Hóa 格局:Cách_Cục
主星:Chính_Tinh 辅星:Phụ_Tinh 吉星:Cát_Tinh 凶星:Hung_Tinh 煞星:Sát_Tinh 中性:Trung_Tính
中性偏吉:Trung_Tính_Thiên_Cát 凶中带吉:Hung_Trung_Đới_Cát 宫干:Cung_Can
男:Nam 女:Nữ 阳:Dương 阴:Âm 排盘日:Ngày_Lập_Lá_Số 命盘:Mệnh_Bàn
子时:Giờ_Tý 丑时:Giờ_Sửu 寅时:Giờ_Dần 卯时:Giờ_Mão 辰时:Giờ_Thìn 巳时:Giờ_Tỵ 午时:Giờ_Ngọ
未时:Giờ_Mùi 申时:Giờ_Thân 酉时:Giờ_Dậu 戌时:Giờ_Tuất 亥时:Giờ_Hợi 晚子时:Tý_Muộn 闰月:Nhuận_Nguyệt
中州派:Trung_Châu_Phái 倪师派:Nghê_Sư_Phái 占验派:Chiêm_Nghiệm_Phái
长生十二神:Trường_Sinh_Thập_Nhị_Thần 博士十二神:Bác_Sĩ_Thập_Nhị_Thần
将前十二神:Tướng_Tiền_Thập_Nhị_Thần 岁前十二神:Tuế_Tiền_Thập_Nhị_Thần
君臣庆会:Quân_Thần_Khánh_Hội 紫府同宫:Tử_Phủ_Đồng_Cung 府相朝垣:Phủ_Tướng_Triều_Viên
阳梁昌禄:Dương_Lương_Xương_Lộc 武贪格:Vũ_Tham_Cách 杀破狼:Sát_Phá_Lang 机月同梁:Cơ_Nguyệt_Đồng_Lương
廉贞天相格:Liêm_Trinh_Thiên_Tướng_Cách 武曲七杀:Vũ_Khúc_Thất_Sát 天同天梁格:Thiên_Đồng_Thiên_Lương_Cách
日月同宫:Nhật_Nguyệt_Đồng_Cung 日月夹命:Nhật_Nguyệt_Giáp_Mệnh 巨日同宫:Cự_Nhật_Đồng_Cung
石中隐玉:Thạch_Trung_Ẩn_Ngọc 明珠出海:Minh_Châu_Xuất_Hải 紫微入命:Tử_Vi_Nhập_Mệnh
辅弼夹命:Phụ_Bật_Giáp_Mệnh 昌曲夹命:Xương_Khúc_Giáp_Mệnh 魁钺夹命:Khôi_Việt_Giáp_Mệnh
双禄朝垣:Song_Lộc_Triều_Viên 三奇加会:Tam_Kỳ_Gia_Hội 羊陀夹忌:Dương_Đà_Giáp_Kỵ 火铃夹命:Hỏa_Linh_Giáp_Mệnh
空劫夹命:Không_Kiếp_Giáp_Mệnh 廉杀羊:Liêm_Sát_Dương 巨火羊:Cự_Hỏa_Dương 铃昌陀武:Linh_Xương_Đà_Vũ
马头带箭:Mã_Đầu_Đới_Tiễn 化禄入财:Hóa_Lộc_Nhập_Tài 化权入官:Hóa_Quyền_Nhập_Quan
机月同梁三星会:Cơ_Nguyệt_Đồng_Lương_Tam_Tinh_Hội 辅弼同会:Phụ_Bật_Đồng_Hội 魁钺同会:Khôi_Việt_Đồng_Hội
科权双会:Khoa_Quyền_Song_Hội 火贪格:Hỏa_Tham_Cách 铃贪格:Linh_Tham_Cách 昌曲同会:Xương_Khúc_Đồng_Hội
昌曲会照:Xương_Khúc_Hội_Chiếu 魁钺加照:Khôi_Việt_Gia_Chiếu 禄存守命:Lộc_Tồn_Thủ_Mệnh 天马入命:Thiên_Mã_Nhập_Mệnh
`);

// ---------------------------------------------------------------- Phiên âm từng chữ
const HAN = table(`
甲:Giáp 乙:Ất 丙:Bính 丁:Đinh 戊:Mậu 己:Kỷ 庚:Canh 辛:Tân 壬:Nhâm 癸:Quý
子:Tý 丑:Sửu 寅:Dần 卯:Mão 辰:Thìn 巳:Tỵ 午:Ngọ 未:Mùi 申:Thân 酉:Dậu 戌:Tuất 亥:Hợi
一:Nhất 二:Nhị 三:Tam 四:Tứ 五:Ngũ 六:Lục 七:Thất 八:Bát 九:Cửu 十:Thập 万:Vạn 半:Bán
金:Kim 木:Mộc 水:Thủy 火:Hỏa 土:Thổ 局:Cục
上:Thượng 下:Hạ 不:Bất 丧:Tang 中:Trung 临:Lâm 为:Vi 主:Chủ 事:Sự 互:Hỗ 亡:Vong 交:Giao 享:Hưởng
亲:Thân 人:Nhân 仆:Bộc 仙:Tiên 令:Lệnh 伏:Phục 会:Hội 伤:Thương 佐:Tá 使:Sứ 依:Y 保:Bảo 倪:Nghê
偏:Thiên 元:Nguyên 兄:Huynh 光:Quang 克:Khắc 入:Nhập 兵:Binh 内:Nội 再:Tái 军:Quân 决:Quyết 冷:Lãnh
凤:Phượng 凶:Hung 出:Xuất 分:Phân 刑:Hình 刚:Cương 创:Sáng 利:Lợi 副:Phó 力:Lực 加:Gia 动:Động
助:Trợ 劫:Kiếp 化:Hóa 北:Bắc 医:Y 华:Hoa 单:Đơn 南:Nam 博:Bác 占:Chiêm 卫:Vệ 印:Ấn 厄:Ách 友:Hữu
双:Song 变:Biến 口:Khẩu 古:Cổ 台:Thai 右:Hữu 合:Hợp 吉:Cát 吊:Điếu 同:Đồng 名:Danh 君:Quân 命:Mệnh
和:Hòa 咸:Hàm 哭:Khốc 善:Thiện 喜:Hỷ 在:Tại 地:Địa 坐:Tọa 垣:Viên 士:Sĩ 外:Ngoại 多:Đa 大:Đại
天:Thiên 太:Thái 夫:Phu 夹:Giáp 奇:Kỳ 奏:Tấu 女:Nữ 妻:Thê 姚:Diêu 姻:Nhân 存:Tồn 孤:Cô 宅:Trạch
守:Thủ 安:An 官:Quan 定:Định 宝:Bảo 宫:Cung 寡:Quả 寿:Thọ 封:Phong 将:Tướng 尊:Tôn 小:Tiểu 岁:Tuế
左:Tả 巨:Cự 巫:Vu 常:Thường 干:Can 平:Bình 年:Niên 庆:Khánh 庇:Tí 庙:Miếu 府:Phủ 度:Độ 座:Tọa
廉:Liêm 弟:Đệ 弼:Bật 得:Đắc 德:Đức 忌:Kỵ 思:Tư 性:Tính 恩:Ân 息:Tức 慧:Tuệ 慨:Khái 慷:Khảng
成:Thành 截:Tiệt 才:Tài 持:Trì 指:Chỉ 擎:Kình 攀:Phan 支:Chi 文:Văn 断:Đoạn 方:Phương 无:Vô 日:Nhật
旧:Cựu 旬:Tuần 时:Thời 旺:Vượng 昌:Xương 明:Minh 星:Tinh 晚:Vãn 晦:Hối 智:Trí 曜:Diệu 曲:Khúc
月:Nguyệt 望:Vọng 朝:Triều 本:Bản 机:Cơ 杀:Sát 权:Quyền 来:Lai 林:Lâm 果:Quả 柔:Nhu 格:Cách 桃:Đào
梁:Lương 欲:Dục 正:Chính 武:Vũ 死:Tử 毅:Nghị 母:Mẫu 气:Khí 永:Vĩnh 池:Trì 流:Lưu 海:Hải 煞:Sát
照:Chiếu 父:Phụ 独:Độc 狼:Lang 玉:Ngọc 珠:Châu 理:Lý 生:Sinh 田:Điền 男:Nam 疾:Tật 病:Bệnh 白:Bạch
相:Tướng 石:Thạch 破:Phá 碎:Toái 神:Thần 禄:Lộc 福:Phúc 科:Khoa 移:Di 稳:Ổn 空:Không 立:Lập 符:Phù
箭:Tiễn 索:Sách 紫:Tử 红:Hồng 细:Tế 绝:Tuyệt 缘:Duyên 网:Võng 罗:La 羊:Dương 美:Mỹ 耗:Hao 职:Chức
腻:Nị 臣:Thần 自:Tự 至:Chí 艺:Nghệ 花:Hoa 荫:Ấm 药:Dược 蜚:Phỉ 衰:Suy 衾:Khâm 西:Tây 见:Kiến
解:Giải 论:Luận 诰:Cáo 谋:Mưu 贞:Trinh 财:Tài 贪:Tham 贯:Quán 贵:Quý 身:Thân 辅:Phụ 辈:Bối 辩:Biện
迁:Thiên 逆:Nghịch 通:Thông 遇:Ngộ 里:Lý 重:Trọng 钺:Việt 铃:Linh 长:Trường 门:Môn 闰:Nhuận 闲:Nhàn
阁:Các 阳:Dương 阴:Âm 陀:Đà 限:Hạn 陷:Hãm 隐:Ẩn 随:Tùy 雄:Hùng 青:Thanh 非:Phi 鞍:An 顺:Thuận 领:Lĩnh
飞:Phi 马:Mã 驿:Dịch 魁:Khôi 鸳:Uyên 鸾:Loan 龙:Long 沐:Mộc 浴:Dục 冠:Quán 带:Đới 帝:Đế 养:Dưỡng
胎:Thai 墓:Mộ 奴:Nô 厨:Trù 艳:Diễm 罚:Phạt 虎:Hổ 阵:Trận 帅:Soái 勋:Huân 拱:Củng 参:Tham 乡:Hương
乐:Lạc 业:Nghiệp 世:Thế 势:Thế 俊:Tuấn 倒:Đảo 兴:Hưng 冲:Xung 凌:Lăng 刃:Nhận 勇:Dũng 区:Khu
厉:Lệ 句:Cú 吏:Lại 周:Chu 响:Hưởng 圆:Viên 圣:Thánh 埋:Mai 夜:Dạ 失:Thất 妒:Đố 孕:Dựng 学:Học
宗:Tông 密:Mật 尚:Thượng 居:Cư 属:Thuộc 崇:Sùng 巧:Xảo 师:Sư 幻:Huyễn 庸:Dung 引:Dẫn 强:Cường
彩:Thải 微:Vi 志:Chí 忠:Trung 怒:Nộ 惊:Kinh 惠:Huệ 想:Tưởng 感:Cảm 扬:Dương 技:Kỹ 掌:Chưởng 敏:Mẫn
昭:Chiêu 暗:Ám 暴:Bạo 朗:Lãng 构:Cấu 极:Cực 次:Thứ 殊:Thù 比:Tỷ 治:Trị 泉:Tuyền 波:Ba 洪:Hồng
浊:Trọc 济:Tế 淫:Dâm 清:Thanh 渡:Độ 游:Du 满:Mãn 滞:Trệ 炎:Viêm 烈:Liệt 爱:Ái 牢:Lao 率:Suất
现:Hiện 益:Ích 盖:Cái 盛:Thịnh 目:Mục 直:Trực 眠:Miên 祖:Tổ 祥:Tường 禁:Cấm 秀:Tú 积:Tích 称:Xưng
究:Cứu 穿:Xuyên 端:Đoan 笃:Đốc 管:Quản 精:Tinh 约:Ước 纯:Thuần 终:Chung 经:Kinh 绍:Thiệu 结:Kết
统:Thống 继:Kế 缺:Khuyết 聪:Thông 能:Năng 脱:Thoát 舞:Vũ 色:Sắc 苦:Khổ 荣:Vinh 虚:Hư 蚀:Thực 蛇:Xà
衡:Hành 补:Bổ 要:Yếu 视:Thị 触:Xúc 讼:Tụng 设:Thiết 许:Hứa 评:Bình 识:Thức 诚:Thành 语:Ngữ 误:Ngộ
豪:Hào 贤:Hiền 贫:Bần 资:Tư 赏:Thưởng 赋:Phú 超:Siêu 足:Túc 路:Lộ 躁:Táo 轮:Luân 辉:Huy 达:Đạt
过:Quá 运:Vận 远:Viễn 连:Liên 进:Tiến 邪:Tà 野:Dã 量:Lượng 针:Châm 铁:Thiết 锋:Phong 锐:Nhuệ 闭:Bế
防:Phòng 际:Tế 障:Chướng 雅:Nhã 雷:Lôi 震:Chấn 静:Tĩnh 面:Diện 顾:Cố 风:Phong 骄:Kiêu 高:Cao 鬼:Quỷ
魂:Hồn 鹤:Hạc 鼎:Đỉnh 齐:Tề 刻:Khắc 剑:Kiếm 劳:Lao 勤:Cần 厚:Hậu 反:Phản 取:Thủ 受:Thụ 司:Tư
吐:Thổ 唯:Duy 园:Viên 图:Đồ 固:Cố 坚:Kiên 城:Thành 增:Tăng 夺:Đoạt 奋:Phấn 威:Uy 婚:Hôn 孙:Tôn
孝:Hiếu 宁:Ninh 宜:Nghi 宾:Tân 容:Dung 富:Phú 寒:Hàn 对:Đối 导:Đạo 展:Triển 工:Công 差:Sai 市:Thị
布:Bố 并:Tịnh 广:Quảng 库:Khố 底:Để 建:Kiến 开:Khai 张:Trương 形:Hình 彻:Triệt 往:Vãng 心:Tâm
必:Tất 快:Khoái 患:Hoạn 情:Tình 愁:Sầu 愿:Nguyện 战:Chiến 房:Phòng 所:Sở 手:Thủ 承:Thừa 抚:Phủ
护:Hộ 择:Trạch 振:Chấn
`);

/** Phiên âm Hán-Việt từng chữ; ký tự không có trong bảng giữ nguyên. */
export function viHan(zh: string): string {
  const out: string[] = [];
  for (const ch of Array.from(zh)) {
    out.push(has(HAN, ch) ? HAN[ch] : ch);
  }
  // Âm tiết cách nhau bằng khoảng trắng; dấu câu/ký tự lạ dính liền với phần trước.
  return out
    .join(' ')
    .replace(/\s+([^\p{L}\p{N}\s])/gu, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Dịch thuật ngữ bất kỳ: sao -> cung -> can chi -> tứ hóa -> cục -> thuật ngữ chung -> độ sáng -> phiên âm. */
export function viTerm(zh: string): string {
  const s = lookupStar(zh);
  if (s !== undefined) return s;
  const p = lookupPalace(zh);
  if (p !== undefined) return p;
  const sb = stemBranchOrNull(zh);
  if (sb !== null) return sb;
  const sh = sihuaOrNull(zh);
  if (sh !== null) return sh;
  const ju = wuxingJuOrNull(zh);
  if (ju !== null) return ju;
  if (has(GLOSSARY, zh)) return GLOSSARY[zh];
  if (has(BRIGHTNESS, zh)) return BRIGHTNESS[zh];
  return viHan(zh);
}

/** Số mục mỗi bảng (dùng cho báo cáo/kiểm tra). */
export const VN_TABLE_SIZES = {
  mainStars: Object.keys(MAIN_STARS).length,
  auxStars: Object.keys(AUX_STARS).length,
  boshi12: Object.keys(BOSHI12).length,
  changsheng12: Object.keys(CHANGSHENG12).length,
  jiangqian12: Object.keys(JIANGQIAN12).length,
  suiqian12: Object.keys(SUIQIAN12).length,
  palaces: Object.keys(PALACES).length,
  glossary: Object.keys(GLOSSARY).length,
  han: Object.keys(HAN).length,
} as const;

export const VN_MAIN_STAR_KEYS: readonly string[] = Object.keys(MAIN_STARS);
