export const metadata = {
  title: 'Điều khoản sử dụng · Tử Vi Đẩu Số',
  description: 'Điều khoản sử dụng của Tử Vi Đẩu Số: nội dung mang tính tham khảo, giải trí và nghiên cứu văn hóa.',
};

const h2 = { fontSize: 18, marginTop: 32, marginBottom: 12 } as const;

export default function TermsPage() {
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
        <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8 }}>Điều khoản sử dụng</h1>
        <p style={{ fontSize: 12, color: 'var(--tx-3)', marginBottom: 32 }}>Cập nhật lần cuối: tháng 11/2026</p>

        <h2 style={h2}>1. Mục đích của nội dung</h2>
        <p>
          Lá số và các phần luận giải trên site chỉ mang tính tham khảo, giải trí và nghiên cứu văn hóa.
          Chúng không phải là lời khẳng định về tương lai, và không thay thế tư vấn chuyên môn về y tế, pháp lý, tài chính hay tâm lý.
          Mọi quyết định quan trọng là trách nhiệm của chính bạn.
        </p>

        <h2 style={h2}>2. Phạm vi dịch vụ</h2>
        <p>
          Đây là công cụ mã nguồn mở, miễn phí, tính toán qua máy chủ. Không có tài khoản, thanh toán hay hội viên.
          Dịch vụ được cung cấp &quot;nguyên trạng&quot;, không bảo đảm luôn sẵn sàng hay hoàn toàn chính xác.
        </p>

        <h2 style={h2}>3. Giấy phép và nguồn trích dẫn</h2>
        <ul style={{ paddingLeft: 24 }}>
          <li>Mã nguồn: giấy phép MIT.</li>
          <li>Nội dung trích dẫn từ Nghê Hải Hạ: giấy phép CC BY-NC-SA 4.0 (ghi công, phi thương mại, chia sẻ tương tự).</li>
        </ul>
        <p>Khi sử dụng lại, vui lòng giữ nguyên ghi công và tuân thủ điều kiện của từng giấy phép.</p>

        <h2 style={h2}>4. Giới hạn trách nhiệm</h2>
        <p>Chúng tôi không chịu trách nhiệm về thiệt hại phát sinh từ việc dựa vào nội dung trên site.</p>

        <h2 style={h2}>5. Thay đổi</h2>
        <p>Điều khoản có thể được cập nhật khi dự án thay đổi. Phiên bản mới nhất luôn nằm tại trang này.</p>
      </main>
    </>
  );
}
