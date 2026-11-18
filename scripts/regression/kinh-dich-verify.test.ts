import assert from 'node:assert/strict';
import { computeCast } from '../../lib/kinh-dich/core';
import { buildVerifyContext, verifyReading, type VerifyFlagKind } from '../../lib/kinh-dich/verify';

// Bộ kiểm tra bài luận Kinh Dịch (chỉ code): bắt lỗi thật đã gặp trong eval, không gắn cờ câu bình thường.
const kinds = (text: string, ctx: ReturnType<typeof buildVerifyContext>) => verifyReading(text, ctx).flags.map(f => f.kind);
const has = (text: string, ctx: ReturnType<typeof buildVerifyContext>, k: VerifyFlagKind) => kinds(text, ctx).includes(k);

// Truân (Khảm trên, Chấn dưới), hào 5 động → Phục; hỗ Bác, thác Đỉnh, tổng Mông.
const truan = buildVerifyContext(computeCast([7, 8, 8, 8, 9, 8]));
// Tỉnh (Khảm trên, Tốn dưới), không hào động.
const tinh = buildVerifyContext(computeCast([8, 7, 7, 8, 7, 8]));
// Đồng Nhân (Càn trên, Ly dưới), hào 2, 3, 5 động → Khuê (Ly trên, Đoài dưới).
const dongNhan = buildVerifyContext(computeCast([7, 6, 9, 7, 9, 7]));

// ---- 1. Tên quẻ
assert.ok(has('Quẻ biến là Thiên Địa Bĩ, việc sẽ tắc.', truan, 'unknown_hexagram'), 'quẻ Bĩ không thuộc lần gieo');
assert.ok(has('Đây giống quẻ Tiệm: tiến từng bước.', truan, 'unknown_hexagram'));
assert.ok(has('Thời này như Gia Nhân, phải giữ nếp nhà.', truan, 'unknown_hexagram'), 'tên hai chữ viết hoa');
assert.ok(!has('Quẻ biến là Phục, quẻ hỗ Bác, quẻ thác Đỉnh, quẻ tổng Mông; quẻ chính Truân.', truan, 'unknown_hexagram'), 'các quẻ liên quan được phép');
assert.ok(!has('Bác sĩ khuyên bạn nghỉ. Tỉnh dậy sớm. Khuê nói với bạn.', truan, 'unknown_hexagram'), 'đầu câu, không ngữ cảnh quẻ: không gắn cờ');
assert.ok(!has('Ông ví như Đường Hy Tông, Chu Tuyên vương trong quẻ này.', truan, 'unknown_hexagram'), 'tên người');
assert.ok(!has('Quẻ Khảm ở trên, quẻ Chấn ở dưới.', truan, 'unknown_hexagram'), 'tên quái đơn không phải tên quẻ');
assert.ok(!has('Tạp quái đặt Đồng Nhân cạnh Đại Hữu.', dongNhan, 'unknown_hexagram'), 'quẻ đứng cạnh trong Tạp quái được phép');
assert.ok(!has('Quẻ biến là Khuê, trên lửa dưới đầm.', dongNhan, 'unknown_hexagram'));

// ---- 2. Vị trí quái
assert.ok(has('Hào động là hào 5, ngôi cao nhất trong nội quái Khảm, cũng là hào chủ.', truan, 'trigram_position'), 'lỗi eval Q1');
assert.ok(has('Quẻ dưới là Khảm, quẻ trên là Chấn.', truan, 'trigram_position'));
assert.ok(has('Truân là trên Chấn dưới Khảm.', truan, 'trigram_position'));
assert.ok(has('Tên đầy đủ là Lôi Thủy Truân.', truan, 'trigram_position'), 'tên ghép đảo trên/dưới');
assert.ok(!has('Quẻ chính là Truân, trên Khảm dưới Chấn. Sấm ở dưới, nước ở trên: phía trước có hiểm.', truan, 'trigram_position'));
assert.ok(!has('Thủy Lôi Truân là quẻ thứ ba.', truan, 'trigram_position'));
assert.ok(!has('Quẻ biến là Phục, Khôn ở trên, Chấn ở dưới.', truan, 'trigram_position'), 'nói về quẻ biến trong cùng câu');
assert.ok(!has('Quẻ biến là Khuê, trên lửa dưới đầm: hai ngả.\nLửa ở dưới bốc lên hòa cùng trời.', dongNhan, 'trigram_position'));
assert.ok(!has('Gió ở dưới, nước ở trên, gàu gỗ kéo nước lên. Nước ở dưới giếng sâu.', tinh, 'trigram_position'), 'ảnh tượng trong câu thường không tính');
assert.ok(has('Gió ở trên, nước ở dưới: giếng chưa có nước.', tinh, 'trigram_position'));

