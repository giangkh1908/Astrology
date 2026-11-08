# Checklist review

Đánh giá theo mức độ ảnh hưởng; mỗi phát hiện cần có file/dòng, điều kiện tái hiện, hậu quả và hướng xử lý. Ưu tiên lỗi thực tế, không nêu giả thuyết như sự thật.

## Đúng chức năng

- [ ] Thay đổi đáp ứng yêu cầu, giữ hợp đồng và xử lý input sai, giá trị rỗng, ranh giới, lỗi và hủy.
- [ ] Test chứng minh hành vi, có ca lỗi và không phụ thuộc thời gian/dịch vụ thật nếu không cần.
- [ ] Với kết quả lá số, ghi rõ cấu hình trường phái và nguồn đối chiếu; kiểm tra các ranh giới có liên quan.

## OOP và tích hợp

- [ ] Nghiệp vụ dùng tên trung lập và không phụ thuộc trực tiếp vendor khi có port hợp lý; chọn provider tại một nơi.
- [ ] Port chỉ có hành vi cần dùng; fake kiểm tra nghiệp vụ, test adapter kiểm tra giao thức và ánh xạ lỗi.
- [ ] Không tạo abstraction, registry, lớp cha hay retry dùng một lần chỉ để dự phòng; không thay đổi hành vi khi refactor.

## An toàn và trải nghiệm

- [ ] API validates input và giới hạn tài nguyên phù hợp; không lộ key hoặc dữ liệu nhạy cảm trong client/log/lỗi.
- [ ] Đã xem xét dữ liệu lưu trữ, quyền riêng tư, stream bị ngắt và lỗi nhà cung cấp.
- [ ] UI có trạng thái tải/lỗi, có thể dùng bằng bàn phím và không khẳng định luận giải là sự thật khoa học.

## Bàn giao

- [ ] Liệt kê lệnh thực sự chạy, kết quả, test chưa chạy và rủi ro còn lại; cập nhật tài liệu khi hành vi hoặc cách chạy thay đổi.
