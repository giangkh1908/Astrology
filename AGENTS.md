# Hướng dẫn làm việc cho agent

Áp dụng cho toàn bộ `ziwei-doushu/`. Ưu tiên yêu cầu cụ thể của người dùng; không thay đổi hoặc xóa công việc sẵn có ngoài phạm vi được giao.

## Quy trình

1. Đọc mã, test và tài liệu liên quan trước khi sửa; xác định hành vi hiện tại và rủi ro.
2. Chọn thay đổi nhỏ nhất giải quyết yêu cầu. Không refactor toàn bộ hoặc sửa hành vi không liên quan.
3. Viết regression test cho lỗi hoặc hành vi thay đổi; chạy các test liên quan, sau đó `npm run harness` khi có thể.
4. Review lại thay đổi theo `docs/harness/review.md`; báo rõ lệnh đã chạy, kết quả, hạn chế và rủi ro còn lại. Không khẳng định test chưa chạy là đã đạt.
5. Không in, lưu hoặc gửi API key, hội thoại hay dữ liệu ngày sinh thật vào test, log, fixture hoặc issue. Dùng dữ liệu giả.

## Kiến trúc và clean OOP

- Logic nghiệp vụ nên thuần và độc lập I/O; tên interface, hàm và kiểu dữ liệu mô tả năng lực, không mang tên nhà cung cấp.
- Với tích hợp ngoài mới hoặc khi chủ động refactor tích hợp: cân nhắc port nhỏ, adapter riêng, một điểm chọn cấu hình và fake để test. Tránh lộ SDK/provider trong nghiệp vụ. Không bọc framework, chuẩn mở hoặc code chỉ dùng một lần nếu không có lợi ích kiểm thử hay thay thế thực tế.
- Ưu tiên composition, không tạo hệ kế thừa, registry hoặc retry framework để dự phòng. Chỉ gom plumbing thực sự lặp lại; giữ nguyên timeout, retry, lỗi và hợp đồng khi refactor.
- Tích hợp OpenRouter hiện tại nằm trực tiếp trong route; đây là nợ kiến trúc đã biết, không phải lý do tự ý thay đổi hành vi khi làm nhiệm vụ khác.
- Server kiểm tra input không tin cậy; tránh log dữ liệu nhạy cảm, có giới hạn tải và xử lý lỗi/cancel khi làm việc với API hoặc stream.

## Quy tắc nghiệp vụ

- Ngày âm, giờ Tý, giờ mặt trời thật, múi giờ lịch sử, tháng nhuận và trường phái có thể làm đổi kết quả. Không coi khác biệt trường phái là bug khi chưa xác định cấu hình.
- Nếu thay đổi cách lập lá số: nêu nguồn, điều kiện, ví dụ đối chiếu và thêm regression test bao gồm ranh giới. Không bịa nguồn hoặc coi Tử Vi là kết luận khoa học.
- Giữ bản quyền, giấy phép dữ liệu và dữ liệu gốc. Không đưa dữ liệu thật vào fixture.

## Lệnh và tài liệu

Chạy từ `ziwei-doushu/` với Node.js 22+: `npm ci`, `npm run harness:quick` (kiểm tra đăng ký test + typecheck + regression), `npm run harness` (quick + production build). Windows PowerShell có thể dùng `npm.cmd`. Xem `docs/harness/README.md` để biết phạm vi và giới hạn.
