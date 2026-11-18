/**
 * Tên hai người trong hợp bàn: người dùng tự nhập nên coi là dữ liệu, làm sạch trước khi đưa vào prompt/tool.
 * Dữ liệu cũ không có tên thì dùng tên mặc định; trùng tên thì thêm số để phân biệt.
 */
export const MAX_PERSON_NAME = 40;
export const FALLBACK_NAMES = ['Người thứ nhất', 'Người thứ hai'] as const;

/** Xuống dòng/tab thành khoảng trắng; bỏ ký tự điều khiển/định dạng, dấu ngoặc kép, gạch chéo ngược, backtick, ngoặc nhọn/vuông; gộp khoảng trắng; cắt 40 ký tự. */
export function cleanPersonName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[\t\n\v\f\r\p{Zl}\p{Zp}]/gu, ' ')
    .replace(/[\p{Cc}\p{Cf}"`\\<>{}[\]]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_PERSON_NAME)
    .trim();
}

/** Tên hiển thị của hai người (đã làm sạch), luôn khác nhau. */
export function hemingNames(rawA: unknown, rawB: unknown): [string, string] {
  const a = cleanPersonName(rawA) || FALLBACK_NAMES[0];
  const b = cleanPersonName(rawB) || FALLBACK_NAMES[1];
  return a.toLocaleLowerCase('vi') === b.toLocaleLowerCase('vi') ? [`${a} (1)`, `${b} (2)`] : [a, b];
}
