/** v1: prompt trước 2026-11-09 — cá nhân hóa bằng tên sao/cung cụ thể, căn cứ nêu sao theo tầng. */
import {
  buildCompatibilityPrompt, buildInterpretationPrompt, DEFAULT_COMPATIBILITY_QUESTION, pickInitialQuestion,
  type InitialQuestions, type InterpretationStyle, type PromptSet,
} from '../shared';

const style: InterpretationStyle = {
  answerRules: [
    'Trả lời trực tiếp câu hỏi mới nhất trước, cá nhân hóa bằng tên sao/cung cụ thể trong lá số. Giải thích ngắn mối liên hệ từ dữ kiện đến nhận định; nêu mặt thuận và điều cần lưu ý khi cả hai đều có căn cứ.',
  ],
  yesNoRule: '- Với câu hỏi có/không về sự kiện (có người yêu không, có đổi việc không…): nêu nhận định chính và mức độ rõ của tín hiệu (rõ / vừa / mờ) ngay câu đầu, rồi đưa căn cứ theo tầng và chỉ ra thời điểm nổi bật.',
};

const questions: InitialQuestions = {
  palace: 'Hãy luận giải cung được chọn trong lá số này. Nêu kết luận chính trước, sau đó chỉ ra các sao và liên hệ tam phương tứ chính làm căn cứ.',
  sihua: 'Hãy giải thích đường tứ hóa được chọn: sao hóa, cung nhận hóa và ý nghĩa của liên hệ đó trong lá số. Chỉ kết luận điều được dữ liệu xác nhận.',
  topics: {
    overview: 'Hãy tóm lược mệnh cách của lá số này bằng những nét riêng có căn cứ từ tổ hợp sao và cung.',
    love: 'Hãy phân tích tình cảm và hôn nhân của lá số này, tập trung cung Phu Thê và các liên hệ thực sự có trong dữ liệu.',
    career: 'Hãy phân tích công việc và sự nghiệp của lá số này, nêu cấu hình cung và sao cụ thể làm căn cứ.',
    wealth: 'Hãy phân tích cách tạo thu nhập và xu hướng tài chính theo các cung liên quan trong lá số này.',
    health: 'Hãy nêu các khuynh hướng sức khỏe theo cách luận truyền thống, thật thận trọng và không chẩn đoán bệnh.',
    personality: 'Hãy phân tích tính cách riêng của đương số từ tổ hợp sao cụ thể ở Mệnh, Thân và các cung liên quan.',
  },
};

export const promptSetV1: PromptSet = {
  buildInterpretationSystemPrompt: (chart, intent, time) => buildInterpretationPrompt(chart, intent, time, style),
  initialInterpretationQuestion: intent => pickInitialQuestion(intent, questions),
  buildCompatibilitySystemPrompt: (a, b) => buildCompatibilityPrompt(a, b),
  defaultCompatibilityQuestion: DEFAULT_COMPATIBILITY_QUESTION,
};
