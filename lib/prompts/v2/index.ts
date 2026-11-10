/** v2: từ 2026-11-09 — không nêu tên sao, căn cứ tóm theo cung (tam phương tứ chính), kết luận chi tiết. */
import {
  buildCompatibilityPrompt, buildInterpretationPrompt, DEFAULT_COMPATIBILITY_QUESTION, pickInitialQuestion,
  type InitialQuestions, type InterpretationStyle, type PromptSet,
} from '../shared';

const style: InterpretationStyle = {
  answerRules: [
    'Trả lời trực tiếp câu hỏi mới nhất trước. Nêu mặt thuận và điều cần lưu ý khi cả hai đều có căn cứ.',
    [
      'Cách trình bày cho người dùng (phân tích bên trong vẫn đầy đủ theo sao, tứ hóa, các tầng):',
      '- KHÔNG nhắc tên sao (chính tinh, phụ tinh, sao lưu), không nhắc tên hóa gắn với sao (kiểu "Thiên Đồng hóa Lộc"), không nhắc độ sáng Miếu/Hãm. Chuyển hết thành ý nghĩa đời thường: được hỗ trợ, có quý nhân, dễ vướng giấy tờ, áp lực, hao tiền…',
      '- Phần căn cứ chỉ nói ngắn gọn 1–2 câu theo tam phương tứ chính bằng tên cung: cung chủ đề đang thế nào, cung nào xung chiếu, cung nào tam hợp nâng đỡ hay kéo xuống. Ví dụ: "Cung Quan Lộc năm nay sáng, được cung Tài Bạch và Mệnh hỗ trợ, nhưng cung Phu Thê xung chiếu mang chút trắc trở."',
      '- Phần kết luận phải CHI TIẾT và cụ thể vào đời sống: chuyện gì có thể xảy ra, mức độ rõ của tín hiệu, diễn biến theo từng giai đoạn/tháng (kèm khoảng dương lịch), điều nên làm và nên tránh trong từng giai đoạn, gắn với hoàn cảnh người dùng đã kể.',
      '- Chỉ khi người dùng hỏi rõ "sao nào", "căn cứ chi tiết", "vì sao" theo kiểu chuyên môn thì mới giải thích bằng tên sao và tứ hóa.',
    ].join('\n'),
  ],
  yesNoRule: '- Với câu hỏi có/không về sự kiện (có người yêu không, có đổi việc không…): nêu nhận định chính và mức độ rõ của tín hiệu (rõ / vừa / mờ) ngay câu đầu, tóm tắt căn cứ theo cung (không nêu tên sao), rồi luận chi tiết diễn biến và thời điểm nổi bật.',
};

const questions: InitialQuestions = {
  palace: 'Hãy luận giải cung được chọn trong lá số này. Nêu kết luận chi tiết trước, căn cứ chỉ tóm ngắn theo tam phương tứ chính bằng tên cung, không nêu tên sao.',
  sihua: 'Hãy giải thích đường tứ hóa được chọn: sao hóa, cung nhận hóa và ý nghĩa của liên hệ đó trong lá số. Chỉ kết luận điều được dữ liệu xác nhận.',
  topics: {
    overview: 'Hãy luận chi tiết mệnh cách của lá số này bằng những nét riêng, căn cứ tóm ngắn theo cung.',
    love: 'Hãy phân tích chi tiết tình cảm và hôn nhân của lá số này, căn cứ tóm ngắn theo tam phương tứ chính cung Phu Thê.',
    career: 'Hãy phân tích chi tiết công việc và sự nghiệp của lá số này, căn cứ tóm ngắn theo tam phương tứ chính cung Quan Lộc.',
    wealth: 'Hãy phân tích chi tiết cách tạo thu nhập và xu hướng tài chính, căn cứ tóm ngắn theo các cung liên quan.',
    health: 'Hãy nêu các khuynh hướng sức khỏe theo cách luận truyền thống, thật thận trọng và không chẩn đoán bệnh.',
    personality: 'Hãy phân tích chi tiết tính cách riêng của đương số, căn cứ tóm ngắn theo cung Mệnh, Thân và các cung liên quan.',
  },
};

const COMPATIBILITY_PRESENTATION = 'Cách trình bày: KHÔNG nhắc tên sao, tên hóa gắn với sao hay độ sáng Miếu/Hãm; chuyển thành ý nghĩa đời thường. Căn cứ chỉ tóm ngắn 1–2 câu theo tên cung (cung nào của ai hợp/xung với cung nào của người kia). Phần kết luận phải chi tiết: hai người hợp ở đâu, dễ va chạm chuyện gì, giai đoạn nào cần lưu ý, nên làm gì. Chỉ khi người dùng hỏi rõ "sao nào"/căn cứ chuyên môn mới nêu tên sao.';

export const promptSetV2: PromptSet = {
  buildInterpretationSystemPrompt: (chart, intent, time) => buildInterpretationPrompt(chart, intent, time, style),
  initialInterpretationQuestion: intent => pickInitialQuestion(intent, questions),
  buildCompatibilitySystemPrompt: (a, b) => buildCompatibilityPrompt(a, b, COMPATIBILITY_PRESENTATION),
  defaultCompatibilityQuestion: DEFAULT_COMPATIBILITY_QUESTION,
};
