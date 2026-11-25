import type { ReactNode } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

// Shared with the role dashboard pages so every executive chart uses one palette.
// eslint-disable-next-line react-refresh/only-export-components
export const EXECUTIVE_COLORS = {
  navy: '#00334f',
  indigo: '#4338CA',
  blue: '#0284C7',
  emerald: '#10B981',
  teal: '#14B8A6',
  amber: '#D59A1B',
  rose: '#E11D48',
  violet: '#8B5CF6',
  slate: '#64748B',
};

export function ExecutiveChartCard({
  title,
  subtitle,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      <div className="mb-4">
        <h2 className="font-display text-base font-black text-slate-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs font-semibold text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export function ExecutiveChartFrame({
  height = 280,
  empty = false,
  children,
}: {
  height?: number;
  empty?: boolean;
  children?: ReactNode;
}) {
  if (empty) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 text-center text-xs font-semibold text-slate-400"
        style={{ height }}
      >
        No data recorded for this period yet.
      </div>
    );
  }
  return <div style={{ width: '100%', height }}>{children}</div>;
}

type TooltipEntry = {
  name?: string | number;
  value?: string | number;
  color?: string;
  fill?: string;
};

export function ExecutiveTooltip({
  active,
  payload,
  label,
  suffix = '',
  valueFormatter,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  suffix?: string;
  valueFormatter?: (value: string | number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-xl backdrop-blur">
      {label !== undefined && <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>}
      {payload.map((entry, index) => (
        <p key={`${String(entry.name)}-${index}`} className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <span className="h-2 w-2 rounded-full" style={{ background: entry.color ?? entry.fill ?? EXECUTIVE_COLORS.indigo }} />
          <span>{String(entry.name ?? 'Value')}:</span>
          <span className="ml-auto font-mono font-black text-slate-900">
            {valueFormatter && entry.value !== undefined
              ? valueFormatter(entry.value)
              : `${Number(entry.value ?? 0).toLocaleString('en-US')}${suffix}`}
          </span>
        </p>
      ))}
    </div>
  );
}

export type ExecutiveDonutDatum = { name: string; value: number; color?: string };

export function ExecutiveDonut({
  data,
  height = 250,
  centerLabel = 'Total',
}: {
  data: ExecutiveDonutDatum[];
  height?: number;
  centerLabel?: string;
}) {
  const visible = data.filter((item) => item.value > 0);
  const total = visible.reduce((sum, item) => sum + item.value, 0);
  if (!total) return <ExecutiveChartFrame height={height} empty />;
  const palette = Object.values(EXECUTIVE_COLORS);
  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={visible}
            dataKey="value"
            nameKey="name"
            innerRadius="58%"
            outerRadius="88%"
            paddingAngle={2}
            stroke="#fff"
            strokeWidth={2}
          >
            {visible.map((entry, index) => (
              <Cell key={entry.name} fill={entry.color ?? palette[index % palette.length]} />
            ))}
          </Pie>
          <Tooltip content={<ExecutiveTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="font-display text-2xl font-black text-slate-900">{total.toLocaleString('en-US')}</p>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{centerLabel}</p>
      </div>
    </div>
  );
}

export function ExecutiveLegend({ data }: { data: ExecutiveDonutDatum[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
      {data.map((item) => (
        <span key={item.name} className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: item.color ?? EXECUTIVE_COLORS.indigo }} />
          {item.name} · {item.value.toLocaleString('en-US')}
        </span>
      ))}
    </div>
  );
}
