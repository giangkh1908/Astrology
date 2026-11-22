/** Version prompt có khung 3 tháng âm lịch (v3, v4). Module nhỏ để client dùng mà không kéo cả bộ prompt. */
export function usesTimeWindow(version: string): boolean {
  return version === 'v3' || version === 'v4';
}
