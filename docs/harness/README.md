# Harness phát triển Purple Star Astrology

Bộ này kết hợp hướng dẫn agent, kiểm tra tự động và checklist review. Không yêu cầu AI key hoặc dịch vụ AI thật; không đánh giá tính đúng đắn của toàn bộ luận giải Tử Vi.

## Bắt đầu

Từ thư mục `ziwei-doushu/`, dùng Node.js 22 trở lên:

```sh
npm ci
npm run harness:quick
npm run harness
```

Trên Windows PowerShell, nếu `npm` bị chặn bởi execution policy, dùng `npm.cmd`. `harness:quick` kiểm tra mọi file `scripts/regression/*.test.ts` đã được đăng ký trong `npm test`, chạy typecheck rồi toàn bộ regression. `harness` chạy thêm production build. Cả hai dừng ngay khi một bước thất bại. Build có thể cần tài nguyên/mạng tùy môi trường Next.js.

CI tại `.github/workflows/ci.yml` chạy `npm run harness` sau `npm ci`. Chạy `npm audit --omit=dev` riêng khi muốn kiểm tra lỗ hổng production: kết quả phụ thuộc npm registry và thời điểm chạy.

## Quy trình cho người và AI

1. Đọc `AGENTS.md`, phạm vi yêu cầu, mã và test liên quan; nêu giả định nếu cần.
2. Dựng lại lỗi bằng ca test dữ liệu giả. Với lá số, ghi rõ đầu vào, trường phái, múi giờ, nguồn tham chiếu và kết quả mong đợi.
3. Sửa nhỏ, giữ tương thích trừ khi yêu cầu thay đổi; áp dụng clean OOP theo nhu cầu thực tế, không tạo tầng trừu tượng chỉ để có OOP.
4. Thêm test vào `scripts/regression/` và đăng ký trong script `test` của `package.json`; kiểm tra đăng ký sẽ báo file bị bỏ sót. Test mới phải quyết định kết quả bằng exit code khác 0 khi lỗi.
5. Chạy test liên quan rồi chạy harness; nếu không chạy được, nêu chính xác bước bị chặn.
6. Tự review bằng `review.md`; báo kết quả, các rủi ro và giới hạn còn lại.

## Bản đồ kiểm thử

| Thay đổi | Kiểm tra bổ sung cần cân nhắc |
| --- | --- |
| Lịch, giờ, múi giờ, trường phái | Ranh giới ngày/năm, tháng nhuận, giờ Tý, giờ mặt trời thật, mốc lịch sử và lá số đối chiếu có nguồn |
| UI/form | Luồng nhập, validation, thay đổi lá số, mobile, bàn phím và trạng thái lỗi/loading |
| API/AI | Request sai/thiếu/quá lớn, lỗi upstream, stream bị chia byte, hủy request, không lộ bí mật; fake I/O thay vì gọi AI thật |
| Tích hợp ngoài | Hợp đồng port, fake cho nghiệp vụ, test adapter, xử lý lỗi/timeout; không thay đổi retry hay payload âm thầm |
| Riêng tư | Dữ liệu lưu trình duyệt, dữ liệu gửi bên thứ ba, khả năng xóa và nội dung chính sách |

Harness hiện chưa bao gồm lint, browser/E2E, quét bí mật, test bảo mật hay test gọi AI thật. Các kiểm tra này cần được thiết kế riêng trước khi coi là điều kiện bảo đảm triển khai.
