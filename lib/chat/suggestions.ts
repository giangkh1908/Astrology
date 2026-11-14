/**
 * Gợi ý câu hỏi tĩnh dưới bài luận (prompt v3). Không để AI tự sinh vì model nhanh dễ in sai định dạng.
 * Chèn tháng giữa của khung 3 tháng đang chọn; bấm gợi ý = gửi như câu hỏi thường.
 */
import { windowMonths, type MonthWindow } from '@/lib/ziwei/month-window';

/** m = "tháng N âm" */
const BY_TOPIC: Record<string, (m: string) => string[]> = {
  love: m => [`Trong ${m} có hợp để tỏ tình hay tiến tới không?`, `Trong ${m} tình cảm có dễ va chạm không?`, 'Nên làm gì để giữ hòa khí trong 3 tháng này?'],
  career: m => [`Trong ${m} có nên ký hợp đồng hay nhận việc mới không?`, `Trong ${m} có hợp để xin tăng lương, đổi việc không?`, 'Tháng nào trong khung cần cẩn thận nhất với cấp trên, đối tác?'],
  wealth: m => [`Trong ${m} có nên đầu tư hay chi khoản lớn không?`, `Trong ${m} có dễ hao tiền, cho vay mất không?`, 'Tháng nào trong khung tiền vào tốt nhất?'],
  health: m => [`Trong ${m} cần giữ gìn sức khỏe điều gì?`, 'Tháng nào trong khung nên tránh đi xa, làm việc quá sức?'],
  overview: m => [`Trong ${m} nên tập trung vào việc gì?`, `Trong ${m} có việc gì cần đề phòng không?`, 'Tháng nào trong khung thuận lợi nhất?'],
};

const GENERIC = (m: string) => [`Trong ${m} điều này ứng ra sao?`, 'Tháng nào trong khung cần lưu ý nhất?'];

export function suggestionsFor(threadKey: string, w: MonthWindow): string[] {
  if (threadKey === 'personality') return [];
  const middle = windowMonths(w)[1];
  return (BY_TOPIC[threadKey] ?? GENERIC)(`tháng ${middle.month} âm`).slice(0, 3);
}
