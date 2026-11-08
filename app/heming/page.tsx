'use client';
import { apiRequest } from '@/lib/api/client';
import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import BirthForm, { type BirthFormState } from '@/components/BirthForm';
import { formToBirthInfo } from '@/lib/ziwei/share';
import { generateChart as buildChart } from '@/lib/ziwei/algorithm';
import type { BirthInfo, ZiweiChart } from '@/lib/ziwei/types';
import { useTheme } from '@/components/ThemeProvider';

// ─── AiContent 渲染器（与 InsightPanel 一致）────────────────
function AiContent({ text, streaming }: { text: string; streaming?: boolean }) {
  const lines = text.split('\n');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {lines.map((line, i) => {
        const sectionMatch = line.match(/^\*\*【(.+?)】\*\*$/);
        if (sectionMatch) {
          return (
            <div key={i} style={{ paddingTop: i === 0 ? 0 : '14px', paddingBottom: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ac)', letterSpacing: '0.04em' }}>
                【{sectionMatch[1]}】
              </span>
            </div>
          );
        }
        if (line.trim() === '') return <div key={i} style={{ height: '4px' }} />;
        const parts = line.split(/\*\*(.+?)\*\*/);
        return (
          <div key={i} style={{ fontSize: '13px', lineHeight: 1.75, color: 'var(--tx-2)' }}>
            {parts.map((part, j) =>
              j % 2 === 0
                ? part
                : <strong key={j} style={{ fontWeight: 500, color: 'var(--tx-0)' }}>{part}</strong>
            )}
          </div>
        );
      })}
      {streaming && (
        <span style={{
          display: 'inline-block', width: '7px', height: '13px',
          background: 'var(--ac)', opacity: 0.5, borderRadius: '2px',
          animation: 'pulse 1s ease-in-out infinite',
          verticalAlign: 'middle', marginLeft: '2px',
        }} />
      )}
    </div>
  );
}

interface HemingTurn {
  question: string | null; // null: lượt phân tích tổng quan đầu tiên
  answer: string;
  error?: boolean;
}

