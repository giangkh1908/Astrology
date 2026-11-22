/**
 * v4: như v3, thêm gói luật riêng cho từng chủ đề (topicPack) và mục Kiểm chứng lá số hỏi lại chuyện đã qua.
 * Mục Kiểm chứng/Tính cách không có khung 3 tháng; câu hỏi tự động của Kiểm chứng là VERIFY_QUESTION (xử lý trong v3).
 */
import { topicPackFor } from '../packs';
import { buildInterpretationPrompt, type InterpretationIntent, type PromptSet } from '../shared';
import { promptSetV3, v3Style } from '../v3';

const style = { ...v3Style, topicPack: topicPackFor };
// Kiểm chứng không có khung 3 tháng: bỏ luật thời gian của v3 (nhắc khối lưu nguyệt), dùng luật vận hạn mặc định.
const { timeRules: _timeRules, ...styleNoWindow } = style;
const styleFor = (intent: InterpretationIntent) => (intent.type === 'topic' && intent.key === 'kiem_chung' ? styleNoWindow : style);

export const promptSetV4: PromptSet = {
  ...promptSetV3,
  buildInterpretationSystemPrompt: (chart, intent, time, priorNotes) => buildInterpretationPrompt(chart, intent, time, styleFor(intent), priorNotes),
};
