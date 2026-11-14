'use client';
import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import s from '@/app/landing.module.css';

/**
 * 12 cung đặt đúng vị trí địa chi trên mệnh bàn truyền thống (Tỵ góc trên trái).
 * Mệnh ở Dần, các cung sau đi nghịch: Huynh Đệ ở Sửu, Phu Thê ở Tý… Thiên Di đối Mệnh ở Thân.
 * `i` là thứ tự cung: tam hợp là i±4, xung chiếu là i+6.
 * `stars`: chính tinh của một lá số mẫu viết sẵn ('Tên:Hóa|Tên'), chỉ để minh họa.
 */
type Palace = { name: string; stars: string; branch: string; about: string; detail: string; ask: string; row: number; col: number; i: number };
const PALACES: Palace[] = [
  { i: 0, name: 'Mệnh', stars: 'Vũ Khúc:Kỵ|Thiên Tướng', branch: 'Dần', row: 4, col: 1, about: 'Bản thân, tính cách',
    detail: 'Cung gốc của cả lá số: tính cách, sở trường, cách bạn phản ứng với đời. Mọi cung khác đều đọc trong tương quan với Mệnh.',
    ask: 'Tôi hợp với kiểu công việc nào?' },
  { i: 1, name: 'Huynh Đệ', stars: 'Thiên Đồng|Cự Môn', branch: 'Sửu', row: 4, col: 2, about: 'Anh chị em',
    detail: 'Quan hệ với anh chị em, người ngang hàng thân thiết, và cả cách bạn hợp tác ở quy mô nhỏ.',
    ask: 'Tôi có nên góp vốn làm ăn với anh trai không?' },
  { i: 2, name: 'Phu Thê', stars: 'Tham Lang', branch: 'Tý', row: 4, col: 3, about: 'Vợ chồng, người yêu',
    detail: 'Người bạn đời hợp với bạn, cách bạn yêu, và những giai đoạn tình cảm dễ thuận hay dễ vướng.',
    ask: 'Sắp tới tôi có người yêu không?' },
  { i: 3, name: 'Tử Tức', stars: 'Thái Âm', branch: 'Hợi', row: 4, col: 4, about: 'Con cái',
    detail: 'Duyên con cái, quan hệ với con, và cả những người trẻ bạn dìu dắt.',
    ask: 'Năm nay có nên sinh thêm con không?' },
  { i: 4, name: 'Tài Bạch', stars: 'Liêm Trinh|Thiên Phủ', branch: 'Tuất', row: 3, col: 4, about: 'Tiền bạc',
    detail: 'Cách bạn kiếm tiền và giữ tiền: nguồn thu ổn định hay thất thường, hợp làm công hay tự kinh doanh.',
    ask: 'Ba tháng tới tài chính của tôi thế nào?' },
  { i: 5, name: 'Tật Ách', stars: '', branch: 'Dậu', row: 2, col: 4, about: 'Sức khỏe',
    detail: 'Thể trạng, những phần cơ thể cần để ý, và các giai đoạn nên giữ sức.',
    ask: 'Tôi nên chú ý sức khỏe mặt nào?' },
  { i: 6, name: 'Thiên Di', stars: 'Phá Quân', branch: 'Thân', row: 1, col: 4, about: 'Đi xa, ra ngoài',
    detail: 'Đối diện cung Mệnh: con người bạn khi ra ngoài xã hội, đi xa, chuyển chỗ ở hay làm việc nơi khác.',
    ask: 'Tôi có nên đi làm ở nước ngoài không?' },
  { i: 7, name: 'Nô Bộc', stars: '', branch: 'Mùi', row: 1, col: 3, about: 'Bạn bè, cộng sự',
    detail: 'Bạn bè, đồng nghiệp, cấp dưới: ai giúp được bạn và ai dễ kéo bạn xuống.',
    ask: 'Đồng nghiệp mới có đáng tin không?' },
  { i: 8, name: 'Quan Lộc', stars: 'Tử Vi:Quyền', branch: 'Ngọ', row: 1, col: 2, about: 'Công việc, sự nghiệp',
    detail: 'Con đường sự nghiệp, ngành nghề hợp, và thời điểm nên giữ việc hay chuyển việc.',
    ask: 'Có nên nhảy việc trong năm nay không?' },
  { i: 9, name: 'Điền Trạch', stars: 'Thiên Cơ', branch: 'Tỵ', row: 1, col: 1, about: 'Nhà cửa, đất đai',
    detail: 'Nhà cửa, đất đai, không khí gia đình nơi bạn sống.',
    ask: 'Bao giờ tôi nên mua nhà?' },
  { i: 10, name: 'Phúc Đức', stars: 'Thất Sát', branch: 'Thìn', row: 2, col: 1, about: 'Phúc phần, tinh thần',
    detail: 'Đời sống tinh thần, sự an vui trong lòng, và phúc phần từ dòng họ.',
    ask: 'Vì sao dạo này tôi hay bất an?' },
  { i: 11, name: 'Phụ Mẫu', stars: 'Thái Dương|Thiên Lương:Lộc', branch: 'Mão', row: 3, col: 1, about: 'Cha mẹ, bề trên',
    detail: 'Quan hệ với cha mẹ, cấp trên và những người có quyền với bạn, cả chuyện giấy tờ.',
    ask: 'Quan hệ với sếp sắp tới có ổn không?' },
];
const byIndex = (i: number) => PALACES.find(p => p.i === ((i % 12) + 12) % 12)!;
const starsOf = (p: Palace) => (p.stars ? p.stars.split('|').map(x => { const [name, hua] = x.split(':'); return { name, hua }; }) : []);
const related = (p: Palace) => ({ trine: [byIndex(p.i + 4), byIndex(p.i + 8)], opposite: byIndex(p.i + 6) });

