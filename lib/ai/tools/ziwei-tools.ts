/**
 * Tool tra cứu vận hạn cho AI luận giải. Mọi số liệu tính bằng engine (iztro, cùng phái với lá số đang hiển thị);
 * AI chỉ diễn giải kết quả. Không phụ thuộc nhà cung cấp AI: mỗi tool là định nghĩa JSON Schema + hàm thuần.
 * Mọi năm/tháng âm lịch trong kết quả đều kèm khoảng ngày dương lịch (âm lịch Việt Nam, UTC+7).
 */
import { createHoroscopeReader, generateChart } from '@/lib/ziwei/algorithm';
import { BRANCHES, STEMS } from '@/lib/ziwei/constants';
import type { BirthInfo, Palace, ZiweiChart } from '@/lib/ziwei/types';
import { currentVnLunarYear, lunarMonthsVN, type LunarMonthRangeVN } from '@/lib/vn/lunar-vn';
import { detectSelfSihua, getSiHuaByStem } from '@/lib/ziwei/sihua';
import { viBranch, viBrightness, viPalace, viSiHua, viStar, viStem, viStemBranch } from '@/lib/vn/terms';

export interface ChartTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  /** Dòng trạng thái hiển thị cho người dùng khi tool chạy */
  status(args: Record<string, unknown>): string;
  run(args: Record<string, unknown>): unknown;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Layer = any; // một lớp vận hạn của iztro (decadal / age / yearly / monthly)

const HUA = ['Lộc', 'Quyền', 'Khoa', 'Kỵ'] as const;
const HUA_ZH = ['禄', '权', '科', '忌'] as const;

const PALACE_KEYS = {
  menh: '命宫', huynh_de: '兄弟', phu_the: '夫妻', tu_tuc: '子女', tai_bach: '财帛', tat_ach: '疾厄',
  thien_di: '迁移', no_boc: '仆役', quan_loc: '官禄', dien_trach: '田宅', phuc_duc: '福德', phu_mau: '父母',
} as const;
type PalaceKey = keyof typeof PALACE_KEYS;
const PALACE_KEY_HELP = 'menh, phu_the (tình duyên/hôn nhân), quan_loc (sự nghiệp), tai_bach (tiền bạc), tat_ach (sức khỏe), tu_tuc (con cái), dien_trach (nhà đất), phuc_duc, thien_di (đi xa, di chuyển), no_boc (bạn bè/đồng nghiệp), huynh_de, phu_mau';

/** Tên sao lưu iztro (流禄, 运羊, 月鸾, 年解…) → tiếng Việt */
const FLOW_BASE: Record<string, string> = {
  禄: '禄存', 羊: '擎羊', 陀: '陀罗', 马: '天马', 鸾: '红鸾', 喜: '天喜', 昌: '文昌', 曲: '文曲', 魁: '天魁', 钺: '天钺',
};
const FLOW_PREFIX: Record<string, string> = { 流: 'Lưu', 运: 'Đại hạn', 月: 'Lưu nguyệt', 日: 'Lưu nhật' };
function viFlowStar(name: string): string {
  if (name === '年解') return 'Niên Giải';
  const prefix = FLOW_PREFIX[name[0]];
  const base = FLOW_BASE[name.slice(1)];
  return prefix && base ? `${prefix} ${viStar(base)}` : viStar(name);
}
/** Sao lưu mang tính cát / hung khi chiếu cung chủ đề (đếm tín hiệu, không phải phán quyết) */
const FLOW_GOOD = new Set(['禄', '鸾', '喜', '昌', '曲', '魁', '钺']);
const FLOW_BAD = new Set(['羊', '陀']);

/** iztro xếp 12 cung bắt đầu từ Dần: chỉ số i ↔ địa chi (i + 2) mod 12 */
const branchOfIndex = (i: number) => (i + 2) % 12;
const indexOfBranch = (b: number) => (b + 10) % 12;

const fmt = (d: { day: number; month: number; year: number }) =>
  `${String(d.day).padStart(2, '0')}/${String(d.month).padStart(2, '0')}/${d.year}`;
