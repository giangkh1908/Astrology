import assert from 'node:assert/strict';
import {
  ASK_TOOL_NAME, askToolDefinition, askToPlainText, encodeAsk, extractAsk, formatAnswers, parseAskArgs, trailingAsks,
  type AskPayload,
} from '../../lib/ai/ask-user';

// Lõi tool hỏi lại: validate tham số model gửi, mã hóa thẻ vào nội dung tin nhắn, đổi thành văn bản cho model.

assert.equal(askToolDefinition.name, ASK_TOOL_NAME);
assert.equal(ASK_TOOL_NAME, 'hoi_nguoi_dung');

// JSON hỏng hoặc không có câu nào → null
assert.equal(parseAskArgs('{bad'), null);
assert.equal(parseAskArgs(JSON.stringify({ cau_hoi: [] })), null);
assert.equal(parseAskArgs(JSON.stringify({ loi_dan: 'x' })), null);

// Cắt về giới hạn: ≤3 câu, ≤4 lựa chọn, nhãn ≤12 ký tự, bỏ câu <2 lựa chọn
const opt = (t: string) => ({ tieu_de: t, giai_thich: `giải thích ${t}` });
const many = parseAskArgs(JSON.stringify({
  loi_dan: 'Cho mình hỏi:',
  cau_hoi: [
    { nhan: 'Một nhãn rất là dài', noi_dung: 'Câu 1?', lua_chon: ['a', 'b', 'c', 'd', 'e', 'f'].map(opt) },
    { nhan: 'Lẻ', noi_dung: 'Câu chỉ một lựa chọn?', lua_chon: [opt('a')] },
    { nhan: 'B', noi_dung: 'Câu 2?', lua_chon: [opt('a'), opt('b')], chon_nhieu: true },
    { nhan: 'C', noi_dung: 'Câu 3?', lua_chon: [opt('a'), opt('b')] },
    { nhan: 'D', noi_dung: 'Câu 4?', lua_chon: [opt('a'), opt('b')] },
  ],
}));
assert.ok(many);
assert.equal(many.cau_hoi.length, 3);
assert.equal(many.cau_hoi[0].lua_chon.length, 4);
assert.ok(many.cau_hoi[0].nhan.length <= 12);
assert.ok(!many.cau_hoi.some(q => q.noi_dung === 'Câu chỉ một lựa chọn?'), 'câu dưới 2 lựa chọn phải bị bỏ');
assert.equal(many.cau_hoi[1].chon_nhieu, true);

// Câu dẫn trống → câu mặc định
const noLead = parseAskArgs(JSON.stringify({ cau_hoi: [{ nhan: 'A', noi_dung: 'Q?', lua_chon: [opt('a'), opt('b')] }] }));
assert.equal(noLead?.loi_dan, 'Để luận đúng chuyện của bạn, cho mình hỏi thêm:');

const p: AskPayload = {
  loi_dan: 'Để luận đúng chuyện của bạn, cho mình hỏi thêm:',
  cau_hoi: [
    { nhan: 'Hôn nhân', noi_dung: 'Bạn đã lập gia đình chưa?', lua_chon: [{ tieu_de: 'Đã kết hôn' }, { tieu_de: 'Chưa' }] },
    { nhan: 'Con cái', noi_dung: 'Bạn có con chưa?', lua_chon: [{ tieu_de: 'Có' }, { tieu_de: 'Chưa' }] },
  ],
};

// Mã hóa ↔ giải mã
const encoded = encodeAsk(p);
assert.ok(encoded.includes('<!--ask:'));
assert.deepEqual(extractAsk(encoded), { text: p.loi_dan, ask: p });
assert.deepEqual(extractAsk('Bài luận thường'), { text: 'Bài luận thường', ask: null });
assert.deepEqual(extractAsk('Lời dẫn\n\n<!--ask:{hỏng-->'), { text: 'Lời dẫn\n\n<!--ask:{hỏng-->', ask: null });

// Văn bản cho model: không còn khối đánh dấu, vẫn có nội dung câu hỏi
const plain = askToPlainText(encoded);
assert.ok(!plain.includes('<!--ask:'));
assert.ok(plain.includes('Bạn đã lập gia đình chưa?'));
assert.ok(plain.includes('Đã kết hôn'));
assert.equal(askToPlainText('Không có thẻ'), 'Không có thẻ');

// Câu trả lời của người dùng
assert.equal(formatAnswers(p, [['Đã kết hôn'], null]), 'Trả lời câu hỏi:\n- Hôn nhân — ' + p.cau_hoi[0].noi_dung + ': Đã kết hôn\n- Con cái — ' + p.cau_hoi[1].noi_dung + ': bỏ qua');
assert.equal(formatAnswers(p, [['Đã kết hôn', 'Đang ly thân'], ['Có']]), 'Trả lời câu hỏi:\n- Hôn nhân — ' + p.cau_hoi[0].noi_dung + ': Đã kết hôn, Đang ly thân\n- Con cái — ' + p.cau_hoi[1].noi_dung + ': Có');

// Đếm số lần hỏi liên tiếp ở cuối lịch sử
const u = { role: 'user', content: 'hỏi' };
const a = { role: 'assistant', content: encoded };
const essay = { role: 'assistant', content: 'Bài luận' };
assert.equal(trailingAsks([u, a, u, a]), 2);
assert.equal(trailingAsks([u, a, u, a, u]), 2);
assert.equal(trailingAsks([a, u, essay, u]), 0);
assert.equal(trailingAsks([essay, u, a, u]), 1);
assert.equal(trailingAsks([]), 0);

console.log('ask-user: ok');
