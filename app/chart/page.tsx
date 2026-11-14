'use client';
import { useState } from 'react';
import PageTopBar from '@/components/PageTopBar';
import BirthForm from '@/components/BirthForm';
import ChartBoard from '@/components/ChartBoard';
import InsightPanel from '@/components/InsightPanel';
import { generateChart } from '@/lib/ziwei/algorithm';
import type { BirthInfo, Palace, ZiweiChart } from '@/lib/ziwei/types';
import type { TimeView } from '@/components/TimeNav';
import { currentVnLunarYear } from '@/lib/vn/lunar-vn';

/**
 * Trang lá số — bản demo engine mã nguồn mở.
 *
 * Lập lá số theo âm lịch Việt Nam và giờ mặt trời thật.
 */
export default function ChartPage() {
  const [info, setInfo] = useState<BirthInfo | null>(null);
  const [selectedPalace, setSelectedPalace] = useState<Palace | null>(null);
  const [selectedTime, setSelectedTime] = useState<{ view: TimeView; lunarYear: number }>({ view: 'mingpan', lunarYear: currentVnLunarYear() });

  const [chart, setChart] = useState<ZiweiChart | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function submit(b: BirthInfo) {
    setLoading(true);
    setError(false);
    try {
      // Keep charting in the browser: this page should work without a FastAPI server.
      // Run sequentially because the chart engine adjusts shared astro config.
      const next = generateChart(b);
      setInfo(b);
      setChart(next);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (!chart) {
    return (
      <>
      <PageTopBar title="Lập lá số" />
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 20px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Lập lá số Tử Vi Đẩu Số</h1>
        <p style={{ color: '#888', marginBottom: 32, fontSize: 14, lineHeight: 1.7 }}>
          Nhập ngày giờ sinh, engine an sao mã nguồn mở sẽ lập lá số ngay lập tức.
          <br />
          (Trang này là bản demo của engine; phần lõi an sao được mở hoàn toàn.)
        </p>
        <BirthForm onSubmit={submit} />
        {loading && <p>Đang lập lá số…</p>}
        {error && <p role="alert">Không thể lập lá số. Vui lòng kiểm tra lại ngày sinh và giờ sinh.</p>}
      </main>
      </>
    );
  }


  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', cursor: 'pointer', borderRadius: 8, fontSize: 14,
    border: `1px solid ${active ? '#b8860b' : '#ccc'}`,
    background: active ? 'rgba(184,134,11,0.12)' : 'transparent',
    fontWeight: active ? 600 : 400,
  });

  // ── 已起盘：命盘 + 解读 ──
  return (
    <>
    <PageTopBar title="Lá số Tử Vi" />
    <main style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => { setInfo(null); setChart(null); setSelectedPalace(null); }}
          style={{ padding: '6px 14px', cursor: 'pointer', border: '1px solid #ccc', borderRadius: 8, background: 'transparent' }}
        >
          ← Lập lá số mới
        </button>
      </div>

      {info && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 14, color: '#888' }}>Sinh đôi cùng giờ (người sinh sau):</span>
          {([['', 'Không'], ['huynh_de', 'Mệnh tại Huynh Đệ'], ['thien_di', 'Mệnh tại Thiên Di']] as const).map(([m, label]) => (
            <button
              key={m || 'none'}
              type="button"
              style={tabStyle((info.twinMethod ?? '') === m)}
              onClick={() => {
                if ((info.twinMethod ?? '') === m) return;
                const { twinMethod: _drop, ...rest } = info;
                void _drop;
                setSelectedPalace(null);
                void submit(m ? { ...rest, twinMethod: m } : rest);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}


      {/* TimeNav nằm trong ChartBoard (điều khiển lớp phủ Tứ Hóa) — không render thêm ở đây */}
      <div
        className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]"
        style={{ gap: 20, alignItems: 'start' }}
      >
        <ChartBoard chart={chart} onPalaceSelect={setSelectedPalace} onTimeSelectionChange={setSelectedTime} />
        <InsightPanel chart={chart} selectedPalace={selectedPalace} selectedTime={selectedTime} />
      </div>
    </main>
    </>
  );
}
