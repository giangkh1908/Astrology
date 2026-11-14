'use client';
import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import s from '@/app/landing.module.css';

/** Hợp bàn minh họa với hai người mẫu: chọn kiểu quan hệ để xem cung nào được đặt cạnh nhau. Dữ liệu viết sẵn. */
const MODES = [
  {
    label: 'Tình duyên',
    a: [['Mệnh', 'Vũ Khúc hóa Kỵ, Thiên Tướng'], ['Phu Thê', 'Tham Lang, Kình Dương']],
    b: [['Mệnh', 'Vô chính diệu, mượn Thiên Cơ, Thiên Lương'], ['Phu Thê', 'Lộc Tồn, Thiên Mã']],
    score: 72,
    note: 'Lan thẳng và quyết, Minh mềm và hay cân nhắc, hai tính bù cho nhau. Phu Thê của Lan có Kình Dương nên dễ va chạm lời nói; Minh coi trọng ổn định. Nên thống nhất sớm chuyện tiền bạc và chỗ ở.',
  },
  {
    label: 'Làm ăn chung',
    a: [['Quan Lộc', 'Tử Vi hóa Quyền'], ['Tài Bạch', 'Liêm Trinh, Thiên Phủ']],
    b: [['Quan Lộc', 'Thái Dương hóa Lộc, Cự Môn'], ['Tài Bạch', 'Vô chính diệu, mượn Thiên Đồng, Thái Âm']],
    score: 81,
    note: 'Lan hợp đứng ra quyết định và giữ tiền, Minh mạnh về giao tiếp và mở khách. Chia vai rõ ràng thì hợp tác thuận: Lan giữ sổ sách, Minh lo khách hàng.',
  },
  {
    label: 'Bạn bè',
    a: [['Mệnh', 'Vũ Khúc hóa Kỵ, Thiên Tướng'], ['Nô Bộc', 'Vô chính diệu, mượn Thiên Đồng, Cự Môn']],
    b: [['Mệnh', 'Vô chính diệu, mượn Thiên Cơ, Thiên Lương'], ['Nô Bộc', 'Thiên Tướng, Địa Kiếp']],
    score: 64,
    note: 'Hợp tính để làm bạn, nhưng cung Nô Bộc của cả hai đều không mạnh: dễ hiểu lầm vì lời nói và hao tiền vì nhau. Nên tránh cho vay qua lại.',
  },
];
const PEOPLE = [
  { name: 'Lan', meta: 'nữ, sinh năm 1992' },
  { name: 'Minh', meta: 'nam, sinh năm 1990' },
];

export default function HemingDemo() {
  const reduce = useReducedMotion();
  const [k, setK] = useState(0);
  const m = MODES[k];
  const enter = reduce ? { opacity: 0 } : { opacity: 0, y: 8 };

  return (
    <div className={s.demo}>
      <p className={s.chatNote}>Ví dụ minh họa, chọn kiểu quan hệ để thử</p>
      <div className={s.tabs} role="tablist" aria-label="Kiểu quan hệ">
        {MODES.map((x, i) => (
          <button key={x.label} type="button" role="tab" aria-selected={i === k} onClick={() => setK(i)} className={`${s.tab} ${i === k ? s.tabOn : ''}`}>
            {x.label}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={k} initial={enter} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
          <div className={s.pair}>
            {[m.a, m.b].map((rows, i) => (
              <div key={i} className={s.pairCard}>
                <p className={s.pairWho}>{PEOPLE[i].name}</p>
                <p className={s.pairMeta}>{PEOPLE[i].meta}</p>
                {rows.map(([palace, stars]) => (
                  <div key={palace} className={s.pairRow}>
                    <span className={s.pairPalace}>{palace}</span>
                    <span className={s.pairStars}>{stars}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className={s.meter} aria-label={`Mức hợp ${m.score} trên 100`}>
            <span>Mức hợp</span>
            <span className={s.meterBar}>
              <motion.span className={s.meterFill} initial={{ width: 0 }} animate={{ width: `${m.score}%` }} transition={{ duration: reduce ? 0 : 0.8, ease: 'easeOut' }} />
            </span>
            <strong>{m.score}</strong>
          </div>
          <div className={s.reply}>
            <p>{m.note}</p>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