// ---- 3. Trích Hán Việt
assert.ok(!has('Lời hào: **đồng nhân vu tông, lận** — đáng tiếc.', dongNhan, 'unsourced_quote'), 'có trong bản Ngô Tất Tố');
assert.ok(!has('Lời quẻ mở bằng **đồng nhân vu dã**, rồi "lợi thiệp đại xuyên".', dongNhan, 'unsourced_quote'), 'phiên âm từ nguyên văn chữ Hán');
assert.ok(!has('Đại Tượng của Khuê: "đồng nhi dị". Lời quẻ "tiểu sự cát".', dongNhan, 'unsourced_quote'), 'quẻ biến');
assert.ok(!has('Lời quẻ: "vật dụng hữu du vãng, lợi kiến hầu".', truan, 'unsourced_quote'));
assert.ok(has('Lời hào: **"đồng nhân vu thị, đại cát"**.', dongNhan, 'unsourced_quote'), 'bịa lời hào');
assert.ok(has('Lời quẻ Khốn: "hữu ngôn bất tín".', truan, 'unsourced_quote'), 'trích quẻ không được cấp văn bản');
assert.ok(!has('Bạn nghĩ "việc nhỏ thì tốt" rồi "đi ngay thì gặp may".', truan, 'unsourced_quote'), 'tiếng Việt thường không phải trích Hán Việt');

// ---- 3b. Phạm vi trích: Thoán truyện phiên âm, hỗ / thác / tổng; in đậm nhấn mạnh không phải trích
assert.ok(!has('Thoán truyện nói **vị hữu công**: chưa thành công.', tinh, 'unsourced_quote'), 'Thoán truyện quẻ Tỉnh (未有功)');
assert.ok(!has('Bạn cần **chính trực, kiên nhẫn** và **giữ vững lập trường**.', truan, 'unsourced_quote'), 'in đậm nhấn mạnh ngắn, không từ dẫn');
assert.ok(has('Lời hào nói **phú quý vinh hoa**.', truan, 'unsourced_quote'), 'có từ dẫn thì cụm 4 chữ bịa vẫn bị bắt');

// ---- 4. Câu hình ảnh Đại Tượng (lỗi thật trong câu kết)
assert.ok(has('Trên mây có sấm: chờ mưa rồi mới đi.', truan, 'image_phrase'), 'Truân là mây (Khảm) trên, sấm (Chấn) dưới');
assert.ok(!has('Mây và sấm cùng đến: lúc khó ban đầu.', truan, 'image_phrase'));
assert.ok(!has('Dưới mây có sấm, việc còn ủ.', truan, 'image_phrase'), 'đúng: mây trên sấm dưới');
assert.ok(has('Trên trời có lửa: sáng rõ, công bằng với mọi người.', dongNhan, 'image_phrase'), 'Trên trời có lửa là Đại Hữu, không phải Đồng Nhân');
assert.ok(!has('Trời cùng lửa: người đồng lòng.', dongNhan, 'image_phrase'));
assert.ok(!has('Lửa ở dưới trời, ánh sáng hướng lên.', dongNhan, 'image_phrase'), 'Đồng Nhân: trời trên, lửa dưới');
assert.ok(!has('Quẻ biến là Khuê: lửa trên đầm dưới, hai ngả.', dongNhan, 'image_phrase'), 'nói về quẻ biến trong cùng câu');
assert.ok(has('Quẻ biến Khuê: đầm trên lửa dưới.', dongNhan, 'image_phrase'));

// ---- 4b. Lỗi báo nhầm thật ở eval kd4 (Q3 Đồng Nhân → Khuê): câu Đại Tượng Khuê "Trên lửa dưới đầm"
{
  const q3a = 'Ba hào động trên sáu, việc đã chuyển gần hết, nên trọng lượng bài này nghiêng về quẻ biến: Khuê. Trên lửa dưới đầm, lửa bốc lên, nước chảy xuống, hai ngả.';
  const q3b = 'Đoạn trước nói về Đồng Nhân.\n\nTrên lửa dưới đầm, hai thứ đi hai ngả mà vẫn ở chung một quẻ; người quân tử nhìn tượng ấy mà hòa đồng với nhau, đồng thời vẫn giữ cho mình chỗ riêng khác.';
  for (const t of [q3a, q3b]) {
    assert.deepEqual(verifyReading(t, dongNhan).flags.filter(f => f.kind === 'trigram_position' || f.kind === 'image_phrase'), [], t.slice(0, 40));
  }
  assert.ok(has('Đồng Nhân: dưới lửa trên đầm.', dongNhan, 'image_phrase'), 'đảo thật vẫn bắt');
  assert.ok(has('Đồng Nhân là trên đầm dưới lửa.', dongNhan, 'trigram_position'));
}

