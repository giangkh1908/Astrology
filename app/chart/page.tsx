'use client';
import { useState } from 'react';
import BirthForm from '@/components/BirthForm';
import ChartBoard from '@/components/ChartBoard';
import InsightPanel from '@/components/InsightPanel';
import { generateChart } from '@/lib/ziwei/algorithm';
import { diffCharts } from '@/lib/vn/compare';
import type { BirthInfo, Palace, ZiweiChart } from '@/lib/ziwei/types';
import type { TimeView } from '@/components/TimeNav';
import { currentVnLunarYear } from '@/lib/vn/lunar-vn';

type CalendarMode = 'vn' | 'cn';

/**
 * Trang lá số — bản demo engine mã nguồn mở.
 *
 * Lập song song 2 lá số: theo âm lịch Việt Nam (UTC+7) và theo âm lịch Trung Quốc (UTC+8, cách gốc
 * của engine). Cùng giờ mặt trời thật, cùng cách an sao — chỉ khác lịch. Người dùng chuyển qua lại
 * và xem bảng khác biệt.
 */
export default function ChartPage() {
  const [info, setInfo] = useState<BirthInfo | null>(null);
  const [mode, setMode] = useState<CalendarMode>('vn');
  const [selectedPalace, setSelectedPalace] = useState<Palace | null>(null);
  const [selectedTime, setSelectedTime] = useState<{ view: TimeView; lunarYear: number }>({ view: 'mingpan', lunarYear: currentVnLunarYear() });

  const [charts, setCharts] = useState<{ vn: ZiweiChart; cn: ZiweiChart; diff: ReturnType<typeof diffCharts> } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function submit(b: BirthInfo) {
    setLoading(true);
    setError(false);
    try {
      // Keep charting in the browser: this page should work without a FastAPI server.
      // Run sequentially because the chart engine adjusts shared astro config.
      const vn = generateChart(b);
      const cn = generateChart({ ...b, lunarTimeZone: undefined });
      setInfo(b);
      setMode('vn');
      setCharts({ vn, cn, diff: diffCharts(vn, cn) });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (!charts) {
    return (
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
    );
  }

  const chart = mode === 'vn' ? charts.vn : charts.cn;
  const same = charts.diff.length === 0;

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', cursor: 'pointer', borderRadius: 8, fontSize: 14,
    border: `1px solid ${active ? '#b8860b' : '#ccc'}`,
    background: active ? 'rgba(184,134,11,0.12)' : 'transparent',
    fontWeight: active ? 600 : 400,
  });

  // ── 已起盘：命盘 + 解读 ──
  return (
    <main style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => { setInfo(null); setCharts(null); setSelectedPalace(null); }}
          style={{ padding: '6px 14px', cursor: 'pointer', border: '1px solid #ccc', borderRadius: 8, background: 'transparent' }}
        >
          ← Lập lá số mới
        </button>
        <span style={{ marginLeft: 8, fontSize: 14, color: '#888' }}>Âm lịch:</span>
        <button type="button" style={tabStyle(mode === 'vn')} onClick={() => { setMode('vn'); setSelectedPalace(null); setSelectedTime({ view: 'mingpan', lunarYear: currentVnLunarYear() }); }}>
          Việt Nam (UTC+{info?.lunarTimeZone ?? 8})
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

      {!same && (
      <section
        style={{
          marginBottom: 16, padding: '12px 16px', borderRadius: 10, fontSize: 14, lineHeight: 1.6,
          border: '1px solid rgba(205,92,92,0.45)',
          background: 'rgba(205,92,92,0.07)',
        }}
      >
          <>
            <div style={{ marginBottom: 8 }}>
              <strong>Lá số Việt Nam và Trung Quốc khác nhau ({charts.diff.length} điểm).</strong>{' '}
              Cùng giờ mặt trời thật, cùng cách an sao; chỉ khác ngày âm lịch do múi giờ tính lịch (UTC+7 so với UTC+8).
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 480 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#888' }}>
                    <th style={{ padding: '4px 8px' }}>Mục</th>
                    <th style={{ padding: '4px 8px' }}>Việt Nam</th>
                    <th style={{ padding: '4px 8px' }}>Trung Quốc</th>
                  </tr>
                </thead>
                <tbody>
                  {charts.diff.map((d, i) => (
                    <tr key={i} style={{ borderTop: '1px solid rgba(128,128,128,0.2)' }}>
                      <td style={{ padding: '4px 8px', fontWeight: d.kind === 'palace' ? 400 : 600 }}>{d.label}</td>
                      <td style={{ padding: '4px 8px' }}>{d.vn}</td>
                      <td style={{ padding: '4px 8px' }}>{d.cn}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
      </section>
      )}

      {/* TimeNav nằm trong ChartBoard (điều khiển lớp phủ Tứ Hóa) — không render thêm ở đây */}
      <div
        className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]"
        style={{ gap: 20, alignItems: 'start' }}
      >
        <ChartBoard key={mode} chart={chart} onPalaceSelect={setSelectedPalace} onTimeSelectionChange={setSelectedTime} />
        <InsightPanel chart={chart} selectedPalace={selectedPalace} selectedTime={selectedTime} />
      </div>
    </main>
  );
}
