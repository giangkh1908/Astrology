'use client';

import Link from 'next/link';
import { Fragment, useState } from 'react';
import type { RequestLog } from '@/lib/store/chat-store';
import { StatusBadge } from '../ui';
import s from '../admin.module.css';

const ROUTE_LABEL: Record<string, string> = { interpret: 'Luận giải', heming: 'Hợp bàn' };

function seconds(ms: number | null): string {
  return ms == null ? '–' : `${(ms / 1000).toFixed(1)}s`;
}

function cut(text: string | null, n: number): string {
  if (!text) return '';
  return text.length > n ? `${text.slice(0, n)}…` : text;
}

/** Một dòng log; bấm để mở chi tiết (câu hỏi, câu trả lời, tool call, lỗi). `time` đã định dạng sẵn ở server. */
export function LogRow({ log, time }: { log: RequestLog; time: string }) {
  const [open, setOpen] = useState(false);
  const tokens = log.promptTokens != null || log.completionTokens != null ? `${log.promptTokens ?? 0}/${log.completionTokens ?? 0}` : '–';
  const cost = log.costUsd != null ? `$${log.costUsd.toFixed(4)}` : '';

  return (
    <Fragment>
      <tr className={s.row} onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <td style={{ whiteSpace: 'nowrap' }}>{time}</td>
        <td className={s.hideSm}>{ROUTE_LABEL[log.route] ?? log.route}</td>
        <td>{cut(log.question, 80) || <span className={s.muted}>(trống)</span>}</td>
        <td><span className={s.badge}>{log.promptVersion}</span></td>
        <td className={s.hideSm}>{log.model}</td>
        <td className={s.hideSm} style={{ whiteSpace: 'nowrap' }}>{seconds(log.firstTokenMs)} / {seconds(log.durationMs)}</td>
        <td className={s.hideSm} style={{ whiteSpace: 'nowrap' }}>{tokens} {cost}</td>
        <td><StatusBadge status={log.status} /></td>
      </tr>
      {open && (
        <tr>
          <td colSpan={8} style={{ padding: 0 }}>
            <div className={s.detail}>
              <div className={s.small}>
                {ROUTE_LABEL[log.route] ?? log.route} · {log.model} · chữ đầu {seconds(log.firstTokenMs)} · tổng {seconds(log.durationMs)} · token vào/ra {tokens} {cost}
                {log.chartId && <> · <Link className={s.link} href={`/admin/charts/${log.chartId}`}>Xem lá số</Link></>}
              </div>
              <div><strong className={s.small}>Câu hỏi</strong><p className={s.text}>{log.question || '(trống)'}</p></div>
              <div><strong className={s.small}>Câu trả lời</strong><p className={s.text}>{log.answer || '(chưa có)'}</p></div>
              {log.toolCalls.length > 0 && (
                <div>
                  <strong className={s.small}>Tool call ({log.toolCalls.length})</strong>
                  <pre className={s.pre}>{log.toolCalls.map(t => `${t.name}(${t.arguments})`).join('\n')}</pre>
                </div>
              )}
              {log.error && <div><strong className={s.small}>Lỗi</strong><pre className={s.pre}>{log.error}</pre></div>}
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}
