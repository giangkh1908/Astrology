'use client';
import { apiRequest } from '@/lib/api/client';
import { chartKey } from '@/lib/ziwei/chart-key';
import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo, useId } from 'react';
import SlashMenu from './SlashMenu';
import {
  TOPIC_KEYS, topicLabel, buildCommands, filterCommands, parseSlash, resolveCommand, isTypingCommand,
  type SlashCommand,
} from '@/lib/chat/slash-commands';
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

/** Mỗi mục (chủ đề, cung, tứ hóa) là một luồng chat riêng, lưu trên server theo tài khoản + lá số */
type ThreadKey = string;
type Threads = Record<ThreadKey, Message[]>;
type HistoryState = 'loading' | 'ready' | 'error';

/** Bản cũ lưu hội thoại trong localStorage (không gắn tài khoản): xóa để người dùng chung máy không đọc được. */
function clearLegacyLocalChats() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith('ziwei-chat:')) localStorage.removeItem(k);
    }
  } catch { /* trình duyệt chặn bộ nhớ */ }
}

/** Nhãn mục khi nạp lại từ server (chủ đề có nhãn riêng qua topicLabel). */
function defaultLabel(key: ThreadKey, chart: ZiweiChart): string | undefined {
  if (key.startsWith('palace:')) {
    const p = chart.palaces.find(x => x.branch === Number(key.slice(7)));
    return p ? `Cung ${viPalace(p.name)}` : undefined;
  }
  if (key.startsWith('sihua:')) {
    const [, view, starName, siHua] = key.split(':');
    return `${view === 'daxian' ? 'Hạn' : 'Niên'} ${viStar(starName)} hóa ${viSiHua(siHua)}`;
  }
  return undefined;
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
  const storeKey = chartKey(chart.birthInfo);
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
  const [historyState, setHistoryState] = useState<HistoryState>('loading');
  const historyReady = useRef(false); // chưa nạp xong lịch sử: chưa tự luận (tránh trừ lượt cho mục đã có)
  const activeRef = useRef<ThreadKey>('overview');
  useEffect(() => { activeRef.current = active; }, [active]);
  // Hạn mức câu hỏi AI: null = chưa biết hoặc không giới hạn
  const [quota, setQuota] = useState<{ used: number; limit: number } | null>(null);

  const readQuota = (value: string | null) => {
    const m = value?.match(/^(\d+)\/(\d+)$/);
    if (m) setQuota({ used: Number(m[1]), limit: Number(m[2]) });
    else if (value) setQuota(null); // "<used>/unlimited"
  };

  useEffect(() => {
    let cancelled = false;
    apiRequest('/api/account')
      .then(r => (r.ok ? r.json() : null))
      .then((a: { used?: number; limit?: number | null } | null) => {
        if (cancelled || !a) return;
        setQuota(typeof a.used === 'number' && typeof a.limit === 'number' ? { used: a.used, limit: a.limit } : null);
      })
      .catch(() => { /* không biết hạn mức: ẩn dòng này */ });
    return () => { cancelled = true; };
  }, []);

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
      readQuota(res.headers.get('X-Chat-Quota'));
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

  /** Mở một mục; auto=false khi sắp hỏi luôn một câu trong mục đó (khỏi luận tổng quát trước) */
  const open = (key: ThreadKey, label?: string, auto = true) => {
    if (label && !TOPIC_KEYS.includes(key)) setLabels(l => (l[key] === label ? l : { ...l, [key]: label }));
    stickRef.current = false;
    setActive(key);
    activeRef.current = key;
    const existing = threadsRef.current[key];
    if (auto && historyReady.current && !existing?.length && !controllers.current[key]) stream(key, []);
  };

  const regenerate = () => {
    controllers.current[active]?.abort();
    updateThread(active, () => []);
    stream(active, []);
  };

  const closeThread = (key: ThreadKey) => {
    controllers.current[key]?.abort();
    if (threadsRef.current[key]?.length) {
      // Đóng trên server để lần sau không nạp lại (lỗi thì thôi: lần sau mục vẫn hiện, không mất gì)
      void apiRequest('/api/history/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'interpret', birthInfo: chart.birthInfo, threadKey: key }),
      }).catch(() => undefined);
    }
    setThreads(prev => { const n = { ...prev }; delete n[key]; threadsRef.current = n; return n; });
    setLabels(l => { const n = { ...l }; delete n[key]; return n; });
    if (active === key) {
      const rest = Object.keys(threadsRef.current).filter(k => k !== key && (threadsRef.current[k]?.length || controllers.current[k]));
      activeRef.current = rest[rest.length - 1] ?? 'overview';
      setActive(activeRef.current);
    }
  };

  // Đổi lá số: nạp các mục đã luận của tài khoản này từ server, rồi mở Mệnh cách (chỉ luận nếu chưa có)
  useEffect(() => {
    if (loadedKey.current === storeKey) return;
    loadedKey.current = storeKey;
    clearLegacyLocalChats();
    Object.values(controllers.current).forEach(c => c.abort());
    controllers.current = {};
    threadsRef.current = {};
    historyReady.current = false;
    setThreads({});
    setLabels({});
    setStreaming({});
    setHistoryState('loading');
    open('overview');

    // Không hủy bằng cleanup: StrictMode chạy effect 2 lần, lần 2 thoát sớm ở loadedKey → kẹt 'đang tải'.
    // Kết quả cũ (đổi lá số giữa chừng) bị bỏ nhờ kiểm tra loadedKey.
    apiRequest('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'interpret', birthInfo: chart.birthInfo }),
    })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { threads?: { threadKey: string; messages: Message[] }[] }) => {
        if (loadedKey.current !== storeKey) return;
        const saved: Threads = {};
        const savedLabels: Record<string, string> = {};
        for (const t of d.threads ?? []) {
          const msgs = t.messages.filter(m => !m.hidden).map(m => ({ role: m.role, content: m.content }));
          if (!msgs.length) continue;
          saved[t.threadKey] = msgs;
          const label = defaultLabel(t.threadKey, chart);
          if (label) savedLabels[t.threadKey] = label;
        }
        // Mục người dùng đã mở trong lúc chờ (nếu có) được giữ, ghi đè bản lưu
        const merged: Threads = { ...saved };
        for (const [k, m] of Object.entries(threadsRef.current)) if (m.length) merged[k] = m;
        threadsRef.current = merged;
        setThreads(merged);
        setLabels(l => ({ ...savedLabels, ...l }));
        historyReady.current = true;
        setHistoryState('ready');
        open(activeRef.current);
      })
      .catch(() => {
        if (loadedKey.current !== storeKey) return;
        // Không tải được lịch sử: không tự luận (tránh trừ lượt cho mục có thể đã luận); người dùng tự chọn mục
        historyReady.current = true;
        setHistoryState('error');
      });
  }, [storeKey]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const scrollToBottom = () => {
    stickRef.current = true;
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

  // ── Lệnh "/" ──
  const menuId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const commands = useMemo(() => buildCommands(chart.palaces), [chart.palaces]);
  const [menuIndex, setMenuIndex] = useState(0);
  const [menuDismissed, setMenuDismissed] = useState(false);
  const menuOpen = isTypingCommand(input) && !menuDismissed;
  const menuItems = useMemo(
    () => (menuOpen ? filterCommands(commands, parseSlash(input)?.name ?? '') : []),
    [menuOpen, commands, input],
  );
  const safeIndex = Math.min(menuIndex, Math.max(menuItems.length - 1, 0));

  const runCommand = (cmd: SlashCommand, rest = '') => {
    setInput('');
    setMenuDismissed(false);
    const a = cmd.action;
    if (a.type === 'regenerate') { if (threadsRef.current[active]?.length || controllers.current[active]) regenerate(); return; }
    if (a.type === 'close') { closeThread(active); return; }
    open(a.key, a.label, !rest);
    if (rest) { send(a.key, rest); scrollToBottom(); }
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const slash = parseSlash(input);
    if (slash) {
      // Enter khi danh sách đang mở: chạy lệnh đang chọn; không thì tìm theo tên đã gõ
      const cmd = menuOpen ? menuItems[safeIndex] : resolveCommand(commands, slash.name);
      if (cmd) runCommand(cmd, menuOpen ? '' : slash.rest);
      return;
    }
    send(active, input);
    setInput('');
    scrollToBottom();
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return; // bộ gõ tiếng Việt đang ghép chữ
    if (menuOpen && menuItems.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMenuIndex((safeIndex + 1) % menuItems.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMenuIndex((safeIndex - 1 + menuItems.length) % menuItems.length); return; }
      if (e.key === 'Tab') { e.preventDefault(); setInput(`/${menuItems[safeIndex].name} `); return; }
    }
    if (e.key === 'Escape') {
      if (menuOpen) { e.preventDefault(); setMenuDismissed(true); return; }
      if (activeStreaming) { e.preventDefault(); controllers.current[active]?.abort(); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const onInputChange = (value: string) => {
    setInput(value);
    setMenuIndex(0);
    setMenuDismissed(false);
  };

  const openSlashMenu = () => {
    setInput('/');
    setMenuIndex(0);
    setMenuDismissed(false);
    inputRef.current?.focus();
  };

  const activeStreaming = !!streaming[active];
  const lastMsg = messages[messages.length - 1];
  const waitingFirstWord = activeStreaming && (!lastMsg || lastMsg.role === 'user' || (!lastMsg.content && !lastMsg.steps?.length));
  const labelOf = (k: ThreadKey) => topicLabel(k) ?? labels[k] ?? 'mục này';
  const openThreads = [
    ...TOPIC_KEYS.filter(k => threads[k]?.length || streaming[k]),
    ...Object.keys(labels).filter(k => !TOPIC_KEYS.includes(k) && (threads[k]?.length || streaming[k])),
  ];
  const hasAnswer = (k: ThreadKey) => !!threads[k]?.some(m => m.role === 'assistant' && !m.error && m.content);
  const isDone = (cmd: SlashCommand) => cmd.action.type === 'open' && hasAnswer(cmd.action.key);
  const isEmpty = !messages.length && !activeStreaming;

  return (
    <div className="ls-insight flex flex-col rounded-xl overflow-hidden card-glass">

      {/* ── Các mục đã mở (chọn mục mới bằng lệnh /) ── */}
      {openThreads.length > 0 && (
        <div className="flex-shrink-0 px-2 py-2" style={{ borderBottom: '1px solid var(--t-border)' }}>
          <div className="ls-thread-chips" role="tablist" aria-label="Các mục đã mở">
            {openThreads.map(k => (
              <span key={k} className="ls-thread-chip" data-active={active === k || undefined}>
                <button role="tab" aria-selected={active === k} onClick={() => { stickRef.current = false; setActive(k); }}>
                  {labelOf(k)}
                  {streaming[k] && <span className="ls-topic-dot-inline ls-topic-dot-live" aria-label="đang luận" />}
                </button>
                <button className="ls-thread-chip-x" onClick={() => closeThread(k)} aria-label={`Đóng ${labelOf(k)}`}>×</button>
              </span>
            ))}
          </div>
        </div>
      )}

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

        {isEmpty && historyState === 'loading' && (
          <p className="text-[11px] animate-pulse" style={{ color: 'var(--t-faint)' }}>Đang tải các mục đã luận…</p>
        )}
        {isEmpty && historyState !== 'loading' && (
          <div className="text-[11px] leading-relaxed" style={{ color: 'var(--t-faint)' }}>
            {historyState === 'error' && <p className="mb-2">Chưa tải được các mục đã luận trước đây.</p>}
            <p className="mb-2">Gõ <span className="ls-kbd">/</span> để chọn mục luận giải, ví dụ:</p>
            <div className="space-y-1">
              {['menh-cach', 'su-nghiep', 'tinh-cam', 'cung-quan-loc'].map(n => {
                const cmd = commands.find(c => c.name === n);
                return cmd && (
                  <button key={n} onClick={() => runCommand(cmd)} className="ls-slash-example">
                    <span className="ls-slash-name">/{n}</span> <span>{cmd.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {waitingFirstWord && (
          <p className="text-[11px] animate-pulse" style={{ color: 'var(--t-faint)' }}>Đang luận giải…</p>
        )}
      </div>

      {/* ── Ô nhập: hỏi tiếp, hoặc gõ / để chọn mục ── */}
      <div className="relative flex-shrink-0 px-3 pb-3 pt-2" style={{ borderTop: '1px solid var(--t-border)' }}>
        {menuOpen && (
          <SlashMenu
            id={menuId}
            items={menuItems}
            activeIndex={safeIndex}
            isDone={isDone}
            onHover={setMenuIndex}
            onPick={cmd => runCommand(cmd)}
          />
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={openSlashMenu}
            className="ls-slash-btn"
            aria-label="Chọn mục bằng lệnh /"
            title="Chọn mục (/)"
          >
            /
          </button>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => onInputChange(e.target.value)}
            onKeyDown={onInputKeyDown}
            onBlur={() => setMenuDismissed(true)}
            onFocus={() => setMenuDismissed(false)}
            role="combobox"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-autocomplete="list"
            aria-activedescendant={menuOpen && menuItems.length ? `${menuId}-${safeIndex}` : undefined}
            placeholder={isEmpty ? 'Gõ / để chọn mục luận giải…' : `Hỏi tiếp về ${labelOf(active)}… (gõ / để đổi mục)`}
            className="flex-1 min-w-0 rounded-lg px-3 py-2 text-[11px] focus:outline-none transition-colors"
            style={{ background: 'var(--t-card)', border: '1px solid var(--t-border)', color: 'var(--t-text)' }}
          />
          {activeStreaming && !input.trim() ? (
            <button
              onClick={() => controllers.current[active]?.abort()}
              className="px-3 py-2 rounded-lg text-[11px] font-medium"
              style={{ background: 'transparent', border: '1px solid var(--t-border)', color: 'var(--t-text2)' }}
              title="Dừng câu trả lời đang viết (Esc)"
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
              {parseSlash(input) ? 'Mở' : 'Gửi'}
            </button>
          )}
        </div>
        {quota && (
          <p className="mt-1.5 text-right text-[10px]" style={{ color: 'var(--t-faint)' }} aria-live="polite">
            {quota.used >= quota.limit
              ? 'Đã hết lượt hỏi — liên hệ admin để mở thêm'
              : `Còn ${quota.limit - quota.used}/${quota.limit} câu`}
          </p>
        )}
      </div>
    </div>
  );
}