export default function HemingPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // ─── 双方命盘状态 ─────────────────────────────────────────
  const [chartA, setChartA] = useState<ZiweiChart | null>(null);
  const [chartB, setChartB] = useState<ZiweiChart | null>(null);
  // 双方表单状态由 BirthForm onFormSave 同步到此处，统一按钮触发起盘
  const [formA, setFormA] = useState<BirthFormState | null>(null);
  const [formB, setFormB] = useState<BirthFormState | null>(null);

  // ─── AI 合盘分析状态：mỗi lượt hỏi đáp được giữ lại ───────
  const [turns, setTurns] = useState<HemingTurn[]>([]);
  const turnsRef = useRef<HemingTurn[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [question, setQuestion] = useState('');
  const [analysisError, setAnalysisError] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const analysisRef = useRef<HTMLDivElement>(null);
  const lastTurnRef = useRef<HTMLDivElement>(null);

  // ─── 起盘（单次调用，返回 chart 给统一流程使用）──────────
  const generateChart = useCallback(async (info: BirthInfo): Promise<ZiweiChart | null> => {
    try {
      return buildChart(info);
    } catch {
      return null;
    }
  }, []);

  // 表单是否填齐
  const isFormReady = (f: BirthFormState | null): boolean =>
    !!(f && f.year && f.month && f.day && f.gender && (f.unknownTime || (f.clockHour !== '' && f.clockMinute !== '')));

  // ─── 统一入口：起盘 + 合盘分析 ─────────────────────────────
  // q === undefined: hợp bàn mới (xóa lượt cũ); có q: hỏi tiếp, giữ lịch sử nếu lá số không đổi.
  const runAnalysis = useCallback(async (q?: string) => {
    setFormError(null);
    if (!isFormReady(formA) || !isFormReady(formB)) {
      setFormError('Vui lòng điền đầy đủ thông tin ngày giờ sinh của cả hai người');
      return;
    }
    setAnalysisError(false);

    // 每次按当前表单起盘，避免编辑出生信息后复用旧盘。
    const [cA, cB] = await Promise.all([
      generateChart(formToBirthInfo(formA!)),
      generateChart(formToBirthInfo(formB!)),
    ]);
    if (!cA || !cB) {
      setAnalysisError(true);
      return;
    }
    const sameCharts = !!chartA && !!chartB
      && JSON.stringify(chartA.birthInfo) === JSON.stringify(cA.birthInfo)
      && JSON.stringify(chartB.birthInfo) === JSON.stringify(cB.birthInfo);
    setChartA(cA);
    setChartB(cB);

    const previous = q !== undefined && sameCharts ? turnsRef.current : [];
    const history = previous
      .filter(t => !t.error && t.answer)
      .map(t => ({ question: t.question ?? undefined, answer: t.answer }));
    let current: HemingTurn = { question: q?.trim() || null, answer: '' };
    const commit = (turn: HemingTurn) => {
      current = turn;
      turnsRef.current = [...previous, turn];
      setTurns(turnsRef.current);
    };
    commit(current);
    setAnalyzing(true);
    setTimeout(() => (previous.length ? lastTurnRef : analysisRef).current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);

    try {
      const res = await apiRequest('/api/heming', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chartA: cA, chartB: cB, question: current.question ?? undefined, history }),
      });
      if (!res.ok || !res.body) throw new Error();

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = '';
      let pendingLine = '';
      let interrupted = false; // máy chủ báo đứt giữa chừng

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        pendingLine += decoder.decode(value, { stream: true });
        const lines = pendingLine.split('\n');
        pendingLine = lines.pop() ?? '';
        let changed = false;
        for (const rawLine of lines) {
          const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') break;
          try {
            const event = JSON.parse(data);
            if (typeof event.error === 'string') interrupted = true;
            const delta = event.delta?.text ?? '';
            if (delta) { text += delta; changed = true; }
          } catch { /* skip */ }
        }
        if (changed) commit({ ...current, answer: text });
      }
      if (!text || interrupted) throw new Error();
    } catch {
      commit({ ...current, error: true });
    } finally {
      setAnalyzing(false);
    }
  }, [formA, formB, chartA, chartB, generateChart]);

  const ask = (q: string) => {
    if (!q.trim() || analyzing) return;
    setQuestion('');
    runAnalysis(q);
  };

  const cardStyle = {
    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.9)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(200,160,60,0.2)'}`,
    borderRadius: '16px',
    padding: '24px',
  };

  const labelStyle = {
    fontSize: '10px', letterSpacing: '0.4em', color: 'var(--ac)', opacity: 0.7,
    marginBottom: '16px', display: 'block',
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)' }}>
      {/* 顶栏 */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: isDark ? 'rgba(2,8,16,0.88)' : 'rgba(250,245,235,0.92)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--bdr)',
        display: 'flex', alignItems: 'center', padding: '0 24px', height: '52px', gap: '16px',
      }}>
        <button
          onClick={() => router.push('/')}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px',
            color: 'var(--tx-3)', background: 'none', border: 'none', cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: '16px' }}>‹</span>
          <span>Quay lại</span>
        </button>
        <div style={{ width: '1px', height: '20px', background: 'var(--bdr-med)' }} />
        <span style={{ fontSize: '12px', color: 'var(--ac)', letterSpacing: '0.2em' }}>Hợp bàn hai người</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '11px', color: 'var(--tx-3)' }}>Tình duyên · Hợp tác · Cha mẹ con cái · Bạn bè</span>
      </header>

      {/* 主体 */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px 80px' }}>

        {/* 标题 */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{ fontSize: '28px', color: 'var(--ac)', opacity: 0.15, marginBottom: '12px' }}>☯</div>
          <h1 style={{ fontSize: '22px', fontWeight: 600, letterSpacing: '0.15em', color: 'var(--tx-0)', marginBottom: '8px' }}>
            Hợp bàn Tử Vi
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--tx-3)', lineHeight: 1.6 }}>
            Nhập thông tin ngày giờ sinh của hai người, AI phân tích mức độ hợp duyên, xu hướng tình cảm và gợi ý cách chung sống dựa trên hai lá số
          </p>
        </div>

        {/* 双栏表单 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}
          className="heming-grid">
          {/* 甲方 */}
          <div style={cardStyle}>
            <span style={labelStyle}>Người A</span>
            <BirthForm
              hideSubmit
              onSubmit={() => {}}
              onFormSave={setFormA}
            />
          </div>

          {/* 乙方 */}
          <div style={cardStyle}>
            <span style={labelStyle}>Người B</span>
            <BirthForm
              hideSubmit
              onSubmit={() => {}}
              onFormSave={setFormB}
            />
          </div>
        </div>

        {/* ═══ 大合盘分析框（视觉中心，始终显示）════════════════ */}
        <div ref={analysisRef} style={{
          ...cardStyle,
          minHeight: '320px',
          padding: '32px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: turns.length === 0 ? 'center' : 'flex-start',
        }}>
          {/* 区块标题 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: turns.length ? '20px' : '24px' }}>
            <span style={{ color: 'var(--ac)', opacity: 0.6 }}>◉</span>
            <span style={{ fontSize: '11px', letterSpacing: '0.3em', color: 'var(--tx-3)' }}>HỢP BÀN · HEMING</span>
          </div>

          {/* 状态分支 */}
          {turns.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: '13px', color: 'var(--tx-3)', marginBottom: '24px', lineHeight: 1.7 }}>
                Sau khi điền xong thông tin của cả hai người, bấm nút bên dưới<br />
                AI sẽ phân tích sâu mức độ hợp duyên giữa hai người
              </div>
              <button
                onClick={() => runAnalysis()}
                style={{
                  padding: '14px 40px', borderRadius: 'var(--r-pill)', border: 'none',
                  background: 'linear-gradient(135deg, #9a6210, #c88020)',
                  color: '#fff8e8', fontSize: '14px', fontWeight: 600,
                  letterSpacing: '0.15em', cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(140,100,20,0.25)',
                  transition: 'transform 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
              >
                Bắt đầu hợp bàn
              </button>
              {formError && (
                <div style={{ marginTop: '20px', fontSize: '13px', color: '#dc2626' }}>
                  {formError}
                </div>
              )}
            </div>
          )}

          {turns.map((turn, i) => {
            const isLast = i === turns.length - 1;
            return (
              <div key={i} ref={isLast ? lastTurnRef : undefined} style={{
                scrollMarginTop: '72px',
                ...(i > 0 ? { marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--bdr)' } : {}),
              }}>
                {turn.question && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '14px' }}>
                    <div style={{
                      maxWidth: '85%', padding: '8px 14px', borderRadius: '12px', fontSize: '13px',
                      background: 'rgba(212,168,67,0.08)', border: '1px solid rgba(212,168,67,0.22)', color: 'var(--ac)',
                    }}>
                      {turn.question}
                    </div>
                  </div>
                )}
                {isLast && analyzing && !turn.answer && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '28px 0', color: 'var(--tx-3)', fontSize: '13px' }}>
                    <div style={{
                      width: '14px', height: '14px',
                      border: '2px solid var(--bdr-med)', borderTopColor: 'var(--ac)',
                      borderRadius: '50%', animation: 'spin 0.8s linear infinite',
                    }} />
                    {turn.question ? 'Đang trả lời…' : 'Đang đối chiếu hai lá số…'}
                  </div>
                )}
                {turn.answer && <AiContent text={turn.answer} streaming={isLast && analyzing} />}
                {turn.error && (
                  <div style={{ padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--bdr)', background: 'var(--bg-card)', fontSize: '13px', color: 'var(--tx-2)', marginTop: '12px' }}>
                    {turn.answer ? 'Câu trả lời bị gián đoạn, vui lòng hỏi lại.' : 'Tạm thời không phân tích được, vui lòng kiểm tra kết nối máy chủ và thử lại.'}
                  </div>
                )}
              </div>
            );
          })}

          {analysisError && (
            <div style={{ padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--bdr)', background: 'var(--bg-card)', fontSize: '13px', color: 'var(--tx-2)', marginTop: '12px' }}>
              Không lập được lá số từ thông tin đã nhập, vui lòng kiểm tra lại ngày giờ sinh.
            </div>
          )}
        </div>

        {/* ═══ 针对合盘的追问聊天框（仅分析完成后显示）═══════════ */}
        {turns.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', letterSpacing: '0.2em', color: 'var(--tx-3)' }}>Hỏi thêm về lần hợp bàn này</span>
              <button
                onClick={() => runAnalysis()}
                disabled={analyzing}
                style={{ fontSize: '11px', color: 'var(--tx-3)', background: 'none', border: 'none', cursor: analyzing ? 'not-allowed' : 'pointer', textDecoration: 'underline', textUnderlineOffset: '2px' }}
              >
                Hợp bàn lại từ đầu
              </button>
            </div>

            {/* 快捷问题 */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[
                'Mức độ hợp nhau về tình cảm thế nào?',
                'Hai người có hợp hùn vốn làm ăn không?',
                'Hai người kết hôn có phù hợp không?',
                'Về mặt nào dễ phát sinh mâu thuẫn nhất?',
                'Tài vận của hai người có bổ trợ cho nhau không?',
              ].map(q => (
                <button
                  key={q}
                  onClick={() => ask(q)}
                  disabled={analyzing}
                  style={{
                    fontSize: '12px', padding: '6px 14px',
                    borderRadius: 'var(--r-pill)',
                    border: '1px solid var(--bdr-med)',
                    background: 'transparent', color: 'var(--tx-2)',
                    cursor: analyzing ? 'not-allowed' : 'pointer',
                    opacity: analyzing ? 0.5 : 1,
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => { if (!analyzing) (e.currentTarget as HTMLElement).style.borderColor = 'var(--ac-bdr)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--bdr-med)'; }}
                >
                  {q}
                </button>
              ))}
            </div>

            {/* 输入框 + 追问按钮 */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') ask(question); }}
                placeholder="Hỏi thêm, vd: những năm nào là giai đoạn then chốt của tình cảm hai người?"
                disabled={analyzing}
                className="input-base"
                style={{ fontSize: '13px', flex: 1 }}
              />
              <button
                onClick={() => ask(question)}
                disabled={analyzing || !question.trim()}
                style={{
                  padding: '10px 20px', borderRadius: 'var(--r-sm)', border: 'none',
                  background: analyzing ? 'var(--bg-2)' : 'var(--tx-0)',
                  color: analyzing ? 'var(--tx-3)' : 'white',
                  fontSize: '13px', fontWeight: 500,
                  cursor: analyzing ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s', whiteSpace: 'nowrap',
                }}
              >
                {analyzing ? 'Đang phân tích…' : 'Hỏi thêm'}
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 680px) {
          .heming-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