type Pt = { x: number; y: number };

export default function PalaceBoard() {
  const reduce = useReducedMotion();
  const boardRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const [selected, setSelected] = useState<number | null>(null);
  const [demo, setDemo] = useState<number | null>(null);
  const [touched, setTouched] = useState(false);
  const [centers, setCenters] = useState<Record<number, Pt>>({});

  // Tâm từng ô, đo lại khi bàn đổi kích thước
  const measure = useCallback(() => {
    const board = boardRef.current;
    if (!board) return;
    const b = board.getBoundingClientRect();
    const next: Record<number, Pt> = {};
    for (const p of PALACES) {
      const el = cellRefs.current[p.i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      next[p.i] = { x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2 };
    }
    setCenters(next);
  }, []);
  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (boardRef.current) ro.observe(boardRef.current);
    return () => ro.disconnect();
  }, [measure]);

  // Khi chưa ai bấm: tự lướt qua các cung để gợi ý bàn này bấm được
  useEffect(() => {
    if (touched || reduce) return;
    let k = 0;
    const start = setTimeout(() => setDemo(0), 1300);
    const tick = setInterval(() => { k = (k + 1) % 12; setDemo(k); }, 2600);
    return () => { clearTimeout(start); clearInterval(tick); };
  }, [touched, reduce]);

  const pick = (i: number) => {
    setTouched(true);
    setDemo(null);
    setSelected(cur => (cur === i ? null : i));
  };
  const close = () => setSelected(null);

  useEffect(() => {
    if (selected === null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const focus = selected ?? demo;
  const focusP = focus === null ? null : byIndex(focus);
  const rel = focusP ? related(focusP) : null;
  const roleOf = (p: Palace) => {
    if (!focusP || !rel) return '';
    if (p.i === focusP.i) return s.cellFocus;
    if (p.i === rel.opposite.i) return s.cellOpp;
    if (rel.trine.some(t => t.i === p.i)) return s.cellTrine;
    return s.cellDim;
  };

  // Tam giác tam hợp + đường xung chiếu
  const lines: { d: string; kind: 'trine' | 'opp' }[] = [];
  if (focusP && rel) {
    const a = centers[focusP.i], b = centers[rel.trine[0].i], c = centers[rel.trine[1].i], o = centers[rel.opposite.i];
    if (a && b && c) lines.push({ d: `M${a.x} ${a.y}L${b.x} ${b.y}L${c.x} ${c.y}Z`, kind: 'trine' });
    if (a && o) lines.push({ d: `M${a.x} ${a.y}L${o.x} ${o.y}`, kind: 'opp' });
  }

  const shown = selected === null ? null : byIndex(selected);

  return (
    <div className={s.board} ref={boardRef}>
      {PALACES.map(p => (
        <button
          key={p.name}
          type="button"
          ref={el => { cellRefs.current[p.i] = el; }}
          onClick={() => pick(p.i)}
          aria-pressed={selected === p.i}
          aria-label={`Cung ${p.name}, ${p.about}`}
          className={`${s.cell} ${p.i === 0 ? s.cellMenh : ''} ${roleOf(p)}`}
          style={{ gridRow: p.row, gridColumn: p.col, '--i': p.i } as CSSProperties}
        >
          <span className={s.branch}>{p.branch}</span>
          <span className={s.palace}>{p.name}</span>
          <span className={s.stars}>
            {starsOf(p).length
              ? starsOf(p).map(st => <span key={st.name} className={s.star}>{st.name}{st.hua && <em className={s.hua}>{st.hua}</em>}</span>)
              : <span className={s.borrow}>Vô chính diệu</span>}
          </span>
          <span className={s.about}>{p.about}</span>
          {rel && focusP && p.i !== focusP.i && (p.i === rel.opposite.i || rel.trine.some(t => t.i === p.i)) && (
            <span className={s.tag}>{p.i === rel.opposite.i ? 'xung chiếu' : 'tam hợp'}</span>
          )}
        </button>
      ))}

      <svg className={s.lines} aria-hidden="true">
        <AnimatePresence>
          {lines.map(l => (
            <motion.path
              key={`${focus}-${l.kind}`}
              d={l.d}
              className={l.kind === 'trine' ? s.lineTrine : s.lineOpp}
              initial={reduce ? { opacity: 0 } : { pathLength: 0, opacity: 0 }}
              animate={reduce ? { opacity: 1 } : { pathLength: 1, opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              transition={{ duration: reduce ? 0.15 : 0.7, ease: 'easeInOut' }}
            />
          ))}
        </AnimatePresence>
      </svg>

      <div className={s.centerVoid} aria-hidden="true" />
      <div className={s.center} aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          {shown ? (
            <motion.div
              key={shown.name}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <p className={s.palaceKicker}>Lá số mẫu, cung ở {shown.branch}</p>
              <h2 className={s.palaceTitle}>{shown.name}</h2>
              <p className={s.lede}>{shown.detail}</p>
              <p className={s.palaceRel}>
                Chính tinh: {starsOf(shown).length ? starsOf(shown).map(st => st.name + (st.hua ? ` hóa ${st.hua}` : '')).join(', ') : 'không có, mượn sao cung đối'}.
              </p>
              <p className={s.palaceRel}>
                Khi luận cung này, AI xem cùng {related(shown).trine.map(t => t.name).join(' và ')} (tam hợp) và {related(shown).opposite.name} (xung chiếu).
              </p>
              <p className={s.palaceAsk}>Ví dụ câu hỏi: “{shown.ask}”</p>
              <div className={s.actions}>
                <Link href="/chart" className={s.btn}>Lập lá số của bạn</Link>
                <button type="button" onClick={close} className={s.btnGhost}>Đóng</button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="intro"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, delay: touched ? 0 : 0.5 }}
            >
              <h1 className={s.h1}>Mười hai cung, đọc cho đúng việc của bạn</h1>
              <p className={s.lede}>
                Lập lá số Tử Vi theo lịch âm Việt Nam, hợp bàn hai người, gieo quẻ Kinh Dịch. AI luận giải và hỏi lại khi chưa rõ bạn cần gì.
              </p>
              <div className={s.actions}>
                <Link href="/chart" className={s.btn}>Lập lá số</Link>
                <Link href="/kinh-dich" className={s.btnGhost}>Gieo quẻ Kinh Dịch</Link>
              </div>
              <p className={s.hint}>Đây là một lá số mẫu. Bấm vào một cung để xem sao và ý nghĩa.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
