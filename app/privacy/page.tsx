export const metadata = {
  title: 'Chính sách quyền riêng tư · Tử Vi Đẩu Số',
  description: 'Chính sách quyền riêng tư của Tử Vi Đẩu Số.',
};

const h2 = { fontSize: 18, marginTop: 32, marginBottom: 12 } as const;

export default function PrivacyPage() {
  return (
    <>
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--bg-0)', borderBottom: '1px solid var(--bdr)', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--tx-3)', textDecoration: 'none' }}>
          <span style={{ fontSize: '16px' }}>‹</span>
          <span>Về trang chủ</span>
        </a>
        <div style={{ width: '1px', height: '20px', background: 'var(--bdr-med)' }} />
        <span style={{ fontSize: '12px', color: 'var(--ac)', letterSpacing: '0.1em' }}>Tử Vi Đẩu Số</span>
      </header>
      <main style={{ maxWidth: 800, margin: '0 auto', padding: '60px 24px 80px', color: 'var(--tx-1)', lineHeight: 1.8 }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8 }}>Chính sách quyền riêng tư</h1>
        <p style={{ fontSize: 12, color: 'var(--tx-3)', marginBottom: 32 }}>Cập nhật lần cuối: tháng 11/2026</p>

        <p>Đây là dự án mã nguồn mở. Chúng tôi cố gắng thu thập ít dữ liệu nhất có thể.</p>

        <h2 style={h2}>1. Thông tin lập lá số</h2>
        <p>
          Thông tin bạn nhập (ngày giờ sinh, giới tính, nơi sinh...) được gửi đến máy chủ được cấu hình để lập lá số.
          Ứng dụng không có đăng nhập, thanh toán hay hội viên.
        </p>

        <h2 style={h2}>2. Dữ liệu lưu trên máy bạn</h2>
        <p>
          Một số tùy chọn được lưu trong <code>localStorage</code> của trình duyệt, chỉ nằm trên máy bạn, ví dụ giao diện sáng/tối
          và cấu hình trường phái. Bạn có thể xóa bất cứ lúc nào bằng cách xóa dữ liệu trang web trong trình duyệt.
        </p>

        <h2 style={h2}>3. Phân tích truy cập</h2>
        <p>
          Nếu người triển khai bật, site có thể dùng Vercel Analytics và Speed Insights để thống kê lượt truy cập và hiệu năng ở dạng tổng hợp.
          Các công cụ này không dùng dữ liệu lá số của bạn.
        </p>

        <h2 style={h2}>4. Chia sẻ với bên thứ ba</h2>
        <p>Khi bạn yêu cầu luận giải AI, lá số và câu hỏi được gửi đến nhà cung cấp AI do người triển khai cấu hình. Người triển khai cần cập nhật chính sách này theo dịch vụ và cách lưu trữ thực tế.</p>

        <h2 style={h2}>5. Liên hệ</h2>
        <p>Mọi góp ý hoặc thắc mắc, vui lòng mở issue trên kho mã nguồn của dự án.</p>
      </main>
    </>
  );
}
