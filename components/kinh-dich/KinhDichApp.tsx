'use client';
/**
 * Kinh Dịch: hỏi → AI làm rõ câu hỏi (có thể hỏi lại bằng thẻ) → gieo 3 xu × 6 lần → luận → hỏi tiếp.
 * Mỗi lần gieo là một hội thoại riêng trên server (X-Cast-Id). Không có DB (không có X-Cast-Id) thì
 * client tự giữ toàn bộ tin nhắn và gửi kèm quẻ ở mỗi lượt sau khi gieo.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import PageTopBar from '@/components/PageTopBar';
import { apiRequest } from '@/lib/api/client';
import { encodeAsk, extractAsk, SKIP_ANSWER } from '@/lib/ai/ask-user';
import { computeCast, type Cast, type LineValue } from '@/lib/kinh-dich/core';
import { READING_QUESTION } from '@/lib/kinh-dich/prompt';
import { readSse } from '@/lib/kinh-dich/sse';
import AskCard, { isCardAnswer } from '@/components/AskCard';
import AiContent from '@/components/AiContent';
import CoinCaster from './CoinCaster';
import HexagramView from './HexagramView';

interface Msg { role: 'user' | 'assistant'; content: string; hidden?: boolean; error?: boolean; note?: string }
interface CastListItem { castId: string; question: string; lines: LineValue[] | null; createdAt: string; main?: string; changed?: string }

const MAX_QUESTION = 500;
const MAX_MESSAGE = 2000;

const vnDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
};

export default function KinhDichApp() {
  const [castId, setCastId] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [cast, setCast] = useState<Cast | null>(null);
  const [streaming, setStreaming] = useState(false);
  /** Trạng thái server gửi trong lúc model suy luận, trước khi có chữ (vd. "Đang xét vị trí các hào…"). */
  const [thinking, setThinking] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [quota, setQuota] = useState<string | null>(null);
  const [history, setHistory] = useState<CastListItem[] | null>(null);
  const [casterKey, setCasterKey] = useState(0);
  const ctrl = useRef<AbortController | null>(null);
  const messagesRef = useRef<Msg[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const update = useCallback((fn: (m: Msg[]) => Msg[]) => {
    setMessages(m => { const n = fn(m); messagesRef.current = n; return n; });
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const res = await apiRequest('/api/kinh-dich');
      if (!res.ok) { setHistory([]); return; }
      const d = await res.json() as { casts?: CastListItem[] };
      setHistory(d.casts ?? []);
    } catch { setHistory([]); }
  }, []);

  useEffect(() => { void loadHistory(); return () => ctrl.current?.abort(); }, [loadHistory]);
  // Lượt dùng chung với chat Tử Vi: đọc hạn mức hiện tại khi mở trang (sau đó cập nhật từ header X-Chat-Quota)
  useEffect(() => {
    apiRequest('/api/account')
      .then(r => (r.ok ? r.json() : null))
      .then((a: { used?: number; limit?: number | null } | null) => {
        if (a && typeof a.used === 'number' && typeof a.limit === 'number') setQuota(q => q ?? `${a.used}/${a.limit}`);
      })
      .catch(() => { /* không biết hạn mức: ẩn */ });
  }, []);
  // Chat cuộn xuống cuối khi có tin / chữ mới (cuộn trong khung, không cuộn cả trang)
  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; }, [messages]);
  const followReveal = () => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; };

  /** Gửi một lượt và đọc luồng trả lời. body: phần riêng của lượt (castId/lines/answering do caller quyết định). */
  const stream = async (body: Record<string, unknown>) => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setStreaming(true);
    setThinking(null);
    let started = false;
    try {
      const res = await apiRequest('/api/kinh-dich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: c.signal,
      });
      const q = res.headers.get('X-Chat-Quota');
      if (q) setQuota(q);
      const id = res.headers.get('X-Cast-Id');
      if (id) setCastId(id);
      if (!res.ok) {
        const err = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(`server:${err?.error ?? 'Yêu cầu thất bại, vui lòng thử lại.'}`);
      }
      if (!res.body) throw new Error('Không có luồng phản hồi');
      let text = '';
      let streamError: string | null = null;
      update(m => [...m, { role: 'assistant', content: '' }]);
      started = true;
      const set = () => { const snap = text; update(m => [...m.slice(0, -1), { role: 'assistant', content: snap }]); };
      await readSse(res.body, {
        delta: t => { text += t; setThinking(null); set(); },
        status: s => { if (!text) setThinking(s); },
        ask: a => { if (a && typeof a === 'object') { text = encodeAsk(a as Parameters<typeof encodeAsk>[0]); set(); } },
        error: e => { streamError = e; },
      });
      if (streamError && !c.signal.aborted) {
        const note = streamError;
        update(m => [...m.slice(0, -1), text ? { role: 'assistant', content: text, note } : { role: 'assistant', content: note, error: true }]);
      }
    } catch (e) {
      if (c.signal.aborted) {
        if (started) update(m => (m.at(-1)?.role === 'assistant' && !m.at(-1)!.content ? m.slice(0, -1) : m));
      } else {
        const msg = e instanceof Error && e.message.startsWith('server:') ? e.message.slice(7) : 'Không kết nối được, vui lòng thử lại.';
        update(m => [...(started && !m.at(-1)?.content ? m.slice(0, -1) : m), { role: 'assistant', content: msg, error: true }]);
      }
    } finally {
      if (ctrl.current === c) { ctrl.current = null; setStreaming(false); setThinking(null); }
    }
  };

  /** Lịch sử gửi kèm (chỉ cần khi không có DB; có DB server tự đọc lịch sử, chỉ lấy tin user cuối). */
  const apiHistory = (list: Msg[]) => list.filter(m => !m.error && m.content.trim()).map(m => ({ role: m.role, content: m.content }));

  const start = (text: string) => {
    const q = text.trim();
    if (!q || q.length > MAX_QUESTION || streaming) return;
    setQuestion(q);
    setInput('');
    const first: Msg = { role: 'user', content: q };
    update(() => [first]);
    void stream({ messages: [{ role: 'user', content: q }] });
  };

  const say = (text: string, opts: { answering?: boolean } = {}) => {
    const t = text.trim();
    if (!t || t.length > MAX_MESSAGE || streaming) return;
    const list = [...messagesRef.current, { role: 'user' as const, content: t }];
    update(() => list);
    setInput('');
    void stream({
      ...(castId ? { castId } : {}),
      ...(cast ? { lines: cast.lines } : {}),
      messages: apiHistory(list),
      ...(opts.answering ? { answering: true } : {}),
    });
  };

  const onCast = useCallback((lines: LineValue[]) => {
    setCast(computeCast(lines));
    const before = messagesRef.current;
    update(m => [...m, { role: 'user', content: READING_QUESTION, hidden: true }]);
    // Có DB: server dùng lịch sử đã lưu + câu hỏi luận ẩn. Không DB: gửi đoạn làm rõ, server tự thêm câu hỏi luận.
    void stream(castId ? { castId, lines, messages: [] } : { lines, messages: apiHistory(before) });
  }, [castId]);

  /** Bài luận đầu thất bại (lỗi / AI suy nghĩ hết lượt chữ): luận lại bằng quẻ đã gieo. Có DB: server dùng quẻ đã lưu, miễn phí. */
  const retryReading = () => {
    if (!cast || streaming) return;
    const list = messagesRef.current;
    const at = list.findIndex(m => m.hidden && m.content === READING_QUESTION);
    const kept = (at >= 0 ? list.slice(0, at + 1) : list).filter(m => !m.error);
    update(() => kept);
    const before = at >= 0 ? kept.slice(0, -1) : kept;
    void stream(castId ? { castId, lines: cast.lines, messages: [] } : { lines: cast.lines, messages: apiHistory(before) });
  };

  const reset = () => {
    ctrl.current?.abort();
    setCastId(null); setQuestion(''); setCast(null); setInput('');
    update(() => []);
    setCasterKey(k => k + 1);
    void loadHistory();
  };

  const open = async (id: string) => {
    if (streaming) return;
    try {
      const res = await apiRequest(`/api/kinh-dich?castId=${encodeURIComponent(id)}`);
      if (!res.ok) return;
      const d = await res.json() as { cast: { castId: string; question: string; messages: Msg[] }; reading: Cast | null };
      setCastId(d.cast.castId);
      setQuestion(d.cast.question);
      setCast(d.reading);
      setCasterKey(k => k + 1);
      const msgs: Msg[] = d.cast.messages.length ? d.cast.messages : [{ role: 'user', content: d.cast.question }];
      // Đã gieo mà bài luận đầu chưa xong (lỗi giữa chừng): hiện lỗi + nút "Luận lại".
      const noReading = d.reading && !msgs.some(m => m.hidden && m.content === READING_QUESTION);
      update(() => (noReading
        ? [...msgs, { role: 'user', content: READING_QUESTION, hidden: true }, { role: 'assistant', content: 'Bài luận cho quẻ này chưa hoàn thành.', error: true }]
        : msgs));
    } catch { /* bỏ qua: danh sách vẫn còn để thử lại */ }
  };

  // ── Trạng thái suy ra ──
  const visible = messages.filter(m => !m.hidden);
  const last = messages.at(-1);
  const lastAsk = last?.role === 'assistant' && !last.error ? extractAsk(last.content).ask : null;
  const hasReply = messages.some(m => m.role === 'assistant' && !m.error && m.content);
  const started = messages.length > 0;
  const canCast = started && !cast && !streaming && !lastAsk && (castId !== null || hasReply);
  // Đã gieo mà chưa có bài luận (lượt luận lỗi): chỉ cho bấm "Luận lại", chưa cho hỏi tiếp.
  const readingAt = messages.findIndex(m => m.hidden && m.content === READING_QUESTION);
  const hasReading = readingAt >= 0 && messages.slice(readingAt + 1).some(m => m.role === 'assistant' && !m.error && m.content);
  const readingFailed = !!cast && !streaming && readingAt >= 0 && !hasReading && last?.role === 'assistant' && !!last.error;
  const canType = (!started || !cast || hasReply) && !readingFailed;
  const send = () => (started ? say(input) : start(input));
  // Lượt dùng chung với chat Tử Vi (cùng bộ đếm trên tài khoản)
  const quotaText = (() => {
    const m = quota?.match(/^(\d+)\/(\d+)$/);
    if (!m) return null;
    const left = Number(m[2]) - Number(m[1]);
    if (left <= 0) return 'Đã hết lượt hỏi — liên hệ admin để mở thêm';
    return left < 3
      ? `Còn ${left}/${m[2]} lượt — mỗi câu Kinh Dịch cần 3 lượt, liên hệ admin để mở thêm`
      : `Còn ${left}/${m[2]} lượt · mỗi câu Kinh Dịch tính 3 lượt`;
  })();

  return (
    <div className="min-h-svh" style={{ background: 'var(--t-bg)', color: 'var(--t-text)' }}>
    <PageTopBar
      title="Kinh Dịch · Gieo quẻ"
      right={started ? (
        <button type="button" onClick={reset} className="rounded-full px-3 py-1 text-[11px]" style={{ border: '1px solid var(--t-border)', color: 'var(--t-text2)' }}>
          Hỏi việc khác
        </button>
      ) : undefined}
    />
    <main className="px-4 py-6">
      <div className="mx-auto w-full max-w-6xl space-y-4">

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          {/* ── Cột trái: quẻ ── */}
          <div className="space-y-4">
            <section className="rounded-xl p-5 card-glass">
              {cast ? (
                <HexagramView cast={cast} />
              ) : canCast ? (
                <div className="space-y-4">
                  <p className="text-center text-[12px]" style={{ color: 'var(--t-text)' }}>{question}</p>
                  <p className="text-center text-[11px]" style={{ color: 'var(--t-text2)' }}>
                    Tĩnh tâm nghĩ về câu hỏi rồi gieo. Mỗi việc nên gieo một lần; gieo lại nhiều lần cho một việc thường không nên.
                  </p>
                  <CoinCaster key={casterKey} onDone={onCast} disabled={streaming} />
                </div>
              ) : started ? (
                <div className="space-y-2 py-10 text-center">
                  <p className="text-[12px]" style={{ color: 'var(--t-text)' }}>{question}</p>
                  <p className="text-[11px]" style={{ color: 'var(--t-faint)' }}>
                    {streaming ? 'Đang xem câu hỏi của bạn…' : lastAsk ? 'Trả lời câu hỏi bên khung chat để làm rõ trước khi gieo.' : 'Chưa gieo được, thử gửi lại câu hỏi bên khung chat.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3 py-6 text-[12px] leading-relaxed" style={{ color: 'var(--t-text2)' }}>
                  <p style={{ color: 'var(--t-text)' }}>Cách gieo quẻ</p>
                  <ol className="list-decimal space-y-1 pl-5">
                    <li>Nhập câu hỏi ở khung chat bên cạnh: việc gì, cho ai, trong bao lâu.</li>
                    <li>AI có thể hỏi lại vài điều để câu hỏi rõ hơn (không tính thêm lượt).</li>
                    <li>Gieo 3 đồng xu 6 lần, từ hào dưới lên hào trên.</li>
                    <li>Xem quẻ chính, hào động, quẻ biến và bài luận theo lời kinh.</li>
                  </ol>
                  <p className="text-[10px]" style={{ color: 'var(--t-faint)' }}>Dùng chung lượt với chat Tử Vi: mở một lần gieo trừ 3 lượt; làm rõ câu hỏi và bài luận đầu không tính thêm, mỗi câu hỏi tiếp trừ 3 lượt.</p>
                </div>
              )}
            </section>

            {history && history.length > 0 && (
              <details className="rounded-xl px-4 py-3 card-glass">
                <summary className="cursor-pointer text-[12px]" style={{ color: 'var(--t-text2)' }}>Quẻ đã gieo ({history.length})</summary>
                <ul className="mt-2 space-y-1">
                  {history.map(h => (
                    <li key={h.castId}>
                      <button
                        type="button"
                        onClick={() => void open(h.castId)}
                        disabled={streaming}
                        className="w-full rounded-lg px-2 py-1.5 text-left text-[11px] disabled:opacity-40"
                        style={{ background: h.castId === castId ? 'var(--t-card)' : 'transparent', color: 'var(--t-text2)' }}
                      >
                        <span style={{ color: 'var(--t-faint)' }}>{vnDate(h.createdAt)} · </span>
                        {h.question}
                        <span style={{ color: 'var(--t-gold)' }}>
                          {h.main ? ` → ${h.main}${h.changed ? ` ⇒ ${h.changed}` : ''}` : ' (chưa gieo)'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          {/* ── Cột phải: khung chat ── */}
          <div className="ls-insight flex flex-col overflow-hidden rounded-xl card-glass">
            <div className="flex-shrink-0 px-4 py-2.5 text-[11px]" style={{ borderBottom: '1px solid var(--t-border)', color: 'var(--t-text2)' }}>
              <span style={{ color: 'var(--t-gold)' }}>Luận quẻ</span>
              {cast && <span style={{ color: 'var(--t-faint)' }}> · {cast.main.name}{cast.changed ? ` → ${cast.changed.name}` : ''}</span>}
            </div>

            <div ref={scrollRef} className="ls-insight-scroll min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              {!started && (
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--t-faint)' }}>
                  Ví dụ: “Trong 6 tháng tới tôi có gặp được người yêu phù hợp không?” hoặc “Có nên nhận lời mời làm việc ở công ty mới trong quý này không?”
                </p>
              )}
              {visible.map((msg, i) => {
                const prev = visible[i - 1];
                if (msg.role === 'user') {
                  if (prev?.role === 'assistant' && extractAsk(prev.content).ask && isCardAnswer(msg.content)) return null;
                  return (
                    <div key={i} className="flex justify-end">
                      <div className="max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[11px]"
                        style={{ background: 'rgba(212,168,67,0.08)', border: '1px solid rgba(212,168,67,0.18)', color: 'var(--t-gold)' }}>
                        {msg.content}
                      </div>
                    </div>
                  );
                }
                const live = streaming && msg === last;
                if (!msg.content) return live ? <p key={i} className="animate-pulse text-[11px]" style={{ color: 'var(--t-faint)' }} aria-live="polite">{thinking ?? 'Đang suy nghĩ…'}</p> : null;
                const { text: lead, ask } = msg.error ? { text: '', ask: null } : extractAsk(msg.content);
                if (ask) {
                  const next = visible[i + 1];
                  return (
                    <AskCard
                      key={i}
                      ask={{ ...ask, loi_dan: lead || ask.loi_dan }}
                      answered={next?.role === 'user' ? next.content : undefined}
                      disabled={streaming}
                      onSubmit={t => say(t, { answering: true })}
                      onSkip={() => say(SKIP_ANSWER, { answering: true })}
                    />
                  );
                }
                return (
                  <div key={i}>
                    {msg.error
                      ? <p className="text-[11px]" style={{ color: 'var(--t-text2)' }} role="alert">{msg.content}</p>
                      : <AiContent text={msg.content} streaming={live} onReveal={followReveal} />}
                    {msg.note && <p className="mt-2 text-[10px] italic" style={{ color: 'var(--t-faint)' }}>{msg.note}</p>}
                  </div>
                );
              })}
              {readingFailed && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={retryReading}
                    className="rounded-lg px-3 py-1.5 text-[11px] font-medium"
                    style={{ background: 'var(--t-card)', border: '1px solid var(--t-border)', color: 'var(--t-gold)' }}
                  >
                    Luận lại quẻ này
                  </button>
                </div>
              )}
              {canCast && hasReply && (
                <p className="text-center text-[10px]" style={{ color: 'var(--t-faint)' }}>Câu hỏi đã sẵn sàng — gieo quẻ ở khung bên cạnh.</p>
              )}
            </div>

            <div className="flex-shrink-0 px-3 py-2.5" style={{ borderTop: '1px solid var(--t-border)' }}>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
                  maxLength={started ? MAX_MESSAGE : MAX_QUESTION}
                  disabled={!canType}
                  aria-label={!started ? 'Câu hỏi muốn gieo quẻ' : cast ? 'Hỏi tiếp về quẻ này' : 'Bổ sung cho câu hỏi'}
                  placeholder={!started ? 'Nhập câu hỏi muốn gieo quẻ…' : cast ? 'Hỏi tiếp về quẻ này…' : 'Bổ sung thêm cho câu hỏi…'}
                  className="min-w-0 flex-1 rounded-lg px-3 py-2 text-[11px] transition-colors focus:outline-none disabled:opacity-50"
                  style={{ background: 'var(--t-card)', border: '1px solid var(--t-border)', color: 'var(--t-text)' }}
                />
                {streaming && !input.trim() ? (
                  <button type="button" onClick={() => ctrl.current?.abort()} className="rounded-lg px-3 py-2 text-[11px] font-medium"
                    style={{ border: '1px solid var(--t-border)', color: 'var(--t-text2)' }}>Dừng</button>
                ) : (
                  <button type="button" onClick={send} disabled={!input.trim() || streaming || !canType}
                    className="rounded-lg px-3 py-2 text-[11px] font-medium transition-all disabled:cursor-not-allowed disabled:opacity-30"
                    style={{ background: 'rgba(212,168,67,0.15)', border: '1px solid rgba(212,168,67,0.25)', color: 'var(--t-gold)' }}>
                    {started ? 'Gửi' : 'Hỏi'}
                  </button>
                )}
              </div>
              <p className="mt-1.5 text-right text-[10px]" style={{ color: 'var(--t-faint)' }} aria-live="polite">
                {cast ? 'Mỗi câu hỏi tiếp trừ 3 lượt' : !started ? 'Mở một lần gieo trừ 3 lượt' : 'Làm rõ câu hỏi không tính thêm lượt'}
                {quotaText ? ` · ${quotaText}` : ''}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
    </div>
  );
}
