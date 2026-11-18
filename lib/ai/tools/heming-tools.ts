/**
 * Tool cho AI hợp bàn (hai lá số). Dùng lại nguyên 5 tool lá số đơn (ziwei-tools) cho từng người qua tham số
 * `nguoi` = tên người (enum hai tên), thêm một tool đối chiếu chéo hai lá số. Mọi số liệu tính bằng engine từ birthInfo
 * (không tin dữ liệu lá số client gửi lên), cùng phái iztro với lá số đang hiển thị.
 */
import { generateChart } from '@/lib/ziwei/algorithm';
import type { BirthInfo, Palace, ZiweiChart } from '@/lib/ziwei/types';
import { viBranch, viPalace, viSiHua, viStar, viStem } from '@/lib/vn/terms';
import { buildChartTools, type ChartTool } from './ziwei-tools';
import { hemingNames } from '../heming-names';

type Person = 0 | 1;

/** `nguoi` → người thứ mấy: so tên (không phân biệt hoa thường); "A"/"B" vẫn hiểu nhưng không bao giờ hiện ra. */
function personArg(value: unknown, names: readonly [string, string]): Person | undefined {
  const v = typeof value === 'string' ? value.trim().toLocaleLowerCase('vi') : '';
  if (!v) return undefined;
  const i = names.findIndex(n => n.toLocaleLowerCase('vi') === v);
  if (i === 0 || i === 1) return i;
  if (v === 'a') return 0;
  if (v === 'b') return 1;
  return undefined;
}

const personError = (names: readonly [string, string]) =>
  ({ lỗi: `Thiếu hoặc sai tham số nguoi: truyền đúng tên một trong hai người, ${JSON.stringify(names[0])} hoặc ${JSON.stringify(names[1])}.` });

/** Quan hệ hai địa chi theo lục xung, tam hợp, lục hợp (Tý–Sửu, Dần–Hợi, Mão–Tuất, Thìn–Dậu, Tỵ–Thân, Ngọ–Mùi). */
export function branchRelation(a: number, b: number): 'trùng' | 'xung' | 'tam hợp' | 'lục hợp' | 'không đặc biệt' {
  const d = ((b - a) % 12 + 12) % 12;
  if (d === 0) return 'trùng';
  if (d === 6) return 'xung';
  if (d === 4 || d === 8) return 'tam hợp';
  if ((a + b) % 12 === 1) return 'lục hợp';
  return 'không đặc biệt';
}

/** Bọc một tool lá số đơn thành tool hai người: thêm tham số bắt buộc `nguoi` (tên), chuyển phần còn lại cho tool của người đó. */
function forBoth(tools: readonly [ChartTool, ChartTool], names: readonly [string, string]): ChartTool {
  const [a] = tools;
  const params = a.parameters as { properties?: Record<string, unknown>; required?: string[] };
  const who = `${JSON.stringify(names[0])} hoặc ${JSON.stringify(names[1])}`;
  return {
    name: a.name,
    description: `${a.description} Hợp bàn: truyền nguoi = tên người (${who}) để chọn lá số; cần cả hai người thì gọi hai lần cùng lúc.`,
    parameters: {
      ...params,
      type: 'object',
      properties: {
        nguoi: { type: 'string', enum: [...names], description: `Lá số của ai: đúng tên ${who}.` },
        ...params.properties,
      },
      required: ['nguoi', ...(params.required ?? [])],
    },
    status(args) {
      const p = personArg(args.nguoi, names);
      const { nguoi: _, ...rest } = args;
      return p === undefined ? a.status(rest) : `${tools[p].status(rest)} của ${names[p]}`;
    },
    run(args) {
      const p = personArg(args.nguoi, names);
      if (p === undefined) return personError(names);
      const { nguoi: _, ...rest } = args;
      return tools[p].run(rest);
    },
  };
}

