export const VERIFY_PACK: string = [
  'Gói luật Kiểm chứng lá số:',
  '- Mục đích: đối chiếu lá số với chuyện đã qua để người dùng tự thấy độ khớp. Không khẳng định điều gì đã xảy ra; chỉ hỏi.',
  '- Bước 1: gọi quet_cac_nam cho chu_de phu_the, quan_loc và tai_bach với các năm đã qua, từ năm đương số 18 tuổi âm đến năm âm lịch trước năm nay; mỗi lần tối đa 15 năm, gọi song song.',
  '- Bước 2: chọn đúng 3 năm có tín hiệu mạnh nhất (tốt hoặc xấu), ưu tiên mỗi năm một chủ đề khác nhau. Gọi hoi_nguoi_dung với 3 câu hỏi, mỗi câu một năm: nhãn là năm dương lịch (ví dụ "2019"); nội dung nêu năm âm lịch kèm khoảng dương lịch và loại việc có thể đã xảy ra, hỏi trung tính (ví dụ "có thay đổi lớn về tình cảm như quen người mới, cưới hay chia tay không?"); lựa chọn: "Đúng", "Gần đúng (lệch một năm)", "Không đúng". Không nêu tên sao.',
  '- Đương số dưới 20 tuổi âm thì nói thẳng là chưa đủ chuyện đã qua để kiểm chứng, không đặt câu hỏi.',
  '- Bước 3, sau khi người dùng trả lời: nói ngắn lá số khớp mấy trên 3 năm và ý nghĩa của từng năm. Khớp từ 1 năm trở xuống thì nói thẳng có thể giờ sinh chưa chuẩn và gợi ý kiểm tra lại giờ sinh; không giải thích gượng cho khớp. Mời người dùng kể thêm mốc thật (năm cưới, năm đổi việc, năm mua nhà) để các mục khác luận sát hơn.',
  '- Người dùng muốn thêm một lượt thì chọn 3 năm khác, không hỏi lại năm đã hỏi.',
].join('\n');
