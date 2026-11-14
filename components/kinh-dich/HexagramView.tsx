'use client';
/**
 * Hiện quẻ chính → quẻ biến (vẽ từ trên xuống: hào 6 ở trên cùng), đánh dấu hào động và trọng tâm,
 * kèm lời kinh tra từ dữ liệu (gập/mở được) và dòng ghi nguồn bắt buộc.
 */
import { lineName, type Cast, type HexInfo, type LineValue } from '@/lib/kinh-dich/core';
import { ATTRIBUTION, DICH_SO_URL, hexagramText } from '@/lib/kinh-dich/texts';

const FOCUS_LABEL: Record<Cast['focus']['kind'], string> = {
  judgment: 'Không có hào động: xem lời quẻ (Thoán) của quẻ chính.',
  lines: 'Xem hào động của quẻ chính; hào trên cùng trong số hào động làm chủ.',
  'both-judgments': 'Ba hào động: xem lời quẻ của cả quẻ chính và quẻ biến.',
  'changed-static-lines': 'Bốn–năm hào động: xem các hào tĩnh của quẻ biến; hào tĩnh dưới cùng làm chủ.',
  'use-all': 'Sáu hào động: xem lời "Dụng" của quẻ.',
  'changed-judgment': 'Sáu hào động: xem lời quẻ của quẻ biến.',
};

function Line({ yang, moving, focus, value }: { yang: boolean; moving?: boolean; focus?: boolean; value?: LineValue }) {
  const color = focus ? 'var(--t-gold)' : 'var(--t-text)';
  const bar = { height: 8, borderRadius: 2, background: color, opacity: focus ? 1 : 0.75 };
  return (
    <div className="flex items-center gap-2" style={{ height: 14 }}>
      <div className="flex gap-2" style={{ width: 96 }}>
        {yang ? <div style={{ ...bar, flex: 1 }} /> : <><div style={{ ...bar, flex: 1 }} /><div style={{ ...bar, flex: 1 }} /></>}
      </div>
      <span className="text-[10px] w-4 text-center" style={{ color: 'var(--t-gold)' }} aria-hidden>
        {moving ? (value === 9 ? '○' : '×') : ''}
      </span>
    </div>
  );
}

function Figure({ hex, cast, which }: { hex: HexInfo; cast: Cast; which: 'main' | 'changed' }) {
  const focusLines = cast.focus.of === which ? cast.focus.lines : [];
  const rows = [6, 5, 4, 3, 2, 1];
  return (
    <figure className="flex flex-col items-center gap-1" aria-label={`Quẻ ${hex.name}`}>
      <figcaption className="text-center mb-1">
        <div className="text-[10px] tracking-wide" style={{ color: 'var(--t-faint)' }}>{which === 'main' ? 'Quẻ chính' : 'Quẻ biến'}</div>
        <div className="text-sm font-medium" style={{ color: 'var(--t-text)' }}>{hex.number}. {hex.name}</div>
        <div className="text-[11px]" style={{ color: 'var(--t-faint)' }}>{hex.hanzi} · {hex.upper} trên {hex.lower}</div>
      </figcaption>
      {rows.map(n => (
        <Line
          key={n}
          yang={hex.bits[n - 1] === '1'}
          moving={which === 'main' && cast.moving.includes(n)}
          value={cast.lines[n - 1]}
          focus={focusLines.includes(n)}
        />
      ))}
    </figure>
  );
}

function TextBlock({ title, children, open }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="rounded-lg px-3 py-2" style={{ border: '1px solid var(--t-border)' }}>
      <summary className="cursor-pointer text-[11px] font-medium" style={{ color: 'var(--t-gold)' }}>{title}</summary>
      <div className="mt-2 space-y-2 text-[11px] leading-relaxed" style={{ color: 'var(--t-text2)' }}>{children}</div>
    </details>
  );
}

function HexTexts({ hex, cast, which }: { hex: HexInfo; cast: Cast; which: 'main' | 'changed' }) {
  const t = hexagramText(hex.number);
  const focusLines = cast.focus.of === which ? cast.focus.lines : [];
  const judgmentFocus = cast.focus.kind === 'judgment' && which === 'main'
    || cast.focus.kind === 'both-judgments'
    || cast.focus.kind === 'changed-judgment' && which === 'changed';
  return (
    <TextBlock title={`Lời kinh quẻ ${hex.name}`} open={which === 'main'}>
      <p className={judgmentFocus ? 'font-medium' : ''} style={judgmentFocus ? { color: 'var(--t-text)' } : undefined}>
        <span style={{ color: 'var(--t-faint)' }}>Thoán: </span>{t.judgment}
      </p>
      <p><span style={{ color: 'var(--t-faint)' }}>Tượng: </span>{t.image}</p>
      {[6, 5, 4, 3, 2, 1].map(n => {
        const l = t.lines[n - 1];
        const isFocus = focusLines.includes(n);
        const isPrimary = isFocus && cast.focus.primary === n;
        return (
          <div key={n} className="pl-2" style={{ borderLeft: `2px solid ${isFocus ? 'var(--t-gold)' : 'transparent'}` }}>
            <div style={{ color: isFocus ? 'var(--t-text)' : 'var(--t-faint)' }}>
              Hào {n} · {lineName(hex, n)}{isPrimary ? ' · hào chủ' : isFocus ? ' · trọng tâm' : ''}
            </div>
            <div className={isFocus ? 'font-medium' : ''} style={isFocus ? { color: 'var(--t-text)' } : undefined}>{l.textHV}</div>
            {l.gloss && <div>{l.gloss}</div>}
          </div>
        );
      })}
      {t.extra && (
        <div className="pl-2" style={{ borderLeft: `2px solid ${cast.focus.kind === 'use-all' && which === 'main' ? 'var(--t-gold)' : 'transparent'}` }}>
          <div style={{ color: 'var(--t-faint)' }}>Dụng</div>
          <div>{t.extra.textHV}</div>
          {t.extra.gloss && <div>{t.extra.gloss}</div>}
        </div>
      )}
    </TextBlock>
  );
}

export default function HexagramView({ cast }: { cast: Cast }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-center gap-6">
        <Figure hex={cast.main} cast={cast} which="main" />
        {cast.changed && (
          <>
            <div className="self-center text-lg" style={{ color: 'var(--t-faint)' }} aria-hidden>→</div>
            <Figure hex={cast.changed} cast={cast} which="changed" />
          </>
        )}
      </div>
      <p className="text-center text-[11px]" style={{ color: 'var(--t-text2)' }}>
        {cast.moving.length ? `Hào động: ${cast.moving.join(', ')} (○ dương già, × âm già). ` : ''}{FOCUS_LABEL[cast.focus.kind]}
      </p>
      <HexTexts hex={cast.main} cast={cast} which="main" />
      {cast.changed && <HexTexts hex={cast.changed} cast={cast} which="changed" />}
      <p className="text-[10px] leading-relaxed" style={{ color: 'var(--t-faint)' }}>
        {ATTRIBUTION} — <a href={DICH_SO_URL} target="_blank" rel="noopener noreferrer" className="underline">nguồn</a>
      </p>
    </section>
  );
}
