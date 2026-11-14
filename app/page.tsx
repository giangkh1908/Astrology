import Link from 'next/link';
import PalaceBoard from '@/components/landing/PalaceBoard';
import HemingDemo from '@/components/landing/HemingDemo';
import KinhDichDemo from '@/components/landing/KinhDichDemo';
import ChatDemo from '@/components/landing/ChatDemo';
import ThemeSwitch from '@/components/landing/ThemeSwitch';
import s from './landing.module.css';

export default function Home() {
  return (
    <div className={s.root}>
      <header className={s.nav}>
        <div className={`${s.wrap} ${s.navInner}`}>
          <Link href="/" className={s.brand}>Tử Vi Đẩu Số</Link>
          <nav className={s.navLinks} aria-label="Chức năng">
            <Link href="/chart">Lá số</Link>
            <Link href="/heming">Hợp bàn</Link>
            <Link href="/kinh-dich">Kinh Dịch</Link>
            <Link href="/knowledge">Kiến thức</Link>
            <Link href="/library">Cổ thư</Link>
          </nav>
          <div className={s.navEnd}>
            <ThemeSwitch className={s.switch} />
            <Link href="/chart" className={`${s.btn} ${s.btnSmall}`}>Lập lá số</Link>
          </div>
        </div>
      </header>

      <main>
        <section className={`${s.wrap} ${s.hero}`}>
          <PalaceBoard />
        </section>

        <section className={s.section}>
          <div className={`${s.wrap} ${s.split}`}>
            <div>
              <h2 className={s.h2}>Hợp bàn hai người</h2>
              <p className={s.sectionLede}>Đặt lá số hai người cạnh nhau, xem cung nào hợp, cung nào vướng.</p>
              <p className={s.point}>
                <strong>Chọn đúng kiểu quan hệ</strong>
                Tình duyên xem Mệnh và Phu Thê, làm ăn xem Quan Lộc và Tài Bạch, bạn bè xem Nô Bộc. Mỗi kiểu đặt những cung khác nhau lên bàn.
              </p>
              <p className={s.point}>
                <strong>Có AI giải thích</strong>
                Không chỉ cho một con số: AI nói rõ hai người bù nhau ở đâu và nên lưu ý chuyện gì.
              </p>
              <Link href="/heming" className={s.btnGhost}>Hợp bàn hai người</Link>
            </div>
            <HemingDemo />
          </div>
        </section>

        <section className={s.section}>
          <div className={`${s.wrap} ${s.split} ${s.splitFlip}`}>
            <div>
              <h2 className={s.h2}>Gieo quẻ Kinh Dịch</h2>
              <p className={s.sectionLede}>Hỏi một việc cụ thể, tự tay gieo ba đồng xu sáu lần.</p>
              <p className={s.point}>
                <strong>Làm rõ câu hỏi trước</strong>
                AI hỏi lại cho câu hỏi đủ cụ thể rồi mới mời bạn gieo, vì quẻ chỉ trả lời đúng điều được hỏi.
              </p>
              <p className={s.point}>
                <strong>Quẻ chính, hào động, quẻ biến</strong>
                Kèm lời kinh bản dịch Ngô Tất Tố để đối chiếu, AI giải thích bằng lời thường và trả lời tiếp khi bạn hỏi thêm.
              </p>
              <Link href="/kinh-dich" className={s.btnGhost}>Gieo quẻ</Link>
            </div>
            <KinhDichDemo />
          </div>
        </section>

        <section className={s.section}>
          <div className={`${s.wrap} ${s.split}`}>
            <div>
              <h2 className={s.h2}>Hỏi lại trước khi luận</h2>
              <p className={s.sectionLede}>Câu hỏi càng rõ, lời luận càng sát. AI không đoán thay bạn.</p>
              <p className={s.point}>
                <strong>Thẻ câu hỏi có sẵn lựa chọn</strong>
                Khi chưa rõ hỏi cho ai, việc gì, lúc nào, AI đưa thẻ để bạn chọn nhanh. Trả lời thẻ không tính lượt.
              </p>
              <p className={s.point}>
                <strong>Xem vận theo từng ba tháng</strong>
                Luận theo khung ba tháng âm lịch, dời sang ba tháng trước hoặc sau chỉ bằng một nút.
              </p>
              <p className={s.point}>
                <strong>Nhớ điều bạn đã kể</strong>
                Những gì bạn kể ở cung này được dùng khi hỏi sang cung khác của cùng lá số. Lịch sử lưu theo tài khoản.
              </p>
            </div>
            <ChatDemo />
          </div>
        </section>

        <section className={s.section}>
          <div className={s.wrap}>
            <h2 className={s.h2}>Tính đúng trước, rồi mới luận</h2>
            <p className={s.sectionLede}>Lá số sai một giờ là sai cả mệnh bàn, nên phần tính toán được làm kỹ.</p>
            <dl className={s.facts}>
              <div>
                <dt>Lịch âm Việt Nam</dt>
                <dd>Ngày âm, tháng nhuận và Tết tính theo múi giờ UTC+7, khớp với lịch Việt Nam đang dùng.</dd>
              </div>
              <div>
                <dt>Giờ mặt trời thật</dt>
                <dd>Chỉnh giờ sinh theo kinh độ nơi sinh, tránh trường hợp sinh sát ranh giới hai giờ bị an sai cung.</dd>
              </div>
              <div>
                <dt>Giờ đồng hồ của thời đó</dt>
                <dd>Người sinh trong những năm Việt Nam từng đổi múi giờ được quy đúng về giờ thật lúc sinh, theo miền Bắc hay miền Nam.</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className={s.closing}>
          <div className={`${s.wrap} ${s.closingInner}`}>
            <div>
              <h2 className={s.h2}>Bắt đầu từ ngày giờ sinh</h2>
              <div className={s.closingLinks}>
                <Link href="/knowledge">Đọc kiến thức Tử Vi cơ bản</Link>
                <Link href="/library">Mở kho cổ thư</Link>
              </div>
            </div>
            <Link href="/chart" className={s.btn}>Lập lá số</Link>
          </div>
        </section>
      </main>

      <footer className={s.footer}>
        <div className={s.wrap}>
          <p>Nội dung chỉ để tham khảo và học tập, không thay cho tư vấn y tế, tài chính, pháp lý hay các quyết định quan trọng.</p>
          <p>
            Dựa trên dự án mã nguồn mở ziwei-doushu (MIT):{' '}
            <a href="https://github.com/Renhuai123/ziwei-doushu" target="_blank" rel="noopener noreferrer">github.com/Renhuai123/ziwei-doushu</a>.
            Lời kinh Kinh Dịch theo bản dịch của Ngô Tất Tố.
          </p>
          <p className={s.footerLinks}>
            <Link href="/terms">Điều khoản dịch vụ</Link>
            <Link href="/privacy">Chính sách bảo mật</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
