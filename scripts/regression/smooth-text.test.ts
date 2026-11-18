import assert from 'node:assert/strict';
import { hideOpenMarkdown, revealUpTo } from '../../components/useSmoothText';

// Nhả chữ stream: chỉ dừng ở ranh giới chữ, không lộ nửa âm tiết tiếng Việt; giấu ** chưa đóng.
const t = 'Quẻ này nói người';
assert.equal(revealUpTo(t, 0, 2, false), 0, 'chưa hết chữ đầu: chưa hiện gì');
assert.equal(revealUpTo(t, 0, 5, false), 4, '"Quẻ " trọn chữ');
assert.equal(revealUpTo(t, 4, 15, false), 12, 'dừng trước "người" đang dở');
assert.equal(revealUpTo(t, 12, 99, false), 12, 'chữ cuối chưa chắc trọn khi còn stream');
assert.equal(revealUpTo(t, 12, 99, true), t.length, 'stream xong: hiện hết');
assert.equal(revealUpTo('ng', 0, 2, false), 0, 'mảnh "ng" của "người" không hiện');
assert.equal(revealUpTo('Tốt, nhưng', 0, 4, false), 4, 'cắt sau dấu phẩy được (trước ranh giới)');

assert.equal(hideOpenMarkdown('Đây là **quan trọng'), 'Đây là quan trọng');
assert.equal(hideOpenMarkdown('Đây là **rõ** rồi'), 'Đây là **rõ** rồi');
assert.equal(hideOpenMarkdown('Mở đầu *'), 'Mở đầu ');
assert.equal(hideOpenMarkdown('**【Ý quẻ】** và **đậm'), '**【Ý quẻ】** và đậm');
assert.equal(hideOpenMarkdown('Đoạn một.\n**【Lời hào'), 'Đoạn một.\n', 'giấu tiêu đề đang viết dở');
assert.equal(hideOpenMarkdown('**【Ý q'), '');
assert.equal(hideOpenMarkdown('Đoạn một.\n**【Ý quẻ】**'), 'Đoạn một.\n**【Ý quẻ】**', 'tiêu đề đã đóng thì giữ');
assert.equal(hideOpenMarkdown('Đoạn một.\n**【Ý quẻ】** rồi **đậ'), 'Đoạn một.\n**【Ý quẻ】** rồi đậ');
console.log('smooth-text: ok');
