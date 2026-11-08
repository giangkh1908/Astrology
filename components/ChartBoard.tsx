'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ZiweiChart, Palace, Star } from '@/lib/ziwei/types';
import { viStar, viPalace, viBranch, viStem, viStemBranch, viWuxingJu, viTerm, viShichen, viShichenRange } from '@/lib/vn/terms';
import { TUAN_KEYS, TRIET_KEYS, napAm, hanhOfNapAm, hanhOfCuc, menhCucRelation, hanhName } from '@/lib/vn/star-meta';
import PalaceCell, { type CellMarker } from './PalaceCell';
import TimeNav, { type TimeView, getYearStemIndex, buildSiHuaOverlay } from './TimeNav';
import { currentVnLunarYear } from '@/lib/vn/lunar-vn';

interface ChartBoardProps {
  chart: ZiweiChart;
  onStarSelect?: (star: Star, palace: Palace) => void;
  onPalaceSelect?: (palace: Palace) => void;
  onSiHuaClick?: (starName: string, siHua: string, view: TimeView) => void;
  onTimeSelectionChange?: (selection: { view: TimeView; lunarYear: number }) => void;
}

const BRANCH_GRID_POS: Record<number, [number, number]> = {
  5: [1, 1], 6: [1, 2], 7: [1, 3], 8: [1, 4],
  4: [2, 1], 9: [2, 4],
  3: [3, 1], 10: [3, 4],
  2: [4, 1], 1: [4, 2], 0: [4, 3], 11: [4, 4],
};

// 每个地支宫位在网格中的中心坐标（百分比）
const BRANCH_SVG_POS: Record<number, [number, number]> = {
  5: [12.5, 12.5], 6: [37.5, 12.5], 7: [62.5, 12.5], 8: [87.5, 12.5],
  4: [12.5, 37.5],                                      9: [87.5, 37.5],
  3: [12.5, 62.5],                                     10: [87.5, 62.5],
  2: [12.5, 87.5], 1: [37.5, 87.5], 0: [62.5, 87.5], 11: [87.5, 87.5],
};

// 绕盘面顺时针排列（用于三方四正四边形排序）
const CLOCKWISE_INDEX: Record<number, number> = {
  5: 0, 6: 1, 7: 2, 8: 3,
  9: 4, 10: 5,
  11: 6, 0: 7, 1: 8, 2: 9,
  3: 10, 4: 11,
};

function sortClockwise(branches: number[]): number[] {
  return [...branches].sort((a, b) => CLOCKWISE_INDEX[a] - CLOCKWISE_INDEX[b]);
}

/** 三方四正：本宫 + 对宫 + 两个三合宫 */
function getSanFangSiZheng(branch: number): [number, number, number, number] {
  return [
    branch,
    (branch + 6) % 12,   // 对宫
    (branch + 4) % 12,   // 三合1
    (branch + 8) % 12,   // 三合2
  ];
}

const ANIMATION_ORDER = [5, 6, 7, 8, 9, 10, 11, 0, 1, 2, 3, 4];

