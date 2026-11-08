# Purple Star Astrology

Ứng dụng web lập và tra cứu lá số Tử Vi Đẩu Số, với giao diện tiếng Việt. Dự án sử dụng Next.js, React và TypeScript; phần luận giải AI chạy qua API phía máy chủ.

## Tính năng

- Lập lá số theo thông tin ngày, giờ và nơi sinh; hỗ trợ lịch âm, múi giờ và giờ mặt trời thật.
- Xem các cung, sao, tứ hóa, đại hạn và lưu niên; tra cứu kiến thức và cổ thư Tử Vi.
- Luận giải lá số và phân tích hợp duyên bằng AI khi máy chủ được cấu hình khóa OpenRouter.

Tử Vi và nội dung do AI tạo ra chỉ mang tính tham khảo; kết quả có thể khác nhau tùy trường phái và cách nhập thông tin.

## Chạy trên máy

Yêu cầu Node.js 22 trở lên và npm. Tại thư mục dự án:

```bash
npm ci
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000). Trên Windows, có thể dùng `npm.cmd` thay cho `npm` nếu PowerShell chặn lệnh.

### Cấu hình AI

Sao chép `.env.example` thành `.env.local`, rồi điền `OPENROUTER_API_KEY`. Có thể điều chỉnh `OPENROUTER_MODEL` và `NEXT_PUBLIC_SITE_URL` trong cùng tệp. Không cần khóa AI để lập lá số; các chức năng luận giải AI cần khóa hợp lệ. Giữ `.env.local` ở máy chủ và không đưa khóa lên Git.

## Kiểm tra và build

```bash
npm run harness:quick  # Kiểm tra đăng ký test, kiểu dữ liệu và regression
npm run harness        # Các bước trên và production build
npm run build          # Chỉ build ứng dụng
npm start              # Chạy bản đã build
```

Xem [hướng dẫn kiểm thử](docs/harness/README.md) để biết phạm vi và giới hạn của bộ kiểm tra.

## Cấu trúc dự án

| Thư mục | Nội dung |
| --- | --- |
| `app/` | Các trang Next.js và API luận giải |
| `components/` | Các thành phần giao diện |
| `lib/ziwei/`, `lib/vn/` | Tính lá số, lịch và thuật ngữ tiếng Việt |
| `lib/ai/`, `lib/prompts/` | Tích hợp AI và nội dung hướng dẫn luận giải |
| `lib/classics/`, `docs/` | Dữ liệu cổ thư và tài liệu tham khảo |
| `scripts/regression/` | Các bài kiểm thử hồi quy |

## Bản quyền và nguồn dữ liệu

Mã nguồn dựa trên dự án Tử Vi mã nguồn mở được cấp phép MIT; xem thông báo bản quyền và điều khoản trong [NOTICE](NOTICE). Tài liệu Thiên Kỷ trong dự án có [điều khoản riêng](docs/tianji-ziwei/LICENSE.md).
