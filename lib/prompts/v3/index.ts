/**
 * v3: từ 2026-11-14 — dựa trên v2 (không nêu tên sao, căn cứ theo cung), thêm:
 * - hỏi lại người dùng TRƯỚC khi luận bằng tool hoi_nguoi_dung (thay cho câu hỏi cuối bài);
 * - luận tương lai gần: khung 3 tháng âm lịch đang chọn, từng tháng một, lưu nguyệt tính sẵn trong prompt.
 * Mục Tính cách không có khái niệm thời gian nên không có khung tháng.
 */
import { buildChartTools } from '@/lib/ai/tools/ziwei-tools';
import { defaultWindow, windowLabel, windowMonths } from '@/lib/ziwei/month-window';
import type { ZiweiChart } from '@/lib/ziwei/types';
import {
  buildCompatibilityPrompt, buildInterpretationPrompt, DEFAULT_COMPATIBILITY_QUESTION,
  type InterpretationIntent, type InterpretationStyle, type InterpretationTimeContext, type PromptSet,
} from '../shared';
import { promptSetV2, v2AnswerRules, V2_COMPATIBILITY_PRESENTATION, v2YesNoRule } from '../v2';

const ASK_RULE = [
  'Hỏi lại người dùng (tool hoi_nguoi_dung):',
  '- TRƯỚC khi viết, tự xét: có hoàn cảnh nào chưa biết mà làm thay đổi hẳn kết luận không (đã lập gia đình chưa, đang đi làm hay kinh doanh, đang có người yêu không, việc cụ thể đang tính là gì…)? Nếu có, và điều đó chưa có trong cuộc trò chuyện lẫn lời kể ở mục khác, thì gọi hoi_nguoi_dung NGAY, chưa viết bài luận. Người dùng trả lời xong mới luận.',
  '- Không hỏi điều đã biết; không hỏi chuyện chỉ làm bài hay hơn chút ít. Người dùng đã chọn bỏ qua câu hỏi thì luận luôn theo dữ kiện hiện có, nêu cả hai khả năng nếu cần.',
  '- Đã đủ bối cảnh thì luận trọn bài. Cuối bài KHÔNG đặt câu hỏi, không dùng lời khuyên mẫu, bài tập thử nghiệm hay checklist theo khuôn.',
  '- Câu hỏi mở mục tự động (người dùng chưa gõ gì) thì không hỏi lại: luận luôn theo lá số.',
].join('\n');

const TIME_RULES = [
  'Cách luận theo thời gian (tương lai gần):',
  '- Phạm vi mặc định là khung 3 tháng âm lịch đang chọn; lưu nguyệt của 3 tháng đó đã tính sẵn ở khối "Dữ kiện lưu nguyệt khung 3 tháng" cuối prompt, dùng trực tiếp, không cần tra lại. Trình bày THEO TỪNG THÁNG, mỗi tháng ghi kèm khoảng dương lịch lấy từ trường dương_lịch, tháng nổi bật nhất nói kỹ nhất.',
  '- Lá số gốc, đại hạn và lưu niên chỉ dùng làm LÝ DO lồng trong câu khi luận từng tháng; không viết thành đoạn riêng, không mở bài bằng chúng. Tầng sau chỉ kích hoạt cái tầng trước đã có; ưu tiên trường hóa_chồng_tầng (chồng Kỵ là điểm xấu mạnh, Lộc gặp Kỵ là được rồi mất, cát hóa chồng là điểm tốt mạnh).',
  '- Người dùng tự hỏi xa hơn khung (bao giờ cưới, năm sau…): trả lời ngắn sau khi tra bằng công cụ, rồi gợi ý chuyển khung tháng tới giai đoạn đó để xem chi tiết.',
  '- Mục Tính cách và câu hỏi về bản chất con người không có khái niệm thời gian: luận theo lá số gốc, không chia tháng.',
  '- Khi nêu năm hoặc tháng âm lịch, LUÔN ghi kèm khoảng dương lịch lấy từ dữ kiện hoặc kết quả tra cứu. Không tự đoán ngày dương lịch.',
  v2YesNoRule.replace('rồi luận chi tiết diễn biến và thời điểm nổi bật', 'rồi luận chi tiết diễn biến từng tháng trong khung'),
].join('\n');

