// src/components/charts/ControlChart.tsx
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ChartPoint {
  index: number;
  timestamp: string;
  value: number;
}

interface ControlChartProps {
  title: string;
  points: ChartPoint[];
  mean: number;
  ucl: number;
  lcl: number;
  violatingIndices: Set<number>;
  valueFormatter?: (value: number) => string;
}

const VIEW_W = 640;
const VIEW_H = 220;
const PAD_LEFT = 44;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;

function formatTimeShort(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function ControlChart({ title, points, mean, ucl, lcl, violatingIndices, valueFormatter }: ControlChartProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverI, setHoverI] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const format = valueFormatter ?? ((v: number) => v.toFixed(2));

  const { plotted, plotW, plotH, yFor } = useMemo(() => {
    const plotW = VIEW_W - PAD_LEFT - PAD_RIGHT;
    const plotH = VIEW_H - PAD_TOP - PAD_BOTTOM;

    const values = points.map((p) => p.value);
    const rawMin = Math.min(...values, lcl);
    const rawMax = Math.max(...values, ucl);
    const span = rawMax - rawMin || 1;
    const min = rawMin - span * 0.08;
    const max = rawMax + span * 0.08;

    const xFor = (i: number) => PAD_LEFT + (points.length <= 1 ? 0 : (i / (points.length - 1)) * plotW);
    const yFor = (v: number) => PAD_TOP + plotH - ((v - min) / (max - min)) * plotH;

    const plotted = points.map((p, i) => ({ ...p, x: xFor(i), y: yFor(p.value) }));

    return { plotted, plotW, plotH, yFor };
  }, [points, ucl, lcl]);

  const pathD = plotted.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  const hovered = hoverI !== null ? plotted[hoverI] : null;

  const handleMouseMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const fractionX = (e.clientX - rect.left) / rect.width;
    const viewX = fractionX * VIEW_W;
    const fractionAlongPlot = (viewX - PAD_LEFT) / plotW;
    const idx = Math.round(fractionAlongPlot * (points.length - 1));
    setHoverI(Math.min(points.length - 1, Math.max(0, idx)));
  };

  const xLabelIndexes = points.length > 1 ? [0, Math.floor((points.length - 1) / 2), points.length - 1] : [0];

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-slate-200">{title}</h4>
        <button
          onClick={() => setShowTable((s) => !s)}
          className="text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2"
        >
          {showTable ? t('chart.showAsChart') : t('chart.showAsTable')}
        </button>
      </div>

      {showTable ? (
        <div className="max-h-56 overflow-y-auto border border-slate-700 rounded">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-800">
              <tr className="text-slate-400 border-b border-slate-700">
                <th className="py-1.5 px-3">{t('chart.colTime')}</th>
                <th className="py-1.5 px-3">{t('chart.colValue')}</th>
                <th className="py-1.5 px-3">{t('chart.colStatus')}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.index} className="border-b border-slate-700/50 text-slate-200">
                  <td className="py-1.5 px-3 tabular-nums">{formatTimeShort(p.timestamp)}</td>
                  <td className="py-1.5 px-3 tabular-nums">{format(p.value)}</td>
                  <td className="py-1.5 px-3">
                    {violatingIndices.has(p.index) ? (
                      <span className="text-red-400 font-semibold">{t('chart.violation')}</span>
                    ) : (
                      <span className="text-slate-500">{t('chart.normal')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={containerRef} className="relative">
          <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full h-auto block" role="img" aria-label={title}>
            {/* UCL / LCL — recessive dashed threshold lines, not a data series */}
            <line x1={PAD_LEFT} x2={VIEW_W - PAD_RIGHT} y1={yFor(ucl)} y2={yFor(ucl)} stroke="#f59e0b" strokeWidth={1} strokeDasharray="4 3" opacity={0.7} />
            <text x={VIEW_W - PAD_RIGHT} y={yFor(ucl) - 4} textAnchor="end" fontSize={9} fill="#f59e0b">UCL {format(ucl)}</text>
            <line x1={PAD_LEFT} x2={VIEW_W - PAD_RIGHT} y1={yFor(lcl)} y2={yFor(lcl)} stroke="#f59e0b" strokeWidth={1} strokeDasharray="4 3" opacity={0.7} />
            <text x={VIEW_W - PAD_RIGHT} y={yFor(lcl) + 11} textAnchor="end" fontSize={9} fill="#f59e0b">LCL {format(lcl)}</text>

            {/* Centerline (mean) */}
            <line x1={PAD_LEFT} x2={VIEW_W - PAD_RIGHT} y1={yFor(mean)} y2={yFor(mean)} stroke="#94a3b8" strokeWidth={1} />
            <text x={PAD_LEFT - 8} y={yFor(mean) + 3} textAnchor="end" fontSize={9} fill="#94a3b8">{format(mean)}</text>

            {xLabelIndexes.map((i) => (
              <text
                key={i}
                x={plotted[i].x}
                y={VIEW_H - 8}
                textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
                fontSize={10}
                fill="#898781"
              >
                {formatTimeShort(plotted[i].timestamp)}
              </text>
            ))}

            <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

            {plotted.map((p) => {
              const isViolation = violatingIndices.has(p.index);
              return (
                <circle
                  key={p.index}
                  cx={p.x}
                  cy={p.y}
                  r={isViolation ? 6 : 3}
                  fill={isViolation ? '#ef4444' : '#3b82f6'}
                  stroke="#1e293b"
                  strokeWidth={isViolation ? 2 : 1}
                />
              );
            })}

            {hovered && (
              <line x1={hovered.x} x2={hovered.x} y1={PAD_TOP} y2={VIEW_H - PAD_BOTTOM} stroke="#64748b" strokeWidth={1} strokeDasharray="3 3" />
            )}

            <rect
              x={PAD_LEFT}
              y={PAD_TOP}
              width={plotW}
              height={plotH}
              fill="transparent"
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoverI(null)}
            />
          </svg>

          {hovered && (
            <div
              className="absolute top-1 pointer-events-none bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-slate-100 shadow-lg"
              style={{
                left: `${(hovered.x / VIEW_W) * 100}%`,
                transform: hovered.x > VIEW_W * 0.7 ? 'translateX(-100%)' : 'translateX(0)',
              }}
            >
              <div className="text-slate-400">{formatTimeShort(hovered.timestamp)}</div>
              <div className="font-semibold">{format(hovered.value)}</div>
              {violatingIndices.has(hovered.index) && <div className="text-red-400 font-semibold">{t('chart.violationPoint')}</div>}
            </div>
          )}

          <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" /> {t('chart.normalReading')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> {t('chart.violationPointLegend')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