const monthLabel = (m: LunarMonthRangeVN) => `${m.leap ? 'nhuận ' : ''}${m.month}`;
const solarRange = (m: LunarMonthRangeVN) => `${fmt(m.start)} – ${fmt(m.end)}`;

function yearArg(value: unknown): number {
  const y = Number(value);
  return Number.isInteger(y) && y >= 1900 && y <= 2100 ? y : currentVnLunarYear();
}
function palaceKeyArg(value: unknown): PalaceKey {
  return typeof value === 'string' && value in PALACE_KEYS ? value as PalaceKey : 'menh';
}

export function buildChartTools(birthInfo: BirthInfo): ChartTool[] {
  // Mỗi request dựng lá số/lịch/vận hạn một lần, các tool dùng chung.
  let chartCache: ZiweiChart | undefined;
  const chart = () => (chartCache ??= generateChart(birthInfo));
  const monthsCache = new Map<number, LunarMonthRangeVN[]>();
  const months = (year: number) => {
    let list = monthsCache.get(year);
    if (!list) { list = lunarMonthsVN(year); monthsCache.set(year, list); }
    return list;
  };
  const horoCache = new Map<string, Layer>();
  let readHoroscope: ReturnType<typeof createHoroscopeReader> | undefined;
  /** Vận hạn tại giữa một tháng âm (mặc định tháng 6, đại diện cho cả năm) */
  const horoscope = (year: number, month = 6, leap = false) => {
    const key = `${year}-${month}-${leap}`;
    let h = horoCache.get(key);
    if (!h) {
      const list = months(year);
      const m = list.find(x => x.month === month && x.leap === leap) ?? list.find(x => x.month === month) ?? list[5];
      const mid = new Date(Date.UTC(m.start.year, m.start.month - 1, m.start.day + 14));
      h = (readHoroscope ??= createHoroscopeReader(birthInfo))({ year: mid.getUTCFullYear(), month: mid.getUTCMonth() + 1, day: mid.getUTCDate() });
      horoCache.set(key, h);
    }
    return h;
  };
  const yearSolar = (year: number) => {
    const list = months(year);
    return `${fmt(list[0].start)} – ${fmt(list[list.length - 1].end)}`;
  };

  const palaceAt = (branch: number): Palace | undefined => chart().palaces.find(p => p.branch === branch);
  const majorStars = (branch: number) => {
    const majors = palaceAt(branch)?.stars.filter(s => s.type === 'major') ?? [];
    return majors.length ? majors.map(s => viStar(s.name)) : ['(vô chính diệu)'];
  };
  const starBranch = (zh: string) => chart().palaces.find(p => p.stars.some(s => s.name === zh))?.branch;
  const layerPalace = (layer: Layer, branch: number) => viPalace((layer.palaceNames as string[])[indexOfBranch(branch)]);
  const layerTopicBranch = (layer: Layer, key: PalaceKey) => branchOfIndex((layer.palaceNames as string[]).indexOf(PALACE_KEYS[key]));
  const natalTopicBranch = (key: PalaceKey) => chart().palaces.find(p => p.name === PALACE_KEYS[key])?.branch ?? chart().mingGongBranch;
  const describe = (branch: number, extra?: Record<string, unknown>) => ({
    địa_chi: viBranch(branch),
    cung_gốc: viPalace(palaceAt(branch)?.name ?? ''),
    ...(branch === chart().shenGongBranch ? { có_cung_an_thân: true } : {}),
    chính_tinh: majorStars(branch),
    ...extra,
  });
  const siHua = (layer: Layer, label?: string) => (layer.mutagen as string[]).map((star, i) => {
    const b = starBranch(star);
    return {
      hóa: HUA[i],
      sao: viStar(star),
      nằm_ở: b === undefined ? 'không có trong lá số' : {
        địa_chi: viBranch(b), cung_gốc: viPalace(palaceAt(b)?.name ?? ''), ...(label ? { [label]: layerPalace(layer, b) } : {}),
      },
    };
  });
  const flowStars = (layer: Layer, label?: string) => ((layer.stars ?? []) as { name: string }[][]).flatMap((list, i) =>
    list.map(s => ({
      sao: viFlowStar(s.name),
      địa_chi: viBranch(branchOfIndex(i)),
      cung_gốc: viPalace(palaceAt(branchOfIndex(i))?.name ?? ''),
      ...(label ? { [label]: layerPalace(layer, branchOfIndex(i)) } : {}),
    })));

  /**
   * Tín hiệu một lớp vận (tứ hóa + sao lưu) tác động lên cung `focus`: vào bản cung, xung chiếu, tam hợp.
   * Chỉ là đếm dữ kiện có thật để AI so sánh giữa các tháng/năm, không phải kết luận.
   */
  const signals = (layer: Layer, layerName: string, focus: number) => {
    const where = (b: number) => b === focus ? 'vào bản cung' : b === (focus + 6) % 12 ? 'xung chiếu' : (b === (focus + 4) % 12 || b === (focus + 8) % 12) ? 'tam hợp' : null;
    const facts: string[] = [];
    let good = 0;
    let bad = 0;
    (layer.mutagen as string[]).forEach((star, i) => {
      const b = starBranch(star);
      const w = b === undefined ? null : where(b);
      if (!w) return;
      facts.push(`${viStar(star)} hóa ${HUA[i]} (${layerName}) ${w}`);
      const weight = w === 'vào bản cung' ? 2 : 1;
      if (i === 3) bad += weight; else good += weight;
    });
    ((layer.stars ?? []) as { name: string }[][]).forEach((list, i) => {
      const w = where(branchOfIndex(i));
      if (!w || w === 'tam hợp') return;
      for (const s of list) {
        const base = s.name.slice(1);
        if (!FLOW_GOOD.has(base) && !FLOW_BAD.has(base) && base !== '马') continue;
        facts.push(`${viFlowStar(s.name)} ${w}`);
        const weight = w === 'vào bản cung' ? 2 : 1;
        if (FLOW_GOOD.has(base)) good += weight;
        if (FLOW_BAD.has(base)) bad += weight;
      }
    });
    return { facts, good, bad };
  };

  /** Sao nhận hóa ở từ hai tầng trở lên (gốc / đại hạn / lưu niên / lưu nguyệt): điểm nóng của vận. */
  const stackedHua = (layers: Array<[string, string[]]>) => {
    const natal: Array<[string, string]> = chart().palaces.flatMap(p => p.stars.filter(st => st.siHua).map(st => [st.name, st.siHua!] as [string, string]));
    const byStar = new Map<string, string[]>();
    const add = (star: string, label: string) => { if (star) byStar.set(star, [...(byStar.get(star) ?? []), label]); };
    natal.forEach(([star, hua]) => add(star, `gốc ${viSiHua(hua)}`));
    layers.forEach(([name, mutagen]) => mutagen.forEach((star, i) => add(star, `${name} ${HUA[i]}`)));
    return [...byStar].filter(([, tags]) => tags.length >= 2).map(([star, tags]) => {
      const b = starBranch(star);
      const kyCount = tags.filter(t => t.endsWith('Kỵ')).length;
      const hasLoc = tags.some(t => t.endsWith('Lộc'));
      return {
        sao: viStar(star),
        cung_gốc: b === undefined ? 'không có trong lá số' : `${viPalace(palaceAt(b)?.name ?? '')} (${viBranch(b)})`,
        các_tầng: tags,
        kiểu: kyCount >= 2 ? 'chồng Kỵ (điểm xấu mạnh)' : hasLoc && kyCount ? 'Lộc Kỵ cùng sao (được rồi mất, lẫn lộn)' : kyCount ? 'có Kỵ chen vào' : 'cát hóa chồng (điểm tốt mạnh)',
      };
    });
  };

  const xemVanHan: ChartTool = {
    name: 'xem_van_han',
    description:
      'Tra vận hạn của lá số trong một năm âm lịch: đại hạn đang chạy, tiểu hạn, lưu niên (cung Mệnh lưu niên, 12 cung lưu niên, '
      + 'tứ hóa lưu niên rơi vào cung nào, các sao lưu Lộc Tồn/Kình Dương/Đà La/Thiên Mã/Hồng Loan/Thiên Hỷ/Văn Xương/Văn Khúc), vòng Thái Tuế, '
      + 'kèm khoảng ngày dương lịch của năm. Truyền `thang` để xem chi tiết lưu nguyệt một tháng. BẮT BUỘC gọi trước khi nói về bất kỳ năm nào.',
    parameters: {
      type: 'object',
      properties: {
        nam: { type: 'integer', description: 'Năm âm lịch, ví dụ 2026. "Năm nay" = năm âm lịch hiện tại.' },
        thang: { type: 'integer', minimum: 1, maximum: 12, description: 'Tháng âm lịch (tùy chọn) để xem chi tiết lưu nguyệt.' },
      },
      required: ['nam'],
    },
    status: args => `Đang xem vận hạn năm ${yearArg(args.nam)}${args.thang ? `, tháng ${args.thang}` : ''}`,
    run(args) {
      const year = yearArg(args.nam);
      const thang = Number(args.thang);
      const month = Number.isInteger(thang) && thang >= 1 && thang <= 12 ? thang : undefined;
      const h = horoscope(year, month ?? 6);
      const yearlyBranch = branchOfIndex(h.yearly.index);
      const result: Record<string, unknown> = {
        năm_âm_lịch: year,
        dương_lịch: yearSolar(year),
        can_chi_năm: viStemBranch(`${h.yearly.heavenlyStem}${h.yearly.earthlyBranch}`),
        tuổi_âm: h.age.nominalAge,
        đại_hạn: {
          mệnh_đại_hạn: describe(branchOfIndex(h.decadal.index)),
          can_cung: viStemBranch(`${h.decadal.heavenlyStem}${h.decadal.earthlyBranch}`),
          tứ_hóa_đại_hạn: siHua(h.decadal, 'cung_đại_hạn'),
          sao_lưu_đại_hạn: flowStars(h.decadal, 'cung_đại_hạn'),
        },
        tiểu_hạn: describe(branchOfIndex(h.age.index), { tứ_hóa_theo_can_tiểu_hạn: siHua(h.age) }),
        lưu_niên: {
          mệnh_lưu_niên: describe(yearlyBranch),
          mười_hai_cung_lưu_niên: Array.from({ length: 12 }, (_, k) => {
            const b = (yearlyBranch + 12 - k) % 12; // nghịch từ Mệnh: Mệnh, Huynh Đệ, Phu Thê…
            return { cung_lưu_niên: layerPalace(h.yearly, b), ...describe(b), cung_đại_hạn: layerPalace(h.decadal, b) };
          }),
          tứ_hóa_lưu_niên: siHua(h.yearly, 'cung_lưu_niên'),
          sao_lưu: flowStars(h.yearly, 'cung_lưu_niên'),
          vòng_thái_tuế: (h.yearly.yearlyDecStar?.suiqian12 as string[] | undefined)?.map((name, i) => ({ thần: viStar(name), địa_chi: viBranch(branchOfIndex(i)) })),
        },
        hóa_chồng_tầng: stackedHua([['đại hạn', h.decadal.mutagen], ['lưu niên', h.yearly.mutagen], ...(month ? [['lưu nguyệt', h.monthly.mutagen] as [string, string[]]] : [])]),
        ghi_chú: 'Tính theo iztro (cùng phái với lá số). cung_gốc = cung nguyên cục tại địa chi đó; cung_lưu_niên/cung_đại_hạn = tên cung ở lớp vận tương ứng.',
      };
      if (month) {
        const m = months(year).find(x => x.month === month && !x.leap)!;
        result.lưu_nguyệt = {
          tháng_âm: month,
          dương_lịch: solarRange(m),
          can_chi_tháng: viStemBranch(`${h.monthly.heavenlyStem}${h.monthly.earthlyBranch}`),
          mệnh_lưu_nguyệt: describe(branchOfIndex(h.monthly.index), { cung_lưu_niên: layerPalace(h.yearly, branchOfIndex(h.monthly.index)) }),
          tứ_hóa_lưu_nguyệt: siHua(h.monthly, 'cung_lưu_niên'),
          sao_lưu_nguyệt: flowStars(h.monthly, 'cung_lưu_niên'),
        };
      }
      return result;
    },
  };

  const xemCung: ChartTool = {
    name: 'xem_cung',
    description:
      'Xem chi tiết một cung theo chủ đề ở lớp gốc, đại hạn hoặc lưu niên, kèm tam phương tứ chính (xung chiếu và hai cung tam hợp): '
      + 'toàn bộ sao, độ sáng, tứ hóa gốc, và tứ hóa/sao lưu của đại hạn, lưu niên rơi vào các cung đó.',
    parameters: {
      type: 'object',
      properties: {
        chu_de: { type: 'string', enum: Object.keys(PALACE_KEYS), description: `Cung cần xem: ${PALACE_KEY_HELP}.` },
        lop: { type: 'string', enum: ['goc', 'dai_han', 'luu_nien'], description: 'goc = lá số gốc; dai_han = cung đó theo đại hạn của năm `nam`; luu_nien = cung đó theo lưu niên năm `nam`.' },
        nam: { type: 'integer', description: 'Năm âm lịch (bắt buộc với dai_han/luu_nien).' },
      },
      required: ['chu_de', 'lop'],
    },
    status: args => {
      const label = viPalace(PALACE_KEYS[palaceKeyArg(args.chu_de)]);
      const layer = args.lop === 'luu_nien' ? ` lưu niên ${yearArg(args.nam)}` : args.lop === 'dai_han' ? ` đại hạn (năm ${yearArg(args.nam)})` : ' gốc';
      return `Đang xem cung ${label}${layer}`;
    },
    run(args) {
      const key = palaceKeyArg(args.chu_de);
      const layer = args.lop === 'dai_han' || args.lop === 'luu_nien' ? args.lop : 'goc';
      const year = yearArg(args.nam);
      const h = horoscope(year);
      const focus = layer === 'goc' ? natalTopicBranch(key) : layerTopicBranch(layer === 'dai_han' ? h.decadal : h.yearly, key);
      const roles = [['bản cung', focus], ['xung chiếu', (focus + 6) % 12], ['tam hợp', (focus + 4) % 12], ['tam hợp', (focus + 8) % 12]] as const;
      const decSiHua = siHua(h.decadal);
      const yearSiHua = siHua(h.yearly);
      const decFlow = flowStars(h.decadal);
      const yearFlow = flowStars(h.yearly);
      const hereHua = (list: typeof decSiHua, b: number) => list.filter(x => typeof x.nằm_ở === 'object' && x.nằm_ở.địa_chi === viBranch(b)).map(x => `${x.sao} hóa ${x.hóa}`);
      const hereFlow = (list: typeof decFlow, b: number) => list.filter(x => x.địa_chi === viBranch(b)).map(x => x.sao);
      return {
        cung: viPalace(PALACE_KEYS[key]),
        lớp: layer,
        ...(layer !== 'goc' ? { năm_âm_lịch: year, dương_lịch: yearSolar(year) } : {}),
        tam_phương_tứ_chính: roles.map(([vai_trò, b]) => {
          const p = palaceAt(b);
          return {
            vai_trò,
            địa_chi: viBranch(b),
            cung_gốc: viPalace(p?.name ?? ''),
            ...(b === chart().shenGongBranch ? { có_cung_an_thân: true } : {}),
            cung_đại_hạn: layer === 'goc' ? undefined : layerPalace(h.decadal, b),
            cung_lưu_niên: layer === 'luu_nien' ? layerPalace(h.yearly, b) : undefined,
            sao: p?.stars.map(s => ({
              tên: viStar(s.name),
              độ_sáng: s.brightnessRaw ? viBrightness(s.brightnessRaw) : undefined,
              tứ_hóa_gốc: s.siHua ? viSiHua(s.siHua) : undefined,
            })),
            tự_hóa: p ? detectSelfSihua(p).map(m => `${viStar(m.starName)} tự hóa ${viSiHua(m.siHua)}`) : [],
            ...(layer !== 'goc' ? { tứ_hóa_đại_hạn_tại_đây: hereHua(decSiHua, b), sao_lưu_đại_hạn_tại_đây: hereFlow(decFlow, b) } : {}),
            ...(layer === 'luu_nien' ? { tứ_hóa_lưu_niên_tại_đây: hereHua(yearSiHua, b), sao_lưu_niên_tại_đây: hereFlow(yearFlow, b) } : {}),
          };
        }),
      };
    },
  };

  const xemCacThang: ChartTool = {
    name: 'xem_cac_thang',
    description:
      'Xem nhanh TẤT CẢ các tháng âm lịch của một năm (kể cả tháng nhuận), mỗi tháng kèm khoảng ngày dương lịch, cung Mệnh lưu nguyệt, '
      + 'tứ hóa lưu nguyệt, và tín hiệu tứ hóa/sao lưu nguyệt tác động lên cung chủ đề của năm (vào bản cung / xung chiếu / tam hợp, đếm tốt/xấu). '
      + 'Dùng cho câu hỏi "tháng nào…", "khi nào trong năm…". Sau đó có thể gọi xem_van_han với `thang` để soi kỹ 1–2 tháng nổi bật.',
    parameters: {
      type: 'object',
      properties: {
        nam: { type: 'integer', description: 'Năm âm lịch.' },
        chu_de: { type: 'string', enum: Object.keys(PALACE_KEYS), description: `Cung chủ đề để chấm tín hiệu: ${PALACE_KEY_HELP}.` },
      },
      required: ['nam', 'chu_de'],
    },
    status: args => `Đang xem từng tháng năm ${yearArg(args.nam)} cho cung ${viPalace(PALACE_KEYS[palaceKeyArg(args.chu_de)])}`,
    run(args) {
      const year = yearArg(args.nam);
      const key = palaceKeyArg(args.chu_de);
      const base = horoscope(year);
      const focus = layerTopicBranch(base.yearly, key);
      return {
        năm_âm_lịch: year,
        dương_lịch: yearSolar(year),
        cung_chủ_đề_lưu_niên: { cung: viPalace(PALACE_KEYS[key]), ...describe(focus) },
        cách_đọc: 'tín_hiệu đếm tứ hóa/sao lưu nguyệt chiếu cung chủ đề lưu niên (bản cung tính 2, xung chiếu/tam hợp tính 1). Chỉ để so sánh các tháng, phải diễn giải cùng nền đại hạn và lưu niên.',
        các_tháng: months(year).map(m => {
          const h = horoscope(year, m.month, m.leap);
          const menh = branchOfIndex(h.monthly.index);
          const s = signals(h.monthly, 'lưu nguyệt', focus);
          return {
            tháng_âm: monthLabel(m),
            dương_lịch: solarRange(m),
            can_chi_tháng: viStemBranch(`${h.monthly.heavenlyStem}${h.monthly.earthlyBranch}`),
            mệnh_lưu_nguyệt: `${viBranch(menh)} (cung ${layerPalace(h.yearly, menh)} lưu niên)`,
            mệnh_lưu_nguyệt_trùng_cung_chủ_đề: menh === focus,
            tứ_hóa_lưu_nguyệt: (h.monthly.mutagen as string[]).map((star, i) => `${viStar(star)} hóa ${HUA[i]}`),
            tín_hiệu: s.facts,
            tốt: s.good,
            xấu: s.bad,
            ...(m.leap ? { ghi_chú: 'Tháng nhuận: iztro tính lưu nguyệt theo tháng thường cùng số.' } : {}),
          };
        }),
      };
    },
  };

  const quetCacNam: ChartTool = {
    name: 'quet_cac_nam',
    description:
      'Quét nhiều năm âm lịch liên tiếp (tối đa 15 năm) cho một chủ đề: mỗi năm kèm khoảng dương lịch, can chi, tuổi âm, đại hạn, '
      + 'cung chủ đề lưu niên, và tín hiệu tứ hóa/sao lưu của lưu niên và đại hạn tác động lên cung đó (đếm tốt/xấu). '
      + 'Dùng cho câu hỏi "bao giờ / năm nào… (cưới, có con, đổi việc, mua nhà…)". Sau đó gọi xem_van_han cho 1–2 năm nổi bật để soi kỹ.',
    parameters: {
      type: 'object',
      properties: {
        chu_de: { type: 'string', enum: Object.keys(PALACE_KEYS), description: `Cung chủ đề: ${PALACE_KEY_HELP}.` },
        tu_nam: { type: 'integer', description: 'Năm âm lịch bắt đầu (thường là năm nay).' },
        den_nam: { type: 'integer', description: 'Năm âm lịch kết thúc (tối đa tu_nam + 14).' },
      },
      required: ['chu_de', 'tu_nam', 'den_nam'],
    },
    status: args => `Đang quét các năm ${yearArg(args.tu_nam)}–${Math.min(yearArg(args.den_nam), yearArg(args.tu_nam) + 14)} cho cung ${viPalace(PALACE_KEYS[palaceKeyArg(args.chu_de)])}`,
    run(args) {
      const key = palaceKeyArg(args.chu_de);
      const from = yearArg(args.tu_nam);
      const to = Math.max(from, Math.min(yearArg(args.den_nam), from + 14));
      const natalFocus = natalTopicBranch(key);
      return {
        chủ_đề: viPalace(PALACE_KEYS[key]),
        cung_chủ_đề_gốc: describe(natalFocus),
        cách_đọc: 'tín_hiệu đếm tứ hóa/sao lưu của lưu niên và tứ hóa đại hạn chiếu cung chủ đề lưu niên (bản cung tính 2, xung chiếu/tam hợp tính 1). Chỉ để so sánh các năm.',
        các_năm: Array.from({ length: to - from + 1 }, (_, i) => {
          const year = from + i;
          const h = horoscope(year);
          const focus = layerTopicBranch(h.yearly, key);
          const y = signals(h.yearly, 'lưu niên', focus);
          const d = signals({ mutagen: h.decadal.mutagen, stars: [] }, 'đại hạn', focus);
          return {
            năm_âm_lịch: year,
            dương_lịch: yearSolar(year),
            can_chi: viStemBranch(`${h.yearly.heavenlyStem}${h.yearly.earthlyBranch}`),
            tuổi_âm: h.age.nominalAge,
            đại_hạn: `${viBranch(branchOfIndex(h.decadal.index))} (cung gốc ${viPalace(palaceAt(branchOfIndex(h.decadal.index))?.name ?? '')})`,
            cung_chủ_đề_lưu_niên: `${viBranch(focus)} (cung gốc ${viPalace(palaceAt(focus)?.name ?? '')}, chính tinh ${majorStars(focus).join(', ')})`,
            mệnh_lưu_niên_hoặc_tiểu_hạn_vào_cung_chủ_đề_gốc: branchOfIndex(h.yearly.index) === natalFocus || branchOfIndex(h.age.index) === natalFocus,
            tín_hiệu: [...y.facts, ...d.facts],
            tốt: y.good + d.good,
            xấu: y.bad + d.bad,
          };
        }),
      };
    },
  };

  const xemTuHoa: ChartTool = {
    name: 'xem_tu_hoa',
    description:
      'Phân tích tứ hóa của lá số gốc: sinh niên tứ hóa (theo can năm sinh) nằm ở cung nào; phi hóa theo can cung (cung X phi Lộc/Quyền/Khoa/Kỵ nhập cung nào); '
      + 'tự hóa; và các cung phi hóa nhập vào cung chủ đề (nguồn cơn của Kỵ/Lộc). Dùng cho câu hỏi về nguyên nhân, quan hệ giữa các mặt đời sống '
      + '(vợ chồng ảnh hưởng tiền bạc, công việc ảnh hưởng gia đình…), và khi người dùng bấm vào một đường tứ hóa.',
    parameters: {
      type: 'object',
      properties: {
        chu_de: { type: 'string', enum: Object.keys(PALACE_KEYS), description: `Cung trọng tâm (tùy chọn): ${PALACE_KEY_HELP}. Bỏ trống để xem phi hóa của cả 12 cung.` },
      },
    },
    status: args => args.chu_de ? `Đang xem tứ hóa và phi hóa của cung ${viPalace(PALACE_KEYS[palaceKeyArg(args.chu_de)])}` : 'Đang xem tứ hóa và phi hóa toàn lá số',
    run(args) {
      const c = chart();
      const label = (b: number | undefined) => b === undefined ? 'không có trong lá số' : `${viPalace(palaceAt(b)?.name ?? '')} (${viBranch(b)})`;
      const flyFrom = (p: Palace) => HUA_ZH.map((zh, i) => {
        const star = getSiHuaByStem(p.stem)[zh];
        const b = starBranch(star);
        const note = b === p.branch ? 'tự hóa' : b === (p.branch + 6) % 12 ? (i === 3 ? 'nhập cung đối, xung về bản cung' : 'nhập cung đối, chiếu về bản cung') : undefined;
        return `${HUA[i]} → ${viStar(star)} ở ${label(b)}${note ? `, ${note}` : ''}`;
      });
      const result: Record<string, unknown> = {
        sinh_niên_tứ_hóa: c.palaces.flatMap(p => p.stars.filter(st => st.siHua).map(st => `${viStar(st.name)} hóa ${viSiHua(st.siHua!)} ở ${label(p.branch)}`)),
        cách_đọc: 'Phi hóa: can của một cung làm sao ở cung khác hóa Lộc/Quyền/Khoa/Kỵ, nghĩa là việc của cung phát ra tác động lên cung nhận. Kỵ nhập cung nào thì cung đó chịu gánh nặng, nợ nần hay vướng bận từ cung phát.',
      };
      if (typeof args.chu_de === 'string' && args.chu_de in PALACE_KEYS) {
        const key = palaceKeyArg(args.chu_de);
        const focus = natalTopicBranch(key);
        const p = palaceAt(focus)!;
        result.cung_trọng_tâm = { cung: viPalace(p.name), địa_chi: viBranch(focus), can_cung: viStem(p.stem), chính_tinh: majorStars(focus) };
        result.phi_hóa_ra = flyFrom(p);
        result.tự_hóa = detectSelfSihua(p).map(m => `${viStar(m.starName)} tự hóa ${viSiHua(m.siHua)}`);
        result.phi_hóa_nhập = c.palaces.filter(q => q.branch !== focus).flatMap(q => HUA_ZH.flatMap((zh, i) => {
          const star = getSiHuaByStem(q.stem)[zh];
          return starBranch(star) === focus ? [`${viPalace(q.name)} (can ${viStem(q.stem)}) phi ${HUA[i]} nhập, qua sao ${viStar(star)}`] : [];
        }));
      } else {
        result.phi_hóa_12_cung = c.palaces.map(p => ({ cung: viPalace(p.name), can_cung: viStem(p.stem), phi_hóa: flyFrom(p) }));
      }
      return result;
    },
  };

  return [xemVanHan, xemCung, xemCacThang, quetCacNam, xemTuHoa];
}

export function currentLunarYearInfo() {
  const year = currentVnLunarYear();
  const stem = STEMS[((year - 4) % 10 + 10) % 10];
  const branch = BRANCHES[((year - 4) % 12 + 12) % 12];
  return { year, canChi: viStemBranch(`${stem}${branch}`) };
}
