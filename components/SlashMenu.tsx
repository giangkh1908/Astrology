'use client';
import { useEffect, useRef } from 'react';
import type { SlashCommand } from '@/lib/chat/slash-commands';

interface SlashMenuProps {
  id: string;
  items: SlashCommand[];
  activeIndex: number;
  /** Mục đã luận (hiện chấm) */
  isDone: (cmd: SlashCommand) => boolean;
  onHover: (index: number) => void;
  onPick: (cmd: SlashCommand) => void;
}

/** Danh sách gợi ý lệnh "/" nổi phía trên ô nhập, kiểu Claude Code */
export default function SlashMenu({ id, items, activeIndex, isDone, onHover, onPick }: SlashMenuProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, items]);

  return (
    <div className="ls-slash" role="presentation">
      <div ref={listRef} id={id} role="listbox" aria-label="Lệnh" className="ls-slash-list">
        {items.length === 0 ? (
          <div className="ls-slash-empty">Không có lệnh phù hợp</div>
        ) : items.map((cmd, i) => (
          <div
            key={cmd.name}
            id={`${id}-${i}`}
            data-index={i}
            role="option"
            aria-selected={i === activeIndex}
            className="ls-slash-item"
            onMouseEnter={() => onHover(i)}
            // mousedown để ô nhập không mất focus trước khi chọn
            onMouseDown={e => { e.preventDefault(); onPick(cmd); }}
          >
            <span className="ls-slash-name">/{cmd.name}</span>
            <span className="ls-slash-hint">
              {cmd.group === 'action' ? cmd.hint : `${cmd.label} · ${cmd.hint}`}
            </span>
            {isDone(cmd) && <span className="ls-slash-dot" aria-label="đã luận" />}
          </div>
        ))}
      </div>
      <div className="ls-slash-foot">↑↓ chọn · Enter mở · Tab điền · Esc đóng</div>
    </div>
  );
}
