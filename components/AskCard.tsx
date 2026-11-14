'use client';
/**
 * Thẻ "AI hỏi lại trước khi luận" (prompt v3), theo cách AskUserQuestion của Claude Code:
 * tab mỗi câu + tab Gửi, lựa chọn có giải thích, "Tự nhập…", chọn nhiều, phím tắt; khung chat bên dưới vẫn gõ được.
 */
import { useEffect, useRef, useState } from 'react';
import { formatAnswers, SKIP_ANSWER, type AskPayload } from '@/lib/ai/ask-user';

interface AskCardProps {
  ask: AskPayload;
  /** Nội dung tin người dùng gửi sau thẻ (đã trả lời / bỏ qua / nhắn thẳng) → hiện thu gọn, chỉ đọc. */
  answered?: string;
  onSubmit(text: string): void;
  onSkip(): void;
  disabled?: boolean;
}

interface Pick { picked: number[]; custom: string; customOn: boolean }

const ANSWER_PREFIX = 'Trả lời câu hỏi:';

/** Đáp án từng câu đọc lại từ tin trả lời (theo thứ tự dòng "- nhãn: đáp án"). */
function parseAnswered(ask: AskPayload, answered: string): string[] {
  if (answered.trim() === SKIP_ANSWER) return ask.cau_hoi.map(() => 'bỏ qua');
  if (!answered.startsWith(ANSWER_PREFIX)) return ask.cau_hoi.map(() => 'bỏ qua (bạn đã nhắn trực tiếp)');
  const lines = answered.split('\n').slice(1).map(l => l.replace(/^-\s*/, ''));
  return ask.cau_hoi.map((q, i) => {
    const line = lines[i] ?? '';
    return line.startsWith(`${q.nhan}:`) ? line.slice(q.nhan.length + 1).trim() : line || 'bỏ qua';
  });
}

/** Tin người dùng ngay sau thẻ có cần hiện bong bóng không (thẻ thu gọn đã hiện đáp án thì thôi). */
export function isCardAnswer(text: string): boolean {
  return text.startsWith(ANSWER_PREFIX) || text.trim() === SKIP_ANSWER;
}