export default function ChartBoard({ chart, onStarSelect, onPalaceSelect, onSiHuaClick, onTimeSelectionChange }: ChartBoardProps) {
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [timeView, setTimeView] = useState<TimeView>('mingpan');
  const [liunianYear, setLiunianYear] = useState<number>(currentVnLunarYear());

  useEffect(() => {
    onTimeSelectionChange?.({ view: timeView, lunarYear: liunianYear });
  }, [timeView, liunianYear, onTimeSelectionChange]);

  const palaceMap: Record<number, Palace> = {};
  chart.palaces.forEach(p => { palaceMap[p.branch] = p; });

  // 计算当前叠加四化数据（大限或流年）
  const currentDx = chart.daXians[chart.currentDaXianIndex];
  const overlayData: Record<string, string> = (() => {
    if (timeView === 'daxian' && currentDx) {
      const dxPalace = chart.palaces.find(p => p.branch === currentDx.palaceBranch);
      if (dxPalace) return buildSiHuaOverlay(dxPalace.stem);
    }
    if (timeView === 'liunian') {
      return buildSiHuaOverlay(getYearStemIndex(liunianYear));
    }
    return {};
  })();
  const overlayLabel = timeView === 'daxian' ? 'Hạn' : timeView === 'liunian' ? 'Niên' : undefined;

  const handlePalaceClick = (branch: number) => {
    const isDeselecting = selectedBranch === branch;
    setSelectedBranch(prev => prev === branch ? null : branch);
    if (!isDeselecting) {
      const palace = palaceMap[branch];
      if (palace) onPalaceSelect?.(palace);
    }
  };

  // 三方四正
  const sanFangBranches = selectedBranch !== null ? getSanFangSiZheng(selectedBranch) : null;
  const sanFangSet = sanFangBranches ? new Set(sanFangBranches) : null;

  // Tuần, Triệt: gắn vào ô cung nằm trên/bên trái của cặp, vẽ sát đường ranh giới
  const markersByBranch: Record<number, CellMarker[]> = {};
  const addMarker = (keys: Set<string>, kind: CellMarker['kind'], name: string) => {
    const bs = chart.palaces.filter(p => p.stars.some(s => keys.has(s.name))).map(p => p.branch);
    if (bs.length !== 2) return;
    const [ga, gb] = [BRANCH_GRID_POS[bs[0]], BRANCH_GRID_POS[bs[1]]];
    const sameRow = ga[0] === gb[0];
    const host = sameRow ? (ga[1] < gb[1] ? bs[0] : bs[1]) : (ga[0] < gb[0] ? bs[0] : bs[1]);
    (markersByBranch[host] ??= []).push({
      kind,
      side: sameRow ? 'right' : 'bottom',
      title: `${name}: ${bs.map(x => viBranch(x)).join(', ')}`,
    });
  };
  addMarker(TUAN_KEYS, 'tuan', 'Tuần trung không vong');
  addMarker(TRIET_KEYS, 'triet', 'Triệt lộ không vong');

  // Ô giữa: thông tin đương số
  const li = chart.lunarInfo;
  const bi = chart.birthInfo;
  const lunarMonth = Math.abs(li.lunarMonth);
  const monthName = lunarMonth === 1 ? 'Giêng' : lunarMonth === 12 ? 'Chạp' : String(lunarMonth);
  const banMenh = napAm(li.yearStem, li.yearBranch);
  const menhHanh = hanhOfNapAm(banMenh);
  const cucHanh = hanhOfCuc(chart.wuxingJuName);
  const relation = menhHanh && cucHanh ? menhCucRelation(menhHanh, cucHanh) : '';
  const dxNow = chart.currentDaXianIndex >= 0 ? chart.daXians[chart.currentDaXianIndex] : null;
  const pillars = li.fourPillarsLunar ?? li.fourPillars;

  type Row = [string, React.ReactNode];
  const infoRows: Row[] = [];
  if (bi.name) infoRows.push(['Họ tên', <strong key="n">{bi.name}</strong>]);
  infoRows.push(['Dương lịch', `${bi.day}/${bi.month}/${bi.year}`]);
  infoRows.push(['Âm lịch', `Ngày ${li.lunarDay} tháng ${monthName}${li.isLeapMonth ? ' (nhuận)' : ''} năm ${viStem(li.yearStem)} ${viBranch(li.yearBranch)}`]);
  infoRows.push(['Giờ sinh', `Giờ ${viShichen(bi.hour)} (${viShichenRange(bi.hour)})`]);
  if (chart.yinYangGender) infoRows.push(['Âm dương', viTerm(chart.yinYangGender)]);
  infoRows.push(['Bản mệnh', <span key="m" className={menhHanh ? `ls-h-${menhHanh}` : undefined} style={{ fontWeight: 600 }}>{banMenh}</span>]);
  infoRows.push(['Cục', (
    <span key="c">
      <span className={cucHanh ? `ls-h-${cucHanh}` : undefined} style={{ fontWeight: 600 }}>{viWuxingJu(chart.wuxingJuName)}</span>
      {relation ? <span className="ls-info-note"> ({relation})</span> : null}
    </span>
  )]);
  if (chart.mingZhu) infoRows.push(['Mệnh chủ', viStar(chart.mingZhu)]);
  if (chart.shenZhu) infoRows.push(['Thân chủ', viStar(chart.shenZhu)]);
  if (dxNow) infoRows.push(['Đại hạn', `${dxNow.startAge}–${dxNow.endAge} tuổi, cung ${viPalace(dxNow.palaceName)}`]);

  return (
    <div className="w-full select-none ls-root">
      <TimeNav
        chart={chart}
        view={timeView}
        liunianYear={liunianYear}
        onViewChange={setTimeView}
        onYearChange={setLiunianYear}
      />

      <div className="ls-board">
        {ANIMATION_ORDER.map((branch) => {
          const [row, col] = BRANCH_GRID_POS[branch];
          const palace = palaceMap[branch];
          if (!palace) return null;
          return (
            <div key={branch} style={{ gridRow: row, gridColumn: col, minWidth: 0 }}>
              <PalaceCell
                palace={palace}
                onClick={() => handlePalaceClick(branch)}
                onStarClick={(star) => onStarSelect?.(star, palace)}
                isSelected={selectedBranch === branch}
                isSanFang={!!(sanFangSet?.has(branch) && selectedBranch !== branch)}
                overlayStarSiHua={Object.keys(overlayData).length > 0 ? overlayData : undefined}
                overlayLabel={overlayLabel}
                onSiHuaClick={(starName, siHua) => onSiHuaClick?.(starName, siHua, timeView)}
                markers={markersByBranch[branch]}
              />
            </div>
          );
        })}

        {/* Ô giữa */}
        <div className="palace-center-tile ls-center" style={{ gridRow: '2 / 4', gridColumn: '2 / 4' }}>
          <h2 className="ls-title">Lá số Tử Vi</h2>
          <dl className="ls-info">
            {infoRows.map(([k, v]) => (
              <div key={k} className="ls-info-row">
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          {pillars && (
            <div className="ls-pillars" title="Tứ trụ: năm, tháng, ngày, giờ">
              {pillars.map((p, i) => <span key={i}>{viStemBranch(p)}</span>)}
            </div>
          )}
        </div>

        {/* Tam phương tứ chính */}
        <AnimatePresence>
          {sanFangBranches !== null && (
            <motion.div
              key={`sf-${selectedBranch}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-none"
              style={{ position: 'absolute', inset: 0, zIndex: 20 }}
            >
              <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
                {(() => {
                  const [p0, p1, p2, p3] = sanFangBranches.map(b => BRANCH_SVG_POS[b]);
                  const seg = (a: [number, number], b: [number, number], k: string) => (
                    <line key={k} x1={`${a[0]}%`} y1={`${a[1]}%`} x2={`${b[0]}%`} y2={`${b[1]}%`}
                      stroke="var(--ls-sel)" strokeOpacity={0.55} strokeWidth={1.5} strokeDasharray="6,5" strokeLinecap="round" />
                  );
                  return (
                    <>
                      {seg(p0, p1, 'a')}{seg(p0, p2, 'b')}{seg(p2, p3, 'c')}{seg(p3, p0, 'd')}
                      {[p0, p1, p2, p3].map((p, i) => (
                        <circle key={i} cx={`${p[0]}%`} cy={`${p[1]}%`} r={i === 0 ? 3.5 : 2.5} fill="var(--ls-sel)" fillOpacity={i === 0 ? 0.85 : 0.5} />
                      ))}
                    </>
                  );
                })()}
              </svg>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Chú giải */}
      <div className="ls-legend">
        <div className="ls-legend-group" aria-label="Màu ngũ hành">
          {(['kim', 'moc', 'thuy', 'hoa', 'tho'] as const).map(h => (
            <span key={h} className={`ls-legend-hanh ls-h-${h}`}>{hanhName(h)}</span>
          ))}
        </div>
        <div className="ls-legend-group" aria-label="Tứ Hóa">
          <span className="ls-hoa ls-hoa-loc">Lộc</span>
          <span className="ls-hoa ls-hoa-quyen">Quyền</span>
          <span className="ls-hoa ls-hoa-khoa">Khoa</span>
          <span className="ls-hoa ls-hoa-ky">Kỵ</span>
        </div>
        <p className="ls-legend-note">
          M Miếu, V Vượng, Đ Đắc, B Bình, H Hãm. Bấm vào một cung để xem tam phương tứ chính.
        </p>
      </div>
    </div>
  );
}
