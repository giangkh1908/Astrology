'use client';
/**
 * Hiện chữ AI đang stream cho mượt: model gửi về từng mảnh (tiếng Việt hay bị cắt giữa âm tiết, vd "ng" + "ười")
 * và theo từng đợt. Hook giữ chữ trong bộ đệm rồi nhả đều theo nhịp khung hình, chỉ dừng ở ranh giới chữ
 * (khoảng trắng / dấu câu) nên không bao giờ lộ nửa chữ; backlog lớn thì tự tăng tốc để không trễ model quá ~1 giây.
 * Hết stream (active = false) thì hiện toàn bộ ngay.
 */
import { useEffect, useRef, useState } from 'react';

/** Tốc độ nền (ký tự/giây) khi bộ đệm ít. ~45 ký tự ≈ 9 chữ tiếng Việt mỗi giây. */
export const BASE_CPS = 45;
/** Đuổi kịp backlog trong khoảng thời gian này (giây). */
export const CATCH_UP_SECONDS = 0.8;

const BOUNDARY = /[\s.,;:!?…)\]}"'”’»\-–—]/u;

/**
 * Độ dài được phép hiện khi muốn nhả thêm tới `want` ký tự: lùi về ranh giới chữ gần nhất ≤ want.
 * `final` = stream đã xong, phần đuôi coi như trọn chữ. Không có ranh giới mới thì giữ nguyên `shown`.
 */
export function revealUpTo(target: string, shown: number, want: number, final: boolean): number {
  const limit = Math.min(want, target.length);
  if (limit <= shown) return shown;
  if (final && limit === target.length) return limit;
  for (let i = limit; i > shown; i--) {
    // Cắt sau ký tự ranh giới, hoặc ngay trước ký tự ranh giới (chữ đứng trước nó đã trọn).
    if (BOUNDARY.test(target[i - 1]) || (i < target.length && BOUNDARY.test(target[i]))) return i;
  }
  return shown;
}

/** Đang stream: giấu cặp ** chưa đóng (và dấu * lẻ ở cuối) để chữ không nhảy khi in đậm hoàn tất. */
export function hideOpenMarkdown(text: string): string {
  // Tiêu đề **【…】** đang viết dở ở dòng cuối: giấu cả dòng để không hiện chữ thường rồi mới nhảy sang tiêu đề vàng.
  let t = text.replace(/(^|\n)\*\*【(?:(?!】\*\*)[^\n])*$/, '$1');
  const count = (t.match(/\*\*/g) ?? []).length;
  if (count % 2 === 1) {
    const at = t.lastIndexOf('**');
    t = t.slice(0, at) + t.slice(at + 2);
  }
  // Một dấu * lẻ ở cuối (nửa đầu của **); cặp ** vừa đóng thì giữ.
  return t.replace(/(?<!\*)\*$/, '');
}

export function useSmoothText(target: string, active: boolean): string {
  const [shownLen, setShownLen] = useState(() => (active ? 0 : target.length));
  const targetRef = useRef(target);
  const activeRef = useRef(active);
  const lenRef = useRef(shownLen);
  const carryRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);

  useEffect(() => {
    // Tin mới thay thế (không nối tiếp phần đã hiện): bắt đầu lại.
    if (!target.startsWith(targetRef.current.slice(0, lenRef.current))) {
      lenRef.current = 0;
      carryRef.current = 0;
      setShownLen(0);
    }
    targetRef.current = target;
    activeRef.current = active;
    if (!active) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastRef.current = null;
      lenRef.current = target.length;
      setShownLen(target.length);
      return;
    }
    if (rafRef.current !== null) return;
    const tick = (ts: number) => {
      const dt = lastRef.current === null ? 16 : Math.min(ts - lastRef.current, 100);
      lastRef.current = ts;
      const t = targetRef.current;
      const backlog = t.length - lenRef.current;
      if (backlog > 0) {
        const cps = Math.max(BASE_CPS, backlog / CATCH_UP_SECONDS);
        carryRef.current += (cps * dt) / 1000;
        const want = lenRef.current + Math.floor(carryRef.current);
        const next = revealUpTo(t, lenRef.current, want, !activeRef.current);
        if (next > lenRef.current) {
          carryRef.current = Math.max(0, carryRef.current - (next - lenRef.current));
          lenRef.current = next;
          setShownLen(next);
        } else if (carryRef.current > 40) {
          carryRef.current = 40; // đang chờ hết một chữ dài: đừng tích tốc độ quá nhiều
        }
      } else {
        carryRef.current = 0;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [target, active]);

  // Dọn khi unmount (StrictMode chạy mount → unmount → mount: phải trả rafRef về null để lần sau chạy lại được).
  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    lastRef.current = null;
  }, []);

  const shown = target.slice(0, Math.min(shownLen, target.length));
  return active ? hideOpenMarkdown(shown) : target;
}
