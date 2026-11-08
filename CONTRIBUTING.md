*Dịch sang tiếng Việt từ bản tiếng Trung [CONTRIBUTING.md](https://github.com/Renhuai123/ziwei-doushu/blob/main/CONTRIBUTING.md) của dự án gốc.*

# Tham gia đóng góp

Chào mừng bạn đặt câu hỏi, gửi bản sửa lỗi và đưa ra đề xuất. Xin nói rõ hai điều trước, sẽ đỡ qua lại nhiều lần:

- Repo này là **bản chụp mã nguồn mở** của engine lập lá số trên [ouranic.cn](https://ouranic.cn/?from=gh-contrib), được đồng bộ định kỳ từ bản chạy thật (nhịp đồng bộ xem mục «Nhịp bảo trì và đóng góp» trong README).
- Kho đoán ngữ (断语库) của bản trực tuyến không nằm trong repo. Luận giải AI dùng route Next.js; cấu hình trong `.env.local` theo `.env.example`.

## Đặt câu hỏi

- **Cách dùng, muốn trao đổi**: hãy đến [khu thảo luận (Discussions)](https://github.com/Renhuai123/ziwei-doushu/discussions).
- **Cho rằng lá số lập chưa đúng**: dùng mẫu «Thắc mắc về kết quả lập lá số», kèm ngày sinh dương lịch, giờ và phút, nơi sinh hoặc kinh độ, giới tính, kết quả của dự án này và kết quả bạn dùng để đối chiếu. Chỉ viết «không chuẩn» thì chúng tôi không có cách nào kiểm tra.
  - Độ sáng của phụ tinh (辅星亮度), việc tháng nhuận (闰月) thuộc tháng nào, giờ Tý muộn (晚子时) có đổi ngày hay không: các trường phái (流派) vốn dĩ khác nhau, nên engine đã làm thành các cách tính có thể chuyển đổi; những khác biệt kiểu này không phải bug, nhưng vẫn hoan nghênh bạn chỉ ra.
- **Chương trình báo lỗi, trang hiển thị bất thường**: dùng mẫu «Vấn đề chương trình», ghi rõ các bước tái hiện và thông báo lỗi.
- **Vấn đề của trang chính thức (ouranic.cn)**: dùng mẫu «Vấn đề trang chính thức».

Xin đừng dán số điện thoại, mã xác thực, hay thông tin ngày giờ sinh của người khác khi chưa được họ đồng ý vào issue.

## Gửi code

Cần Node.js 22 trở lên. Trên Windows PowerShell:

```powershell
npm.cmd ci
npm.cmd run dev
```

Trước khi gửi PR, chạy:

```powershell
npm.cmd run harness
```

- Mỗi PR chỉ làm một việc; phần mô tả cần nói rõ đã sửa gì và vì sao.
- **Thay đổi kết quả lập lá số**: kèm bằng chứng đối chiếu (nguồn trích, hoặc ảnh chụp từ phần mềm lập lá số khác), đồng thời thêm regression test vào `scripts/regression/` và đăng ký vào script `test` trong `package.json`. Thay đổi cách tính mà không có nguồn thường sẽ không được nhận.
- CI chạy harness khi push lên `main`, mỗi PR và khi kích hoạt thủ công. Xem [hướng dẫn harness](docs/harness/README.md).

## Giấy phép

Gửi đóng góp đồng nghĩa với việc bạn đồng ý để nội dung đóng góp được phát hành theo giấy phép tương ứng:

- Code: [MIT](./LICENSE)
- Dataset mẫu: [CC BY 4.0](./DATASET-LICENSE)
- Thư mục lời nguyên văn của Nghê sư `docs/tianji-ziwei/`: [CC BY-NC-SA 4.0](./docs/tianji-ziwei/LICENSE.md), không được dùng cho mục đích thương mại

---

**English.** Issues and PRs are welcome. This repo is an open snapshot of the charting engine behind ouranic.cn; the proprietary interpretation database is not included. The Next.js AI route is configured in `.env.local` as shown in `.env.example`. For a chart you believe is wrong, please use the "Chart result question" form with full birth data and a reference result. Before opening a PR, run `npm ci` and `npm run harness`; changes to chart results need evidence and a regression test.
