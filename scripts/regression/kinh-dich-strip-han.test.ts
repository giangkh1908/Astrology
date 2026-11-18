/** Lưới chặn chữ Hán phía server cho bài luận Kinh Dịch: cả đoạn trọn vẹn lẫn khi chữ về từng mảnh. */
import assert from 'node:assert/strict';
import { createHanStripper, hasHan, stripHan } from '../../lib/kinh-dich/strip-han';

const run = (chunks: string[]) => {
  const f = createHanStripper();
  return chunks.map(c => f.push(c)).join('') + f.flush();
};

// Đoạn trọn vẹn
assert.equal(stripHan('Quẻ Tỉnh (井：改邑不改井) nói về giếng.'), 'Quẻ Tỉnh nói về giếng.');
assert.equal(stripHan('Lời hào **羸其瓶** là điềm xấu.'), 'Lời hào là điềm xấu.');
assert.equal(stripHan('Câu “井泥不食” nghĩa là bùn giếng.'), 'Câu nghĩa là bùn giếng.');
assert.equal(stripHan('**Kiến long tại điền** (見龍在田), lợi kiến đại nhân.'), '**Kiến long tại điền**, lợi kiến đại nhân.');
assert.equal(stripHan('Không có chữ Hán (chỉ tiếng Việt) **đậm**.'), 'Không có chữ Hán (chỉ tiếng Việt) **đậm**.');
assert.equal(hasHan('abc 井'), true);
assert.equal(hasHan('Hán Việt'), false);

// Theo luồng: vỏ rỗng bị cắt ngang ranh giới mảnh không để lại "(" hay "**" mồ côi
assert.equal(run(['Quẻ Tỉnh (', '井：改', ')', ' nói về giếng.']), 'Quẻ Tỉnh nói về giếng.');
assert.equal(run(['Lời hào **', '羸其瓶', '**', ' là điềm xấu.']), 'Lời hào là điềm xấu.');
assert.equal(run(['Lời hào *', '*羸其瓶*', '* là xấu.']), 'Lời hào là xấu.');
assert.equal(run(['Câu “', '井泥', '不食”', ' nghĩa là bùn.']), 'Câu nghĩa là bùn.');
// Chữ Việt in đậm / trong ngoặc bị cắt ngang vẫn giữ nguyên
assert.equal(run(['Hãy **', 'kiên nhẫn', '** chờ (', 'ba tháng', ').']), 'Hãy **kiên nhẫn** chờ (ba tháng).');
assert.equal(run(['Kết bằng **']), 'Kết bằng **', 'hết luồng thì trả phần còn giữ');
// Mảnh không có ngoặc: đi thẳng, không giữ lại
{
  const f = createHanStripper();
  assert.equal(f.push('Một câu bình thường. '), 'Một câu bình thường. ');
  assert.equal(f.push('Thêm 井 chữ.'), 'Thêm chữ.');
  assert.equal(f.flush(), '');
}
// "**a** **b**" có chữ Hán ở chỗ khác không bị dính hai cặp in đậm
assert.equal(stripHan('**một** **hai** 井'), '**một** **hai** ');
assert.equal(run(['**một**', ' **hai**', ' (井)', '.']), '**một** **hai**.');

console.log('kinh-dich-strip-han: ok');