// ---- 5. Vật tượng lạ (lỗi thật Q1 kd4: "núi" trong quẻ Truân, lọt từ ví dụ Kiển)
{
  const q1 = 'Sấm ở dưới, nước ở trên: cái đang muốn nhúc nhích là phía bạn. Bạn có thể hình dung việc này như sấm nổi dưới chân núi, trên đầu đã là mây nước chực trút xuống.';
  const fl = verifyReading(q1, truan).flags.filter(f => f.kind === 'foreign_image');
  assert.equal(fl.length, 1);
  assert.ok(fl[0].detail.includes('"núi"'));
  assert.ok(!has('Mây và sấm cùng đến, nước trên sấm dưới: lúc khó ban đầu.', truan, 'foreign_image'));
  assert.ok(!has('Đất nước đang khó, ông trời chưa thương: nước trên sấm dưới.', truan, 'foreign_image'), 'cụm thường ngày');
  assert.ok(!has('Bạn nên leo núi cho khỏe.', truan, 'foreign_image'), 'một vật tượng lẻ, không phải câu hình ảnh');
  assert.ok(!has('Quẻ hỗ Bác: núi trên đất, sấm vẫn ở dưới.', truan, 'foreign_image'), 'hỗ quái nêu tên trong câu thì được dùng vật tượng của nó');
  assert.ok(has('Trời cao, lửa sáng, núi chắn ngang đường.', dongNhan, 'foreign_image'));
  assert.ok(!has('Quẻ biến là Khuê: lửa bốc lên, nước chảy xuống, hai ngả rẽ nhau.', dongNhan, 'foreign_image'), 'nước của đầm (Đoài)');
  assert.ok(!has('Thoán truyện: trời đất khác nhau mà việc chung; lửa trên đầm dưới.', dongNhan, 'foreign_image'));
}

// ---- 4. Chép ví dụ
assert.ok(has('Trên núi có cây, lớn dần mà vững — việc của bạn lúc này cũng vậy, mỗi chặng một bước, đừng mong một lần mà xong.', truan, 'example_copy'), 'lỗi eval Q1 kd2-low');
assert.ok(!has('Bạn ứng với hào 2 — đắc chính, đắc trung, chính ứng với hào 5.', truan, 'example_copy'), 'thuật ngữ hào vị chung');
assert.ok(!has('Sấm nằm dưới nước, mầm cây đang đội đất mà lên; bạn đang ở lúc khởi đầu còn rối.', truan, 'example_copy'));

// ---- 5. Nhãn nội bộ / cụm cấm
assert.ok(has('Bảng vị trí hào cho thấy thế đứng của hai người.', tinh, 'banned_label'), 'lỗi eval Q2 kd2-off');
assert.ok(has('Theo JSON, hào 5 động.', tinh, 'banned_label'));
assert.ok(has('Tóm lại, nên làm.', tinh, 'banned_phrase'));
assert.ok(!has('Vị trí của hào 5 rất tốt; năm nay hai bạn nên tính.', tinh, 'banned_label'));

// ---- 6. Chữ Hán
assert.ok(has('Lời quẻ 井 nói giếng.', tinh, 'han_chars'));
assert.ok(!has('Lời quẻ Tỉnh nói về giếng.', tinh, 'han_chars'));

// ---- Bài sạch: không cờ nào
const clean = `Gió ở dưới, nước ở trên: gàu gỗ thả xuống kéo nước lên. Quẻ Tỉnh nói về một nguồn đã có sẵn.

Lời quẻ nói "cải ấp bất cải tỉnh, vô táng vô đắc": dời ấp chứ không dời giếng. Hào 2 và hào 5 cùng dương, vô ứng.

Có nước trên gàu gỗ, kéo lên là dùng được.`;
assert.deepEqual(verifyReading(clean, tinh).flags, [], 'bài sạch không có cờ');

console.log('kinh-dich-verify: ok');
