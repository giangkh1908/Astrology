/**
 * Lá số người sinh sau trong cặp sinh đôi cùng canh giờ.
 *
 * Người sinh trước dùng lá số bình thường. Người sinh sau giữ nguyên vị trí mọi sao (cùng ngày giờ),
 * chỉ dời cung Mệnh sang một cung khác rồi đặt lại tên 12 cung và đại hạn theo cung Mệnh mới.
 * Hai cách phổ biến (đều từ thực hành, không có sách gốc thống nhất):
 *   - 'huynh_de': lấy cung Huynh Đệ làm Mệnh (cách phổ biến trong tài liệu Trung Quốc, "以兄弟宫为命宫").
 *   - 'thien_di': lấy cung Thiên Di làm Mệnh (cách được nhắc trên diễn đàn tử vi Việt Nam).
 * Ngũ hành cục, vị trí sao, tứ hóa năm sinh, cung an Thân, tiểu hạn và lưu niên giữ nguyên;
 * đại hạn vẫn bắt đầu từ số cục, cùng chiều thuận/nghịch, nhưng khởi từ cung Mệnh mới.
 */
export type TwinMethod = 'huynh_de' | 'thien_di';

export const TWIN_METHODS: readonly TwinMethod[] = ['huynh_de', 'thien_di'];

export const TWIN_METHOD_LABELS: Record<TwinMethod, string> = {
  huynh_de: 'Người sinh sau: lấy cung Huynh Đệ làm Mệnh',
  thien_di: 'Người sinh sau: lấy cung Thiên Di làm Mệnh',
};

const TARGET_PALACE: Record<TwinMethod, string> = { huynh_de: '兄弟', thien_di: '迁移' };

export function isTwinMethod(value: unknown): value is TwinMethod {
  return typeof value === 'string' && (TWIN_METHODS as readonly string[]).includes(value);
}

/** Dời cung Mệnh của astrolabe iztro theo cách sinh đôi (sửa tại chỗ). Vận hạn iztro đọc lại tên cung và decadal.range nên tự khớp. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyTwinMethod(astrolabe: any, method: TwinMethod): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const palaces: any[] = astrolabe.palaces;
  const soul = palaces.findIndex(p => p.name === '命宫');
  const target = palaces.findIndex(p => p.name === TARGET_PALACE[method]);
  if (soul < 0 || target < 0) throw new Error('twin: không tìm thấy cung Mệnh/cung đích trong lá số');
  const shift = target - soul;
  const names = palaces.map(p => p.name as string);
  const ranges = palaces.map(p => [...p.decadal.range] as [number, number]);
  palaces.forEach((p, i) => {
    const from = (i - shift + 12) % 12;
    p.name = names[from];
    p.decadal.range = ranges[from];
  });
  astrolabe.earthlyBranchOfSoulPalace = palaces[target].earthlyBranch;
}