const isTimeless = (intent: InterpretationIntent) => intent.type === 'topic' && intent.key === 'personality';

/** Lưu nguyệt 3 tháng của khung, cùng logic tool xem_van_han; mục Tính cách thì không có. */
function windowFacts(chart: ZiweiChart, intent: InterpretationIntent, time: InterpretationTimeContext) {
  if (isTimeless(intent)) return undefined;
  const xemVanHan = buildChartTools(chart.birthInfo).find(t => t.name === 'xem_van_han')!;
  const window = time.window ?? defaultWindow();
  const label = windowLabel(window);
  return {
    khung_đang_chọn: `${label.months.toLowerCase()}${label.solar ? ` (${label.solar})` : ''}`,
    các_tháng: windowMonths(window).map(({ lunarYear, month }) => {
      const r = xemVanHan.run({ nam: lunarYear, thang: month }) as Record<string, unknown>;
      return { năm_âm_lịch: lunarYear, tháng_âm: month, lưu_nguyệt: r.lưu_nguyệt, hóa_chồng_tầng: r.hóa_chồng_tầng };
    }),
  };
}

const style: InterpretationStyle = {
  answerRules: v2AnswerRules,
  yesNoRule: v2YesNoRule,
  askRule: ASK_RULE,
  timeRules: TIME_RULES,
  windowFacts,
};

const WINDOW = 'trong khung 3 tháng âm lịch đang chọn, luận từng tháng một (kèm khoảng dương lịch), tháng nổi bật nhất nói kỹ nhất';

const topics: Record<string, string> = {
  overview: `Hãy luận tổng quan vận của lá số này ${WINDOW}. Nét mệnh cách chỉ dùng làm lý do, căn cứ tóm ngắn theo cung.`,
  love: `Hãy luận tình cảm và hôn nhân ${WINDOW}. Căn cứ tóm ngắn theo tam phương tứ chính cung Phu Thê.`,
  career: `Hãy luận công việc và sự nghiệp ${WINDOW}. Căn cứ tóm ngắn theo tam phương tứ chính cung Quan Lộc.`,
  wealth: `Hãy luận tài chính và thu nhập ${WINDOW}. Căn cứ tóm ngắn theo các cung liên quan.`,
  health: `Hãy nêu các khuynh hướng sức khỏe theo cách luận truyền thống ${WINDOW}, thật thận trọng và không chẩn đoán bệnh.`,
};

function initialQuestion(intent: InterpretationIntent): string {
  if (isTimeless(intent)) return promptSetV2.initialInterpretationQuestion(intent);
  if (intent.type === 'palace') return `Hãy luận giải cung được chọn ${WINDOW}. Căn cứ tóm ngắn theo tam phương tứ chính bằng tên cung, không nêu tên sao.`;
  if (intent.type === 'sihua') return `Hãy giải thích đường tứ hóa được chọn và cách nó ứng ${WINDOW}. Chỉ kết luận điều được dữ liệu xác nhận.`;
  return topics[intent.key ?? 'overview'] ?? `Hãy phân tích câu hỏi theo dữ kiện cụ thể trong lá số này ${WINDOW}.`;
}

export const promptSetV3: PromptSet = {
  buildInterpretationSystemPrompt: (chart, intent, time, priorNotes) => buildInterpretationPrompt(chart, intent, time, style, priorNotes),
  initialInterpretationQuestion: initialQuestion,
  buildCompatibilitySystemPrompt: (a, b, notes) => buildCompatibilityPrompt(a, b, V2_COMPATIBILITY_PRESENTATION, notes),
  defaultCompatibilityQuestion: DEFAULT_COMPATIBILITY_QUESTION,
};
