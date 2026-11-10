'use client';
import { apiRequest } from '@/lib/api/client';
import { chartKey } from '@/lib/ziwei/chart-key';
import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import clsx from 'clsx';
import type { ZiweiChart, Palace } from '@/lib/ziwei/types';
import type { TimeView } from './TimeNav';
import { viStar, viPalace, viSiHua } from '@/lib/vn/terms';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  hidden?: boolean; // don't show user bubble for auto/topic messages
  error?: boolean; // thông báo lỗi: không gửi lại cho AI, không lưu
  steps?: string[]; // các bước tra cứu AI đã làm (hiện như Claude Code hiện tool)
  note?: string; // câu trả lời bị gián đoạn giữa chừng: giữ phần đã viết, báo thêm
}

interface SelectedSiHua {
  starName: string;
  siHua: string;
  view: TimeView;
}

interface InsightPanelProps {
  chart: ZiweiChart;
  selectedPalace?: Palace | null;
  selectedSiHua?: SelectedSiHua | null;
  selectedTime?: { view: TimeView; lunarYear: number };
}

const TOPICS = [
  { key: 'overview',     label: 'Mệnh cách' },
  { key: 'love',        label: 'Tình cảm' },
  { key: 'career',      label: 'Sự nghiệp' },
  { key: 'wealth',      label: 'Tài vận' },
  { key: 'health',      label: 'Sức khỏe' },
  { key: 'personality', label: 'Tính cách' },
] as const;

/** Render AI markdown: **【Title】** → gold header, **bold** → strong */
function AiContent({ text, streaming }: { text: string; streaming?: boolean }) {
  const lines = text.split('\n');
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

/** Các bước tra cứu, kiểu Claude Code: đang chạy thì liệt kê từng bước ✓ + "Đang tổng hợp…", xong thì gọn một dòng */
function ToolSteps({ steps, running }: { steps: string[]; running: boolean }) {
  const label = (s: string) => s.replace(/^Đang\s+/, '').replace(/…$/, '');
  const unique = steps.filter((s, i) => steps.indexOf(s) === i).map(label);
  if (running) {
    return (
      <div className="mb-2 space-y-0.5 text-[10px]" style={{ color: 'var(--t-faint)' }}>
        {unique.map(s => <div key={s}>✓ {s.charAt(0).toUpperCase() + s.slice(1)}</div>)}
        <div className="animate-pulse">Đang tổng hợp…</div>
      </div>
    );
  }
  return (
    <p className="text-[10px] mb-2 leading-relaxed" style={{ color: 'var(--t-faint)' }}>
      Đã tra: {unique.map(s => s.charAt(0).toLowerCase() + s.slice(1)).join(' · ')}
    </p>
  );
}

/** Mỗi mục (chủ đề, cung, tứ hóa) là một luồng chat riêng, lưu lại theo lá số */
type ThreadKey = string;
type Threads = Record<ThreadKey, Message[]>;
const TOPIC_KEYS: readonly string[] = TOPICS.map(t => t.key);
const STORE_VERSION = 'v1';

function storageKeyOf(chart: ZiweiChart): string {
  return `ziwei-chat:${STORE_VERSION}:${chartKey(chart.birthInfo)}`;
}

function loadStore(key: string): { threads: Threads; labels: Record<string, string> } {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && typeof d.threads === 'object') {
        const threads: Threads = {};
        for (const [thread, messages] of Object.entries(d.threads)) {
          if (Array.isArray(messages)) threads[thread] = messages.filter((m: Message) => !m.hidden);
        }
        return { threads, labels: d.labels ?? {} };
      }
    }
  } catch { /* trình duyệt chặn bộ nhớ hoặc dữ liệu hỏng: bắt đầu trống */ }
  return { threads: {}, labels: {} };
}

type InsightIntent =
  | { type: 'topic'; key: string }
  | { type: 'palace'; branch: number }
  | { type: 'sihua'; view: string; starName: string; siHua: string };

function intentFor(key: ThreadKey): InsightIntent {
  if (key.startsWith('palace:')) return { type: 'palace', branch: Number(key.slice(7)) };
  if (key.startsWith('sihua:')) {
    const [, view, starName, siHua] = key.split(':');
    return { type: 'sihua', view, starName, siHua };
  }
  return { type: 'topic', key };
}