export function buildHemingTools(birthA: BirthInfo, birthB: BirthInfo): ChartTool[] {
  const names = hemingNames(birthA?.name, birthB?.name);
  const [nA, nB] = names;
  const toolsA = buildChartTools(birthA);
  const toolsB = buildChartTools(birthB);
  const wrapped = toolsA.map(t => forBoth([t, toolsB.find(x => x.name === t.name)!], names));

  let charts: { A: ZiweiChart; B: ZiweiChart } | undefined;
  const chartsOf = () => (charts ??= { A: generateChart(birthA), B: generateChart(birthB) });

  const doiChieu: ChartTool = {
    name: 'doi_chieu_hai_la_so',
    description:
      `Đối chiếu chéo lá số gốc của ${JSON.stringify(nA)} và ${JSON.stringify(nB)} (đã tính sẵn, chính xác theo địa chi)`
      + ': sinh niên tứ hóa của mỗi người rơi vào cung nào trên lá số người kia; '
      + 'cung Mệnh, Thân, Phu Thê của người này đặt lên lá số người kia thì trùng cung nào; quan hệ địa chi (trùng, xung, tam hợp, lục hợp) giữa Mệnh, Phu Thê, '
      + 'năm sinh của hai người; can chi năm sinh. Dùng cho câu hỏi hợp hay khắc, ai ảnh hưởng ai, hai người bổ trợ hay va chạm ở mặt nào.',
    parameters: { type: 'object', properties: {} },
    status: () => 'Đang đối chiếu hai lá số',
    run() {
      const { A, B } = chartsOf();
      const at = (c: ZiweiChart, branch: number): Palace | undefined => c.palaces.find(p => p.branch === branch);
      const named = (c: ZiweiChart, zh: string) => c.palaces.find(p => p.name === zh);
      const label = (p: Palace | undefined) => p ? `${viPalace(p.name)} (${viBranch(p.branch)})` : 'không xác định';

      /** Sinh niên tứ hóa của `from` (sao gắn hóa trên lá số gốc), tìm sao đó trên lá số `to`. */
      const crossHua = (from: ZiweiChart, to: ZiweiChart, fromName: string, toName: string) => from.palaces.flatMap(p => p.stars.filter(s => s.siHua).map(s => {
        const inTo = to.palaces.find(q => q.stars.some(x => x.name === s.name));
        return {
          sao: viStar(s.name),
          hóa: viSiHua(s.siHua!),
          [`cung_của_${fromName}`]: label(p),
          [`cung_của_${toName}`]: inTo ? label(inTo) : 'sao không có trên lá số này',
        };
      }));

      /** Đặt cung Mệnh, Thân, Phu Thê của `from` lên lá số `to` theo địa chi. */
      const overlay = (from: ZiweiChart, to: ZiweiChart, toName: string) => ([
        ['Mệnh', from.mingGongBranch],
        ['Thân', from.shenGongBranch],
        ['Phu Thê', named(from, '夫妻')?.branch],
      ] as const).flatMap(([cung, branch]) => branch === undefined ? [] : [{
        cung,
        địa_chi: viBranch(branch),
        [`rơi_vào_cung_của_${toName}`]: viPalace(at(to, branch)?.name ?? ''),
      }]);

      const fuA = named(A, '夫妻')?.branch;
      const fuB = named(B, '夫妻')?.branch;
      const pairs: Array<[string, number | undefined, number | undefined]> = [
        [`Mệnh ${nA} – Mệnh ${nB}`, A.mingGongBranch, B.mingGongBranch],
        [`Phu Thê ${nA} – Mệnh ${nB}`, fuA, B.mingGongBranch],
        [`Mệnh ${nA} – Phu Thê ${nB}`, A.mingGongBranch, fuB],
        [`Thân ${nA} – Thân ${nB}`, A.shenGongBranch, B.shenGongBranch],
        [`Năm sinh ${nA} – Năm sinh ${nB}`, A.lunarInfo.yearBranch, B.lunarInfo.yearBranch],
      ];
      const yearOf = (c: ZiweiChart) => `${viStem(c.lunarInfo.yearStem)} ${viBranch(c.lunarInfo.yearBranch)} (năm âm lịch ${c.lunarInfo.lunarYear})`;

      return {
        năm_sinh: { [nA]: yearOf(A), [nB]: yearOf(B) },
        tứ_hóa_năm_sinh_chéo: [
          { của: nA, vào_lá_số: nB, các_sao: crossHua(A, B, nA, nB) },
          { của: nB, vào_lá_số: nA, các_sao: crossHua(B, A, nB, nA) },
        ],
        đặt_cung_lên_lá_số_người_kia: [
          { từ: nA, lên: nB, các_cung: overlay(A, B, nB) },
          { từ: nB, lên: nA, các_cung: overlay(B, A, nA) },
        ],
        quan_hệ_địa_chi: pairs.flatMap(([cặp, x, y]) => x === undefined || y === undefined ? [] : [{
          cặp, địa_chi: `${viBranch(x)} – ${viBranch(y)}`, quan_hệ: branchRelation(x, y),
        }]),
        cách_đọc: 'Sinh niên tứ hóa của người này rơi vào cung nào của người kia cho thấy người này mang tới cho người kia điều gì ở mặt đó: Lộc là lợi ích, duyên; Quyền là chi phối, thúc đẩy; Khoa là nâng đỡ, danh tiếng; Kỵ là ràng buộc, nợ, vướng mắc. '
          + 'Cung Mệnh/Phu Thê của người này trùng cung tốt của người kia là dễ hòa hợp. Tam hợp, lục hợp là hợp; xung là va chạm nhưng cũng là hút nhau, phải luận cùng sao và tứ hóa.',
      };
    },
  };

  return [...wrapped, doiChieu];
}
