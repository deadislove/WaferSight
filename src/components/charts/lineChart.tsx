// src/components/charts/LineChart.tsx
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface TrendPoint {
  date: string;
  value: number;
}

interface LineChartProps {
  title: string;
  data: TrendPoint[];
  color: string;
  valueFormatter?: (value: number) => string;
}

const VIEW_W = 640;
const VIEW_H = 220;
const PAD_LEFT = 40;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;

function formatDateShort(iso: string): string {
  const [, month, day] = iso.split('-');
  return `${month}/${day}`;
}

export default function LineChart({ title, data, color, valueFormatter }: LineChartProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const format = valueFormatter ?? ((v: number) => String(v));

  const { points, yTicks, plotW, plotH } = useMemo(() => {
    const plotW = VIEW_W - PAD_LEFT - PAD_RIGHT;
    const plotH = VIEW_H - PAD_TOP - PAD_BOTTOM;

    const values = data.map((d) => d.value);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const span = rawMax - rawMin || 1;
    const min = rawMin - span * 0.1;
    const max = rawMax + span * 0.1;

    const xFor = (i: number) => PAD_LEFT + (data.length <= 1 ? 0 : (i / (data.length - 1)) * plotW);
    const yFor = (v: number) => PAD_TOP + plotH - ((v - min) / (max - min)) * plotH;

    const points = data.map((d, i) => ({ x: xFor(i), y: yFor(d.value), ...d }));

    const tickCount = 4;
    const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => {
      const v = min + ((max - min) * i) / tickCount;
      return { value: v, y: yFor(v) };
    });

    return { points, yTicks, plotW, plotH };
  }, [data]);

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  const last = points[points.length - 1];
  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  const handleMouseMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const fractionX = (e.clientX - rect.left) / rect.width;
    const viewX = fractionX * VIEW_W;
    const fractionAlongPlot = (viewX - PAD_LEFT) / plotW;
    const idx = Math.round(fractionAlongPlot * (data.length - 1));
    setHoverIndex(Math.min(data.length - 1, Math.max(0, idx)));
  };

  // sparse x-axis labels: first, middle, last
  const xLabelIndexes = data.length > 1 ? [0, Math.floor((data.length - 1) / 2), data.length - 1] : [0];

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
                <th className="py-1.5 px-3">{t('chart.colDate')}</th>
                <th className="py-1.5 px-3">{t('chart.colValue')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.date} className="border-b border-slate-700/50 text-slate-200">
                  <td className="py-1.5 px-3 tabular-nums">{d.date}</td>
                  <td className="py-1.5 px-3 tabular-nums">{format(d.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={containerRef} className="relative">
          <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full h-auto block" role="img" aria-label={title}>
            {yTicks.map((t, i) => (
              <g key={i}>
                <line
                  x1={PAD_LEFT}
                  x2={VIEW_W - PAD_RIGHT}
                  y1={t.y}
                  y2={t.y}
                  stroke="#334155"
                  strokeWidth={1}
                  opacity={0.6}
                />
                <text x={PAD_LEFT - 8} y={t.y + 3} textAnchor="end" fontSize={10} fill="#898781">
                  {format(t.value)}
                </text>
              </g>
            ))}

            {xLabelIndexes.map((i) => (
              <text
                key={i}
                x={points[i].x}
                y={VIEW_H - 8}
                textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}
                fontSize={10}
                fill="#898781"
              >
                {formatDateShort(points[i].date)}
              </text>
            ))}

            <path d={pathD} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

            <circle cx={last.x} cy={last.y} r={4} fill={color} stroke="#1e293b" strokeWidth={2} />
            <text x={last.x - 8} y={last.y - 10} textAnchor="end" fontSize={11} fontWeight={600} fill="#e2e8f0">
              {format(last.value)}
            </text>

            {hovered && (
              <g>
                <line
                  x1={hovered.x}
                  x2={hovered.x}
                  y1={PAD_TOP}
                  y2={VIEW_H - PAD_BOTTOM}
                  stroke="#64748b"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                <circle cx={hovered.x} cy={hovered.y} r={4} fill={color} stroke="#1e293b" strokeWidth={2} />
              </g>
            )}

            <rect
              x={PAD_LEFT}
              y={PAD_TOP}
              width={plotW}
              height={plotH}
              fill="transparent"
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoverIndex(null)}
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
              <div className="text-slate-400">{hovered.date}</div>
              <div className="font-semibold">{format(hovered.value)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