export default function InsightPanel({ chart, selectedPalace, selectedSiHua, selectedTime }: InsightPanelProps) {
  const storeKey = storageKeyOf(chart);
  const [threads, setThreads] = useState<Threads>({});
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [active, setActive] = useState<ThreadKey>('overview');
  const [streaming, setStreaming] = useState<Record<ThreadKey, boolean>>({});
  const [input, setInput] = useState('');
  const threadsRef = useRef<Threads>({});
  const controllers = useRef<Record<ThreadKey, AbortController>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(false); // bám đáy khi đang đọc câu hỏi tiếp
  const loadedKey = useRef<string | null>(null);

  const updateThread = useCallback((key: ThreadKey, fn: (m: Message[]) => Message[]) => {
    setThreads(prev => {
      const next = { ...prev, [key]: fn(prev[key] ?? []) };
      threadsRef.current = next;
      return next;
    });
  }, []);

  const stream = async (key: ThreadKey, apiMessages: { role: 'user' | 'assistant'; content: string }[]) => {
    const ctrl = new AbortController();
    controllers.current[key] = ctrl;
    setStreaming(s => ({ ...s, [key]: true }));
    let started = false;
    try {
      const res = await apiRequest('/api/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chart, intent: intentFor(key), threadKey: key, messages: apiMessages, timeContext: selectedTime }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(err?.error ? `server:${err.error}` : 'Yêu cầu thất bại');
      }
      if (!res.body) throw new Error('Không có luồng phản hồi');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = '';
      let buf = '';
      const steps: string[] = [];
      let streamError: string | null = null;
      updateThread(key, m => [...m, { role: 'assistant', content: '' }]);
      started = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done || ctrl.signal.aborted) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? ''; // dòng cuối có thể chưa trọn
        let changed = false;
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') break;
          try {
            const event = JSON.parse(data);
            if (typeof event.status === 'string') { steps.push(event.status); changed = true; }
            if (typeof event.error === 'string') streamError = event.error;
            const delta = event.delta?.text ?? '';
            if (delta) { text += delta; changed = true; }
          } catch { /* skip */ }
        }
        if (changed) {
          const snapshot = text;
          const stepsSnapshot = steps.length ? [...steps] : undefined;
          updateThread(key, m => [...m.slice(0, -1), { role: 'assistant', content: snapshot, steps: stepsSnapshot }]);
        }
      }
      if (streamError && !ctrl.signal.aborted) {
        // Máy chủ báo đứt giữa chừng: chưa có chữ → thông báo lỗi; có chữ rồi → giữ phần đã viết, ghi chú gián đoạn
        const note = streamError;
        const stepsSnapshot = steps.length ? [...steps] : undefined;
        updateThread(key, m => [...m.slice(0, -1), text
          ? { role: 'assistant', content: text, steps: stepsSnapshot, note }
          : { role: 'assistant', content: note, error: true }]);
      }
    } catch (e) {
      if (ctrl.signal.aborted) {
        // Dừng giữa chừng: giữ phần đã viết, bỏ bong bóng rỗng
        if (started) updateThread(key, m => {
          const last = m[m.length - 1];
          return last?.role === 'assistant' && !last.content ? m.slice(0, -1) : m;
        });
      } else {
        const msg = e instanceof Error && e.message.startsWith('server:')
          ? e.message.slice(7)
          : 'Luận giải thất bại, vui lòng thử lại sau.';
        updateThread(key, m => [...m, { role: 'assistant', content: msg, error: true }]);
      }
    } finally {
      if (controllers.current[key] === ctrl) {
        delete controllers.current[key];
        setStreaming(s => { const n = { ...s }; delete n[key]; return n; });
      }
    }
  };

  const send = (key: ThreadKey, text: string) => {
    if (!text.trim()) return;
    controllers.current[key]?.abort();
    const userMsg: Message = { role: 'user', content: text };
    const history = threadsRef.current[key] ?? [];
    const apiMessages = [...history, userMsg]
      .filter(m => !m.error && !m.hidden && m.content.trim())
      .map(m => ({ role: m.role, content: m.content }));
    updateThread(key, m => [...m, userMsg]);
    stream(key, apiMessages);
  };

  const open = (key: ThreadKey, label?: string) => {
    if (label) setLabels(l => (l[key] === label ? l : { ...l, [key]: label }));
    stickRef.current = false;
    setActive(key);
    const existing = threadsRef.current[key];
    if (!existing?.length && !controllers.current[key]) stream(key, []);
  };

  const regenerate = () => {
    controllers.current[active]?.abort();
    updateThread(active, () => []);
    stream(active, []);
  };

  const closeThread = (key: ThreadKey) => {
    controllers.current[key]?.abort();
    setThreads(prev => { const n = { ...prev }; delete n[key]; threadsRef.current = n; return n; });
    setLabels(l => { const n = { ...l }; delete n[key]; return n; });
    if (active === key) setActive('overview');
  };

  // Đổi lá số (hoặc đổi lịch VN/CN): nạp lại các mục đã lưu, mở Mệnh cách
  useEffect(() => {
    if (loadedKey.current === storeKey) return;
    loadedKey.current = storeKey;
    Object.values(controllers.current).forEach(c => c.abort());
    controllers.current = {};
    const { threads: saved, labels: savedLabels } = loadStore(storeKey);
    threadsRef.current = saved;
    setThreads(saved);
    setLabels(savedLabels);
    setStreaming({});
    open('overview');
  }, [storeKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lưu các mục đã trả lời xong (mục đang chạy dở không lưu)
  useEffect(() => {
    if (loadedKey.current !== storeKey) return;
    const done: Threads = {};
    for (const [k, m] of Object.entries(threads)) {
      if (!streaming[k] && m.some(x => x.role === 'assistant' && !x.error && x.content)) {
        done[k] = m.filter(x => !x.error && !x.hidden);
      }
    }
    try { localStorage.setItem(storeKey, JSON.stringify({ threads: done, labels })); } catch { /* đầy hoặc bị chặn */ }
  }, [threads, labels, streaming, storeKey]);

  // Bấm vào cung trên lá số → mục riêng của cung đó
  useEffect(() => {
    if (!selectedPalace) return;
    open(`palace:${selectedPalace.branch}`, `Cung ${viPalace(selectedPalace.name)}`);
  }, [selectedPalace]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bấm vào chip Tứ Hóa lưu niên / đại hạn → mục riêng
  useEffect(() => {
    if (!selectedSiHua) return;
    const key = `sihua:${selectedSiHua.view}:${selectedSiHua.starName}:${selectedSiHua.siHua}`;
    const label = `${selectedSiHua.view === 'daxian' ? 'Hạn' : 'Niên'} ${viStar(selectedSiHua.starName)} hóa ${viSiHua(selectedSiHua.siHua)}`;
    open(key, label);
  }, [selectedSiHua]); // eslint-disable-line react-hooks/exhaustive-deps

  // Đổi mục: cuộn về đầu bài
  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [active]);

  // Đang hỏi tiếp và người dùng đang ở cuối: bám theo chữ mới
  const messages = threads[active] ?? [];
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  };

  const handleSend = () => {
    if (!input.trim()) return;
    send(active, input);
    setInput('');
    stickRef.current = true;
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

  const activeStreaming = !!streaming[active];
  const lastMsg = messages[messages.length - 1];
  const waitingFirstWord = activeStreaming && (!lastMsg || lastMsg.role === 'user' || (!lastMsg.content && !lastMsg.steps?.length));
  const extraThreads = Object.keys(labels).filter(k => !TOPIC_KEYS.includes(k) && (threads[k]?.length || streaming[k]));
  const hasAnswer = (k: ThreadKey) => !!threads[k]?.some(m => m.role === 'assistant' && !m.error && m.content);

  return (
    <div className="ls-insight flex flex-col rounded-xl overflow-hidden card-glass">

      {/* ── Mục luận giải ── */}
      <div className="flex-shrink-0 px-2 pt-2.5 pb-2" style={{ borderBottom: '1px solid var(--t-border)' }}>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1" role="tablist" aria-label="Mục luận giải">
          {TOPICS.map(t => {
            const isActive = active === t.key;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => open(t.key)}
                className="ls-topic relative py-1.5 px-0.5 text-[10px] leading-tight font-medium rounded-lg transition-colors duration-150 disabled:opacity-40"
                data-active={isActive || undefined}
                title={hasAnswer(t.key) ? 'Đã luận, bấm để xem lại' : 'Bấm để luận giải'}
              >
                {t.label}
                {(streaming[t.key] || hasAnswer(t.key)) && (
                  <span className={clsx('ls-topic-dot', streaming[t.key] && 'ls-topic-dot-live')} aria-hidden />
                )}
              </button>
            );
          })}
        </div>

        {extraThreads.length > 0 && (
          <div className="ls-thread-chips" aria-label="Các mục đã mở">
            {extraThreads.map(k => (
              <span key={k} className="ls-thread-chip" data-active={active === k || undefined}>
                <button onClick={() => { stickRef.current = false; setActive(k); }}>
                  {labels[k]}{streaming[k] ? '…' : ''}
                </button>
                <button className="ls-thread-chip-x" onClick={() => closeThread(k)} aria-label={`Đóng ${labels[k]}`}>×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Nội dung mục đang mở (cuộn riêng) ── */}
      <div ref={scrollRef} onScroll={onScroll} className="ls-insight-scroll flex-1 overflow-y-auto p-4 space-y-4 min-h-0">

        {messages.map((msg, i) => {
          if (msg.role === 'user' && msg.hidden) return null;
          if (msg.role === 'user') {
            return (
              <div key={i} className="flex justify-end">
                <div
                  className="max-w-[85%] rounded-xl px-3 py-2 text-[11px]"
                  style={{ background: 'rgba(212,168,67,0.08)', border: '1px solid rgba(212,168,67,0.18)', color: 'var(--t-gold)' }}
                >
                  {msg.content}
                </div>
              </div>
            );
          }
          const live = activeStreaming && i === messages.length - 1;
          if (!msg.content && !msg.steps?.length) return null;
          return (
            <div key={i}>
              {msg.steps?.length ? <ToolSteps steps={msg.steps} running={live && !msg.content} /> : null}
              {msg.content && (msg.error
                ? <p className="text-[11px]" style={{ color: 'var(--t-text2)' }}>{msg.content}</p>
                : <AiContent text={msg.content} streaming={live} />)}
              {msg.note && <p className="text-[10px] mt-2 italic" style={{ color: 'var(--t-faint)' }}>{msg.note}</p>}
            </div>
          );
        })}

        {waitingFirstWord && (
          <p className="text-[11px] animate-pulse" style={{ color: 'var(--t-faint)' }}>Đang luận giải…</p>
        )}
      </div>

      {/* ── Hỏi tiếp trong mục đang mở ── */}
      <div className="flex-shrink-0 px-3 pb-3 pt-2" style={{ borderTop: '1px solid var(--t-border)' }}>
        {hasAnswer(active) && !activeStreaming && (
          <div className="flex justify-end mb-1.5">
            <button onClick={regenerate} className="text-[10px] underline-offset-2 hover:underline" style={{ color: 'var(--t-faint)' }}>
              Luận lại mục này
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={`Hỏi tiếp về ${TOPICS.find(t => t.key === active)?.label ?? labels[active] ?? 'mục này'}…`}
            className="flex-1 rounded-lg px-3 py-2 text-[11px] focus:outline-none transition-colors"
            style={{ background: 'var(--t-card)', border: '1px solid var(--t-border)', color: 'var(--t-text)' }}
          />
          {activeStreaming && !input.trim() ? (
            <button
              onClick={() => controllers.current[active]?.abort()}
              className="px-3 py-2 rounded-lg text-[11px] font-medium"
              style={{ background: 'transparent', border: '1px solid var(--t-border)', color: 'var(--t-text2)' }}
              title="Dừng câu trả lời đang viết"
            >
              Dừng
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="px-3 py-2 rounded-lg text-[11px] font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: 'rgba(212,168,67,0.15)', border: '1px solid rgba(212,168,67,0.25)', color: 'var(--t-gold)' }}
            >
              Hỏi tiếp
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
