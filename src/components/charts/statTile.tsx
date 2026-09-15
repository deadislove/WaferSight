// src/components/charts/StatTile.tsx
interface StatTileProps {
  label: string;
  value: string;
  delta?: {
    rawValue: number; // signed; sign drives the arrow direction
    formatted: string; // e.g. "2.3%"
    isGood: boolean; // drives the color, independent of arrow direction
  };
  tone?: 'neutral' | 'good' | 'warning' | 'critical';
}

const TONE_TEXT: Record<NonNullable<StatTileProps['tone']>, string> = {
  neutral: 'text-white',
  good: 'text-emerald-400',
  warning: 'text-amber-400',
  critical: 'text-red-400',
};

export default function StatTile({ label, value, delta, tone = 'neutral' }: StatTileProps) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <p className="text-sm text-slate-400 mb-2">{label}</p>
      <div className="flex items-end gap-2">
        <span className={`text-3xl font-semibold ${TONE_TEXT[tone]}`}>{value}</span>
        {delta && (
          <span className={`text-sm font-medium mb-1 ${delta.isGood ? 'text-emerald-400' : 'text-red-400'}`}>
            {delta.rawValue > 0 ? '▲' : delta.rawValue < 0 ? '▼' : '–'} {delta.formatted}
          </span>
        )}
      </div>
    </div>
  );
}
