'use client';
/**
 * Gieo 3 đồng xu × 6 lần (từ hào 1 lên hào 6): bấm từng lần hoặc gieo tự động.
 * Xu gieo ở trình duyệt; server tự tính lại quẻ từ 6 giá trị. Tôn trọng prefers-reduced-motion.
 */
import { useEffect, useRef, useState } from 'react';
import { castLine, type Coin, type LineValue } from '@/lib/kinh-dich/core';

interface Throw { coins: [Coin, Coin, Coin]; value: LineValue }

const VALUE_LABEL: Record<LineValue, string> = { 6: 'âm già (động)', 7: 'dương trẻ', 8: 'âm trẻ', 9: 'dương già (động)' };

function reducedMotion(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

function CoinFace({ coin, spinning }: { coin: Coin | null; spinning: boolean }) {
  const heads = coin === 3;
  return (
    <div
      className={`flex items-center justify-center rounded-full text-[10px] font-medium ${spinning ? 'animate-spin' : ''}`}
      style={{
        width: 34, height: 34,
        border: '1px solid var(--t-gold)',
        background: coin === null ? 'transparent' : heads ? 'rgba(212,168,67,0.18)' : 'transparent',
        color: 'var(--t-gold)',
      }}
      aria-label={coin === null ? 'chưa gieo' : heads ? 'ngửa' : 'sấp'}
    >
      {coin === null ? '' : heads ? 'Ngửa' : 'Sấp'}
    </div>
  );
}

export default function CoinCaster({ onDone, disabled }: { onDone(lines: LineValue[]): void; disabled?: boolean }) {
  const [throws, setThrows] = useState<Throw[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [auto, setAuto] = useState(false);
  const doneRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  useEffect(() => {
    if (throws.length === 6 && !doneRef.current) {
      doneRef.current = true;
      onDone(throws.map(t => t.value));
    }
  }, [throws, onDone]);

  const throwOnce = () => {
    if (spinning || throws.length >= 6) return;
    const result = castLine();
    const finish = () => {
      setSpinning(false);
      setThrows(t => (t.length >= 6 ? t : [...t, result]));
    };
    if (reducedMotion()) { finish(); return; }
    setSpinning(true);
    timer.current = setTimeout(finish, 450);
  };

  // Gieo tự động: mỗi lần xong thì hẹn lần sau cho đến đủ 6
  useEffect(() => {
    if (!auto || spinning) return;
    if (throws.length >= 6) { setAuto(false); return; }
    timer.current = setTimeout(() => throwOnce(), reducedMotion() ? 0 : 250);
  }, [auto, spinning, throws.length]);

  const next = throws.length + 1;
  const last = throws.at(-1);
  const busy = disabled || spinning || auto || throws.length >= 6;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-center gap-3" aria-live="polite">
        {[0, 1, 2].map(i => <CoinFace key={i} coin={spinning ? null : last?.coins[i] ?? null} spinning={spinning} />)}
      </div>
      {last && !spinning && (
        <p className="text-center text-[11px]" style={{ color: 'var(--t-text2)' }}>
          Hào {throws.length}: tổng {last.value} — {VALUE_LABEL[last.value]}
        </p>
      )}
      {/* 6 hào đã gieo, hào 6 ở trên */}
      <div className="flex flex-col-reverse items-center gap-1">
        {Array.from({ length: 6 }, (_, i) => {
          const t = throws[i];
          return (
            <div key={i} className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--t-faint)', height: 14 }}>
              <span className="w-10 text-right">Hào {i + 1}</span>
              <div className="flex gap-2" style={{ width: 80, opacity: t ? 1 : 0.2 }}>
                {!t || t.value === 7 || t.value === 9
                  ? <div style={{ flex: 1, height: 6, borderRadius: 2, background: t ? 'var(--t-text)' : 'var(--t-border)' }} />
                  : <><div style={{ flex: 1, height: 6, borderRadius: 2, background: 'var(--t-text)' }} /><div style={{ flex: 1, height: 6, borderRadius: 2, background: 'var(--t-text)' }} /></>}
              </div>
              <span className="w-4" style={{ color: 'var(--t-gold)' }}>{t?.value === 9 ? '○' : t?.value === 6 ? '×' : ''}</span>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => throwOnce()}
          className="rounded-full px-4 py-1.5 text-[11px] disabled:opacity-40"
          style={{ border: '1px solid var(--t-gold)', color: 'var(--t-gold)' }}
        >
          {throws.length >= 6 ? 'Đã gieo đủ 6 hào' : `Gieo hào ${next}/6`}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setAuto(true)}
          className="rounded-full px-4 py-1.5 text-[11px] disabled:opacity-40"
          style={{ border: '1px solid var(--t-border)', color: 'var(--t-text2)' }}
        >
          Gieo tự động
        </button>
      </div>
    </div>
  );
}