export default function AskCard({ ask, answered, onSubmit, onSkip, disabled }: AskCardProps) {
  const n = ask.cau_hoi.length;
  const [tab, setTab] = useState(0); // n = tab Gửi
  const [focus, setFocus] = useState(0);
  const [picks, setPicks] = useState<Pick[]>(() => ask.cau_hoi.map(() => ({ picked: [], custom: '', customOn: false })));
  const rootRef = useRef<HTMLDivElement>(null);
  const customRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (answered === undefined) rootRef.current?.focus({ preventScroll: true }); }, [answered]);
  useEffect(() => { if (tab < n && picks[tab].customOn) customRef.current?.focus(); }, [tab, picks, n]);

  if (answered !== undefined) {
    const values = parseAnswered(ask, answered);
    return (
      <div className="rounded-lg px-3 py-2 text-[11px]" style={{ border: '1px solid var(--t-border)', color: 'var(--t-faint)' }}>
        <p className="mb-1">{ask.loi_dan}</p>
        {ask.cau_hoi.map((q, i) => (
          <p key={i} className="leading-relaxed">
            <span style={{ color: 'var(--t-text2)' }}>{q.noi_dung}</span>{' '}
            <span style={{ color: 'var(--t-gold)' }}>→ {values[i]}</span>
          </p>
        ))}
      </div>
    );
  }

  const answerOf = (i: number): string[] | null => {
    const p = picks[i];
    const chosen = p.picked.map(k => ask.cau_hoi[i].lua_chon[k].tieu_de);
    if (p.customOn && p.custom.trim()) chosen.push(p.custom.trim());
    return chosen.length ? chosen : null;
  };
  const done = (i: number) => answerOf(i) !== null;
  const goTab = (t: number) => { setTab(Math.max(0, Math.min(n, t))); setFocus(0); };
  const update = (i: number, fn: (p: Pick) => Pick) => setPicks(ps => ps.map((p, k) => (k === i ? fn(p) : p)));

  const choose = (k: number) => {
    if (disabled || tab >= n) return;
    const q = ask.cau_hoi[tab];
    const isCustom = k === q.lua_chon.length;
    setFocus(k);
    if (q.chon_nhieu) {
      update(tab, p => (isCustom ? { ...p, customOn: !p.customOn } : {
        ...p, picked: p.picked.includes(k) ? p.picked.filter(x => x !== k) : [...p.picked, k].sort((a, b) => a - b),
      }));
      return;
    }
    if (isCustom) { update(tab, p => ({ ...p, picked: [], customOn: true })); return; }
    update(tab, p => ({ ...p, picked: [k], customOn: false }));
    goTab(tab + 1);
  };

  const submit = () => { if (!disabled) onSubmit(formatAnswers(ask, ask.cau_hoi.map((_, i) => answerOf(i)))); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    const inCustom = e.target === customRef.current;
    if (e.key === 'Escape') { e.preventDefault(); if (!disabled) onSkip(); return; }
    if (inCustom) {
      if (e.key === 'Enter') { e.preventDefault(); goTab(tab + 1); }
      return; // còn lại là gõ chữ
    }
    const count = tab < n ? ask.cau_hoi[tab].lua_chon.length + 1 : 0;
    if (e.key === 'Tab' || e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      goTab(tab + (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey) ? -1 : 1));
      return;
    }
    if (tab === n) { if (e.key === 'Enter') { e.preventDefault(); submit(); } return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocus((focus + 1) % count); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setFocus((focus - 1 + count) % count); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (ask.cau_hoi[tab].chon_nhieu && done(tab)) goTab(tab + 1); else choose(focus);
      return;
    }
    const digit = Number(e.key);
    if (Number.isInteger(digit) && digit >= 1 && digit <= count) { e.preventDefault(); choose(digit - 1); }
  };

  const q = tab < n ? ask.cau_hoi[tab] : null;
  const tabStyle = (on: boolean) => ({
    color: on ? 'var(--t-gold)' : 'var(--t-faint)',
    borderBottom: on ? '1px solid var(--t-gold)' : '1px solid transparent',
  });

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      role="group"
      aria-label="AI hỏi thêm trước khi luận"
      className="rounded-lg text-[11px] focus:outline-none"
      style={{ border: '1px solid rgba(212,168,67,0.3)', background: 'rgba(212,168,67,0.04)', opacity: disabled ? 0.6 : 1 }}
    >
      <p className="px-3 pt-2.5 pb-1.5" style={{ color: 'var(--t-text)' }}>{ask.loi_dan}</p>

      <div className="flex flex-wrap gap-x-3 px-3" role="tablist" style={{ borderBottom: '1px solid var(--t-border)' }}>
        {ask.cau_hoi.map((c, i) => (
          <button key={i} role="tab" aria-selected={tab === i} onClick={() => goTab(i)} className="py-1" style={tabStyle(tab === i)}>
            {done(i) ? '✔ ' : '☐ '}{c.nhan}
          </button>
        ))}
        <button role="tab" aria-selected={tab === n} onClick={() => goTab(n)} className="py-1" style={tabStyle(tab === n)}>Gửi</button>
      </div>

      {q ? (
        <div className="px-3 py-2">
          <p className="mb-1.5" style={{ color: 'var(--t-text)' }}>
            {q.noi_dung}{q.chon_nhieu && <span style={{ color: 'var(--t-faint)' }}> (chọn được nhiều)</span>}
          </p>
          <div className="space-y-0.5" role={q.chon_nhieu ? 'group' : 'radiogroup'}>
            {[...q.lua_chon, { tieu_de: 'Tự nhập…', giai_thich: undefined }].map((o, k) => {
              const isCustom = k === q.lua_chon.length;
              const on = isCustom ? picks[tab].customOn : picks[tab].picked.includes(k);
              return (
                <div key={k}>
                  <button
                    type="button"
                    role={q.chon_nhieu ? 'checkbox' : 'radio'}
                    aria-checked={on}
                    disabled={disabled}
                    onClick={() => choose(k)}
                    onMouseEnter={() => setFocus(k)}
                    className="w-full text-left rounded px-2 py-1 flex gap-2"
                    style={{ background: focus === k ? 'rgba(212,168,67,0.08)' : 'transparent' }}
                  >
                    <span style={{ color: 'var(--t-faint)' }}>{focus === k ? '›' : ' '} {k + 1}.</span>
                    <span className="flex-1">
                      <span style={{ color: on ? 'var(--t-gold)' : 'var(--t-text)' }}>
                        {q.chon_nhieu ? (on ? '☑ ' : '☐ ') : ''}{o.tieu_de}
                      </span>
                      {o.giai_thich && <span className="block text-[10px]" style={{ color: 'var(--t-faint)' }}>{o.giai_thich}</span>}
                    </span>
                  </button>
                  {isCustom && picks[tab].customOn && (
                    <input
                      ref={customRef}
                      value={picks[tab].custom}
                      onChange={e => update(tab, p => ({ ...p, custom: e.target.value }))}
                      placeholder="Gõ câu trả lời của bạn rồi Enter"
                      className="ml-8 mt-1 w-[calc(100%-2rem)] rounded px-2 py-1 text-[11px] focus:outline-none"
                      style={{ background: 'var(--t-card)', border: '1px solid var(--t-border)', color: 'var(--t-text)' }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="px-3 py-2 space-y-1">
          {ask.cau_hoi.map((c, i) => (
            <p key={i}>
              <span style={{ color: 'var(--t-text2)' }}>{c.noi_dung}</span>{' '}
              <span style={{ color: done(i) ? 'var(--t-gold)' : 'var(--t-faint)' }}>→ {answerOf(i)?.join(', ') ?? 'bỏ qua'}</span>
            </p>
          ))}
          <button
            type="button"
            disabled={disabled}
            onClick={submit}
            className="mt-1 px-3 py-1.5 rounded-lg font-medium disabled:opacity-40"
            style={{ background: 'rgba(212,168,67,0.15)', border: '1px solid rgba(212,168,67,0.25)', color: 'var(--t-gold)' }}
          >
            Gửi câu trả lời
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 px-3 pb-2 text-[10px]" style={{ color: 'var(--t-faint)' }}>
        <span className="hidden sm:inline">↑↓ chọn · số chọn nhanh · Enter xác nhận · Tab đổi câu · Esc bỏ qua</span>
        <button type="button" disabled={disabled} onClick={onSkip} className="underline disabled:opacity-40">Bỏ qua, cứ luận đi</button>
      </div>
    </div>
  );
}
