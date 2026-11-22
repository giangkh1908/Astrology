/**
 * v4: như v3, thêm gói luật riêng cho từng chủ đề (topicPack) và mục Kiểm chứng lá số hỏi lại chuyện đã qua.
 * Mục Kiểm chứng/Tính cách không có khung 3 tháng; câu hỏi tự động của Kiểm chứng là VERIFY_QUESTION (xử lý trong v3).
 */
import { topicPackFor } from '../packs';
import { buildInterpretationPrompt, type InterpretationIntent, type PromptSet } from '../shared';
import { ASK_RULE, promptSetV3, v3Style } from '../v3';

const style = { ...v3Style, topicPack: topicPackFor };
// Kiểm chứng không có khung 3 tháng: bỏ luật thời gian của v3 (nhắc khối lưu nguyệt), dùng luật vận hạn mặc định.
// Kiểm chứng cũng hỏi ngay khi mở tự động (theo gói luật Kiểm chứng), nên bỏ dòng "không hỏi lại" của ASK_RULE.
const { timeRules: _timeRules, ...styleNoWindowBase } = style;
const NEWLINE = String.fromCharCode(10);
const verifyAskRule = [
  ...ASK_RULE.split(NEWLINE).filter(line => !line.includes('mở mục tự động')),
  '- Riêng mục Kiểm chứng: khi mở mục tự động (người dùng chưa gõ gì) vẫn gọi hoi_nguoi_dung NGAY theo gói luật Kiểm chứng, chưa viết bài luận.',
].join(NEWLINE);
const styleNoWindow = { ...styleNoWindowBase, askRule: verifyAskRule };
const styleFor = (intent: InterpretationIntent) => (intent.type === 'topic' && intent.key === 'kiem_chung' ? styleNoWindow : style);

export const promptSetV4: PromptSet = {
  ...promptSetV3,
  buildInterpretationSystemPrompt: (chart, intent, time, priorNotes) => buildInterpretationPrompt(chart, intent, time, styleFor(intent), priorNotes),
};
