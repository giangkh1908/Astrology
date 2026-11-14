'use client';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import s from '@/app/landing.module.css';

/**
 * Gieo quẻ minh họa: kết quả viết sẵn (Địa Phong Thăng, động hào 3, biến Địa Thủy Sư),
 * đồng xu chỉ lật cho vui mắt. Thứ tự hào từ dưới lên; 6/9 là hào động.
 */
// Quẻ Thăng: dưới Tốn (âm, dương, dương), trên Khôn (âm, âm, âm); hào 3 là dương động
const LINES: (6 | 7 | 8 | 9)[] = [8, 7, 9, 8, 8, 8];
const COINS: [number, number, number][] = [[2, 3, 3], [3, 2, 2], [3, 3, 3], [2, 3, 3], [3, 3, 2], [2, 3, 3]];

const QUESTION = 'Tháng tới có nên nhận lời chuyển sang chỗ làm mới không?';

function Line({ v, n }: { v: 6 | 7 | 8 | 9; n: number }) {
  const yang = v === 7 || v === 9;
  const moving = v === 6 || v === 9;
  return (
    <div className={`${s.hexLine} ${moving ? s.hexMoving : ''}`} aria-label={`Hào ${n}: ${yang ? 'dương' : 'âm'}${moving ? ', động' : ''}`}>
      {yang ? <span className={s.bar} /> : <><span className={s.bar} /><span className={s.bar} /></>}
      <span className={s.hexMark}>{moving ? (yang ? '○' : '×') : ''}</span>
    </div>
  );
}

export default function KinhDichDemo() {
  const reduce = useReducedMotion();
  const [count, setCount] = useState(0);
  const [flipping, setFlipping] = useState(false);
  const [auto, setAuto] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cast = () => {
    if (flipping || count >= 6) return;
    if (reduce) { setCount(c => c + 1); return; }
    setFlipping(true);
    timer.current = setTimeout(() => { setCount(c => c + 1); setFlipping(false); }, 650);
  };

  useEffect(() => {
    if (!auto || flipping) return;
    if (count >= 6) { setAuto(false); return; }
    const t = setTimeout(cast, reduce ? 120 : 250);
    return () => clearTimeout(t);
  });
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const reset = () => { setCount(0); setAuto(false); setFlipping(false); };
  const done = count >= 6;
  const faces = count > 0 ? COINS[count - 1] : null;

  return (
    <div className={s.demo}>
      <p className={s.chatNote}>Ví dụ minh họa, bấm để gieo thử</p>
      <div className={s.bubble}>{QUESTION}</div>

      <div className={s.castArea}>
        <div className={s.coins} aria-hidden="true">
          {[0, 1, 2].map(i => (
            <motion.span
              key={`${count}-${i}`}
              className={`${s.coin} ${!flipping && faces?.[i] === 3 ? s.coinHead : ''}`}
              animate={flipping ? { rotateY: [0, 540], y: [0, -18, 0] } : { rotateY: 0, y: 0 }}
              transition={{ duration: 0.6, delay: i * 0.05 }}
            >
              {flipping || !faces ? '' : faces[i] === 3 ? 'Ngửa' : 'Sấp'}
            </motion.span>
          ))}
        </div>
        <div className={s.hex}>
          {[5, 4, 3, 2, 1, 0].map(i => (
            <div key={i} className={s.hexSlot}>
              <AnimatePresence>
                {i < count && (
                  <motion.div initial={reduce ? { opacity: 0 } : { opacity: 0, scaleX: 0.3 }} animate={{ opacity: 1, scaleX: 1 }} transition={{ duration: 0.3 }}>
                    <Line v={LINES[i]} n={i + 1} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>

      <div className={s.actions}>
        {!done ? (
          <>
            <button type="button" onClick={cast} disabled={flipping || auto} className={s.btnGhost}>Gieo hào {count + 1}/6</button>
            <button type="button" onClick={() => setAuto(true)} disabled={auto} className={s.linkBtn}>Gieo tự động</button>
          </>
        ) : (
          <button type="button" onClick={reset} className={s.linkBtn}>Gieo lại</button>
        )}
      </div>

      <div aria-live="polite">
        <AnimatePresence>
          {done && (
            <motion.div className={s.reply} initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <p className={s.replyHead}>Quẻ Địa Phong Thăng, động hào 3, biến quẻ Địa Thủy Sư</p>
              <p>Thăng là đi lên từng bước như cây mọc từ đất: việc chuyển chỗ làm có đà thuận. Hào 3 động cho thấy cơ hội mở ra dễ hơn bạn nghĩ, nhưng quẻ biến Sư nhắc phải có kỷ luật và người dẫn dắt; nên hỏi rõ ai sẽ là quản lý trực tiếp trước khi nhận lời.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
