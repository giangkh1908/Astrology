'use client';
/** Render AI markdown: **【Title】** → gold header, **bold** → strong. Đang stream thì nhả chữ mượt (useSmoothText). */
import { useEffect } from 'react';
import { useSmoothText } from './useSmoothText';

export default function AiContent({ text, streaming, onReveal }: { text: string; streaming?: boolean; onReveal?: () => void }) {
  const shown = useSmoothText(text, !!streaming);
  // Báo cho khung chat cuộn theo chữ vừa hiện (chữ hiện chậm hơn lúc dữ liệu về).
  useEffect(() => { onReveal?.(); }, [shown]); // eslint-disable-line react-hooks/exhaustive-deps
  const lines = shown.split('\n');
  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => {
        const sectionMatch = line.match(/^\*\*【(.+?)】\*\*$/);
        if (sectionMatch) {
          return (
            <div key={i} className="pt-3 pb-0.5 first:pt-0">
              <span className="text-[11px] font-semibold tracking-wide" style={{ color: 'var(--t-gold)' }}>
                【{sectionMatch[1]}】
              </span>
            </div>
          );
        }
        if (line.trim() === '') return <div key={i} className="h-1" />;
        const parts = line.split(/\*\*(.+?)\*\*/);
        return (
          <div key={i} className="text-[11px] leading-relaxed" style={{ color: 'var(--t-text2)' }}>
            {parts.map((part, j) =>
              j % 2 === 0
                ? part
                : <strong key={j} className="font-medium" style={{ color: 'var(--t-text)' }}>{part}</strong>
            )}
          </div>
        );
      })}
      {streaming && (
        <span
          className="inline-block w-1.5 h-3 ml-0.5 animate-pulse rounded-sm align-middle"
          style={{ background: 'var(--t-gold)', opacity: 0.6 }}
        />
      )}
    </div>
  );
}
