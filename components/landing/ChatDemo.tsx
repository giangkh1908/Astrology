'use client';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import s from '@/app/landing.module.css';

/** Khung chat minh họa: tự chạy khi cuộn tới, bấm lựa chọn trong thẻ hỏi lại để xem câu trả lời đổi theo. */
const OPTIONS = [
  {
    label: 'Giữ hay đổi việc',
    head: 'Tháng 4 đến tháng 6 âm lịch',
    text: 'Đại hạn đi qua cung Quan Lộc, có Tả Phụ hỗ trợ. Giai đoạn này nên giữ việc hiện tại và nhận thêm phần trách nhiệm được giao; người giúp bạn là cấp trên trực tiếp.',
  },
  {
    label: 'Xin tăng lương',
    head: 'Tháng 5 âm lịch là lúc thuận',
    text: 'Cung Tài Bạch được Hóa Lộc chiếu vào giữa khung ba tháng. Nên chuẩn bị kết quả cụ thể từ tháng 4 và đề xuất vào tháng 5, tránh đầu tháng 6 khi cung Nô Bộc gặp sát tinh.',
  },
  {
    label: 'Tự kinh doanh',
    head: 'Chưa nên bắt đầu ngay',
    text: 'Thiên Di và Tài Bạch đều yếu trong ba tháng tới. Nên dùng giai đoạn này để thử quy mô nhỏ bên cạnh việc chính, xem lại vào khung tháng 7 đến tháng 9.',
  },
];

type Step = 0 | 1 | 2 | 3 | 4; // 0 trống, 1 câu hỏi, 2 đang gõ, 3 thẻ hỏi lại, 4 đã có câu trả lời

export default function ChatDemo() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const [step, setStep] = useState<Step>(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    if (!inView) return;
    if (reduce) { setStep(3); return; }
    const t = [
      setTimeout(() => setStep(1), 200),
      setTimeout(() => setStep(2), 900),
      setTimeout(() => setStep(3), 2000),
    ];
    return () => t.forEach(clearTimeout);
  }, [inView, reduce]);

  const choose = (k: number) => {
    setChoice(k);
    if (reduce) { setStep(4); return; }
    setTyping(true);
    setStep(4);
    setTimeout(() => setTyping(false), 900);
  };

  const enter = reduce ? { opacity: 0 } : { opacity: 0, y: 8 };
  const opt = choice === null ? null : OPTIONS[choice];

  return (
    <div className={s.chat} ref={ref} aria-label="Ví dụ một lượt hỏi, bấm lựa chọn để thử">
      <p className={s.chatNote}>Ví dụ minh họa, bấm một lựa chọn để thử</p>
      <AnimatePresence>
        {step >= 1 && (
          <motion.div key="q" className={s.bubble} initial={enter} animate={{ opacity: 1, y: 0 }}>
            Sắp tới công việc của tôi thế nào?
          </motion.div>
        )}
        {step === 2 && (
          <motion.div key="dots" className={s.dots} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <span /><span /><span />
          </motion.div>
        )}
        {step >= 3 && (
          <motion.div key="ask" className={s.askCard} initial={enter} animate={{ opacity: 1, y: 0 }}>
            <p className={s.askQ}>Bạn đang cân nhắc việc gì?</p>
            <div className={s.opts}>
              {OPTIONS.map((o, k) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => choose(k)}
                  aria-pressed={choice === k}
                  className={`${s.opt} ${choice === k ? s.optOn : ''}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <p className={s.askFoot}>Trả lời thẻ này không tính lượt hỏi.</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div aria-live="polite">
        <AnimatePresence mode="wait">
          {step === 4 && typing && (
            <motion.div key="typing" className={s.dots} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <span /><span /><span />
            </motion.div>
          )}
          {step === 4 && !typing && opt && (
            <motion.div key={opt.label} className={s.reply} initial={enter} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <p className={s.replyHead}>{opt.head}</p>
              <p>{opt.text}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
