'use client';
import type { Palace, Star } from '@/lib/ziwei/types';
import { viStar, viPalace, viStem, viBranch, viSiHua } from '@/lib/vn/terms';
import { starMeta, brightnessVN, TUAN_KEYS, TRIET_KEYS } from '@/lib/vn/star-meta';
import clsx from 'clsx';

interface PalaceCellProps {
  palace: Palace;
  onClick?: () => void;
  onStarClick?: (star: Star) => void;
  isSelected?: boolean;
  isSanFang?: boolean;
  /** (giữ cho tương thích; lá số mới không chạy hiệu ứng từng ô) */
  delay?: number;
  /** Tứ Hóa lớp phủ: tên sao → '禄'/'权'/'科'/'忌' */
  overlayStarSiHua?: Record<string, string>;
  /** Nhãn lớp phủ: 'Niên' (lưu niên) hoặc 'Hạn' (đại hạn) */
  overlayLabel?: string;
  onSiHuaClick?: (starName: string, siHua: string) => void;
  /** Tuần / Triệt nằm trên ranh giới giữa ô này và ô bên phải (right) hoặc ô bên dưới (bottom) */
  markers?: CellMarker[];
}

export interface CellMarker {
  kind: 'tuan' | 'triet';
  side: 'right' | 'bottom';
  title: string;
}

const SIHUA_CLASS: Record<string, string> = {
  '禄': 'ls-hoa-loc',
  '权': 'ls-hoa-quyen',
  '科': 'ls-hoa-khoa',
  '忌': 'ls-hoa-ky',
};

function SiHuaChip({ siHua, overlay, label, onClick }: {
  siHua: string; overlay?: boolean; label?: string; onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <span
      className={clsx('ls-hoa', SIHUA_CLASS[siHua], overlay && 'ls-hoa-overlay')}
      onClick={onClick}
      title={overlay && label ? `Hóa ${viSiHua(siHua)} (${label === 'Hạn' ? 'đại hạn' : 'lưu niên'})` : `Hóa ${viSiHua(siHua)}`}
    >
      {overlay && label ? `${label} ` : ''}{viSiHua(siHua)}
    </span>
  );
}

function Bright({ raw }: { raw?: string }) {
  const b = brightnessVN(raw);
  if (!b) return null;
  return <span className="ls-bright" title={b.full}>{b.short}</span>;
}

export default function PalaceCell({
  palace, onClick, onStarClick, isSelected, isSanFang,
  overlayStarSiHua, overlayLabel, onSiHuaClick, markers,
}: PalaceCellProps) {
  const { branch, stem, name, stars, daXianAge, isCurrentDaXian, isMingGong, isShenGong } = palace;

  const visible = stars.filter(s => !TUAN_KEYS.has(s.name) && !TRIET_KEYS.has(s.name));
  const majors = visible.filter(s => s.type === 'major');
  const others = visible.filter(s => s.type !== 'major');
  const goods = others.filter(s => starMeta(s.name).good);
  const bads = others.filter(s => !starMeta(s.name).good);

  const renderMinor = (s: Star) => {
    const ov = overlayStarSiHua?.[s.name];
    return (
      <span key={s.name} className={clsx('ls-minor', `ls-h-${starMeta(s.name).hanh}`)}>
        {viStar(s.name)}
        <Bright raw={s.brightnessRaw} />
        {s.siHua && <SiHuaChip siHua={s.siHua} />}
        {ov && (
          <SiHuaChip siHua={ov} overlay label={overlayLabel}
            onClick={e => { e.stopPropagation(); onSiHuaClick?.(s.name, ov); }} />
        )}
      </span>
    );
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={`Cung ${viPalace(name)} tại ${viBranch(branch)}`}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } }}
      className={clsx(
        'palace-cell ls-cell',
        isMingGong && 'ls-cell-menh',
        isSanFang && 'ls-cell-sanfang',
        isSelected && 'ls-cell-selected',
        isCurrentDaXian && 'ls-cell-daxian',
      )}
    >
      {/* Dòng đầu: can chi · tên cung · số đại hạn */}
      <div className="ls-head">
        <span className="ls-ganzhi">{viStem(stem)} {viBranch(branch)}</span>
        <span className="palace-cell-name ls-pname">
          {viPalace(name)}
          {isShenGong && <span className="ls-than" title="Cung Thân đóng ở đây">Thân</span>}
        </span>
        {daXianAge && <span className={clsx('ls-dx', isCurrentDaXian && 'ls-dx-now')} title={`Đại hạn ${daXianAge[0]}–${daXianAge[1]} tuổi`}>{daXianAge[0]}</span>}
      </div>

      {/* Chính tinh */}
      <div className="ls-majors">
        {majors.length === 0 && <span className="ls-empty">Vô chính diệu</span>}
        {majors.map(star => {
          const ov = overlayStarSiHua?.[star.name];
          return (
            <div key={star.name} className="ls-major-row">
              <span
                className={clsx('ls-major', `ls-h-${starMeta(star.name).hanh}`)}
                onClick={e => { e.stopPropagation(); onStarClick?.(star); }}
              >
                {viStar(star.name)}
              </span>
              <Bright raw={star.brightnessRaw} />
              {star.siHua && <SiHuaChip siHua={star.siHua} />}
              {ov && (
                <SiHuaChip siHua={ov} overlay label={overlayLabel}
                  onClick={e => { e.stopPropagation(); onSiHuaClick?.(star.name, ov); }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Phụ tinh: cát bên trái, hung bên phải */}
      <div className="ls-minors">
        <div className="ls-col ls-col-good">{goods.map(renderMinor)}</div>
        <div className="ls-col ls-col-bad">{bads.map(renderMinor)}</div>
      </div>

      {(['right', 'bottom'] as const).map(side => {
        const ms = markers?.filter(m => m.side === side);
        if (!ms?.length) return null;
        return (
          <div key={side} className={`ls-markers ls-markers-${side}`}>
            {ms.map(m => (
              <span key={m.kind} className={clsx('ls-marker', m.kind === 'triet' && 'ls-marker-triet')} title={m.title}>
                {m.kind === 'tuan' ? 'Tuần' : 'Triệt'}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}
