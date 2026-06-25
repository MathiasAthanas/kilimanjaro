import { useState, useRef } from 'react';
import { motion } from 'framer-motion';

// ─── Bar Chart ────────────────────────────────────────────────────────────────

type BarItem = { label: string; value: number; tone?: string };

export function BarChart({ title, subtitle, values }: { title: string; subtitle?: string; values: BarItem[] }) {
  const max = Math.max(...values.map((v) => v.value), 1);
  const total = values.reduce((s, v) => s + v.value, 0);
  const [hov, setHov] = useState<number | null>(null);
  const colors = ['bg-[#6C63FF]', 'bg-[#10b981]', 'bg-[#f59e0b]', 'bg-[#ef4444]', 'bg-[#14122e]', 'bg-[#94a3b8]'];
  return (
    <div className="rounded-2xl border border-ks-line bg-white p-6 shadow-sm">
      <h3 className="font-display text-lg font-black text-ks-navy">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs font-semibold text-ks-muted">{subtitle}</p>}
      <div className="mt-5 space-y-4">
        {values.map((item, i) => {
          const pct = Math.round((item.value / max) * 100);
          const share = total > 0 ? Math.round((item.value / total) * 100) : 0;
          const isHov = hov === i;
          const colorClass = item.tone ?? colors[i % colors.length];
          return (
            <div key={item.label + i} className="cursor-pointer" onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
              <div className="mb-1.5 flex justify-between text-xs font-black uppercase tracking-wider">
                <span className={`transition-colors ${isHov ? 'text-ks-navy' : 'text-ks-muted'}`}>{item.label}</span>
                <span className="font-mono text-ks-navy">{item.value.toLocaleString()}&nbsp;
                  <span className="text-[9px] text-ks-muted">{share}%</span>
                </span>
              </div>
              <div className="relative h-8 overflow-hidden rounded-lg bg-ks-mist">
                <motion.div
                  className={`h-full rounded-lg ${colorClass}`}
                  initial={{ width: '0%' }}
                  animate={{ width: `${pct}%`, opacity: isHov ? 1 : 0.8 }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: i * 0.06 }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Line Chart ───────────────────────────────────────────────────────────────

export function LineChart({ title, subtitle, values, labels }: { title: string; subtitle?: string; values: number[]; labels?: string[] }) {
  const w = 520; const h = 200; const pad = 28;
  const max = Math.max(...values, 1); const min = Math.min(...values, 0);
  const current = values[values.length - 1] ?? 0;
  const prev = values[values.length - 2] ?? current;
  const delta = current - prev;
  const points = values.map((v, i) => {
    const x = pad + (values.length > 1 ? (i / (values.length - 1)) : 0.5) * (w - pad * 2);
    const y = h - pad - ((v - min) / Math.max(max - min, 1)) * (h - pad * 2);
    return [x, y] as const;
  });
  const linePath = points.length > 1 ? `M${points[0][0]},${points[0][1]} ${points.slice(1).map(([x, y]) => `L${x},${y}`).join(' ')}` : '';
  const area = linePath ? `${linePath} L${w - pad},${h - pad} L${pad},${h - pad} Z` : '';
  const gradId = `lg-${title.replace(/\s+/g, '-')}`;
  const [hovIdx, setHovIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const svgX = ((e.clientX - rect.left) / rect.width) * w;
    let best = 0;
    points.forEach(([px], i) => { if (Math.abs(px - svgX) < Math.abs(points[best][0] - svgX)) best = i; });
    setHovIdx(best);
  };

  const hp = hovIdx !== null ? points[hovIdx] : null;

  return (
    <div className="rounded-2xl border border-ks-line bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-lg font-black text-ks-navy">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs font-semibold text-ks-muted">{subtitle}</p>}
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-2xl font-black text-ks-navy">{current.toFixed(1)}</p>
          <p className={`text-xs font-bold ${delta >= 0 ? 'text-ks-emerald' : 'text-ks-rose'}`}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}
          </p>
        </div>
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${w} ${h}`} className="mt-4 w-full" onMouseMove={handleMouseMove} onMouseLeave={() => setHovIdx(null)}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6C63FF" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#6C63FF" stopOpacity="0" />
          </linearGradient>
        </defs>
        {area && <motion.path d={area} fill={`url(#${gradId})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} />}
        {linePath && <motion.path d={linePath} fill="none" stroke="#6C63FF" strokeWidth="2.5" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: 'easeInOut' }} />}
        {points.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={hovIdx === i ? 5 : 3} fill="#6C63FF" opacity={hovIdx === i ? 1 : 0.6} />
        ))}
        {hp && hovIdx !== null && (
          <g>
            <line x1={hp[0]} y1={pad} x2={hp[0]} y2={h - pad} stroke="#6C63FF" strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />
            <rect x={hp[0] - 32} y={hp[1] - 26} width="64" height="20" rx="4" fill="#6C63FF" />
            <text x={hp[0]} y={hp[1] - 12} textAnchor="middle" fontSize="10" fill="white" fontWeight="bold">
              {values[hovIdx].toFixed(1)}{labels?.[hovIdx] ? ` · ${labels[hovIdx]}` : ''}
            </text>
          </g>
        )}
        {labels && labels.length <= 6 && labels.map((l, i) => (
          <text key={i} x={points[i]?.[0] ?? 0} y={h - 6} textAnchor="middle" fontSize="9" fill="#94a3b8" fontWeight="bold">
            {l}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ─── Doughnut Chart ───────────────────────────────────────────────────────────

export function DoughnutChart({ title, segments }: { title: string; segments: Array<{ label: string; value: number; color: string }> }) {
  const total = segments.reduce((s, v) => s + v.value, 0) || 1;
  const [hov, setHov] = useState<number | null>(null);
  const cx = 80; const cy = 80; const r = 58; const inner = 38;
  let angle = -Math.PI / 2;
  const paths = segments.map((seg, i) => {
    const frac = seg.value / total;
    const sweep = frac * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const xi1 = cx + inner * Math.cos(angle);
    const yi1 = cy + inner * Math.sin(angle);
    const xi2 = cx + inner * Math.cos(angle - sweep);
    const yi2 = cy + inner * Math.sin(angle - sweep);
    const large = sweep > Math.PI ? 1 : 0;
    return { path: `M${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} L${xi1},${yi1} A${inner},${inner} 0 ${large},0 ${xi2},${yi2} Z`, color: seg.color, label: seg.label, value: seg.value, pct: Math.round(frac * 100), i };
  });

  const hovSeg = hov !== null ? segments[hov] : null;

  return (
    <div className="rounded-2xl border border-ks-line bg-white p-6 shadow-sm">
      <h3 className="font-display text-lg font-black text-ks-navy">{title}</h3>
      <div className="mt-4 flex items-center gap-6">
        <svg viewBox="0 0 160 160" className="h-40 w-40 shrink-0">
          {paths.map((p) => (
            <motion.path
              key={p.i}
              d={p.path}
              fill={p.color}
              opacity={hov === null || hov === p.i ? 1 : 0.4}
              onMouseEnter={() => setHov(p.i)}
              onMouseLeave={() => setHov(null)}
              className="cursor-pointer transition-opacity"
            />
          ))}
          {hovSeg ? (
            <>
              <text x={cx} y={cy - 6} textAnchor="middle" fontSize="16" fontWeight="bold" fill="#0f172a">{hovSeg.value.toLocaleString()}</text>
              <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill="#64748b" fontWeight="bold">{hovSeg.label.toUpperCase()}</text>
            </>
          ) : (
            <>
              <text x={cx} y={cy - 6} textAnchor="middle" fontSize="16" fontWeight="bold" fill="#0f172a">{total.toLocaleString()}</text>
              <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill="#64748b" fontWeight="bold">TOTAL</text>
            </>
          )}
        </svg>
        <div className="flex-1 space-y-2">
          {segments.map((seg, i) => (
            <div key={i} className="flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: seg.color }} />
                <span className="font-bold text-ks-navy">{seg.label}</span>
              </div>
              <span className="font-mono text-ks-muted">{seg.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Progress Ring ────────────────────────────────────────────────────────────

export function ProgressRing({ value, max = 100, label, size = 120, color = '#6C63FF' }: { value: number; max?: number; label: string; size?: number; color?: string }) {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth="8" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${circ}`}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text x={size / 2} y={size / 2 + 2} textAnchor="middle" dominantBaseline="middle" fontSize={size > 100 ? '22' : '16'} fontWeight="900" fill="#0f172a">{pct}%</text>
      </svg>
      <p className="text-center text-xs font-bold text-ks-muted">{label}</p>
    </div>
  );
}

// ─── Radar Chart ──────────────────────────────────────────────────────────────

export function RadarChart({ axes, values, size = 200 }: { axes: string[]; values: number[]; size?: number }) {
  const n = axes.length;
  if (!n) return null;
  const cx = size / 2; const cy = size / 2; const r = size / 2 - 28;
  const angle = (i: number) => (i / n) * 2 * Math.PI - Math.PI / 2;
  const pt = (i: number, radius: number) => {
    const a = angle(i);
    return [cx + radius * Math.cos(a), cy + radius * Math.sin(a)] as const;
  };
  const max = 100;
  const dataPath = values.map((v, i) => pt(i, (v / max) * r)).map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ') + ' Z';
  const gridLevels = [0.25, 0.5, 0.75, 1].map((f) =>
    axes.map((_, i) => pt(i, f * r)).map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ') + ' Z',
  );
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full">
      {gridLevels.map((d, i) => <path key={i} d={d} fill="none" stroke="#e2e8f0" strokeWidth="1" />)}
      {axes.map((_, i) => { const [x, y] = pt(i, r); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e2e8f0" strokeWidth="1" />; })}
      <motion.path d={dataPath} fill="#6C63FF" fillOpacity="0.2" stroke="#6C63FF" strokeWidth="2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} />
      {values.map((v, i) => { const [x, y] = pt(i, (v / max) * r); return <circle key={i} cx={x} cy={y} r="3.5" fill="#6C63FF" />; })}
      {axes.map((label, i) => {
        const [x, y] = pt(i, r + 18);
        return <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="bold" fill="#64748b">{label}</text>;
      })}
    </svg>
  );
}

// ─── Heatmap ──────────────────────────────────────────────────────────────────

type HeatCell = { date: string; status: string };

export function AttendanceHeatmap({ records }: { records: HeatCell[] }) {
  const statusColor: Record<string, string> = {
    PRESENT: '#10b981',
    ABSENT: '#ef4444',
    LATE: '#f59e0b',
    EXCUSED: '#94a3b8',
  };
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const recent = records.slice(-20);
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-5 gap-1.5">
        {days.map((d) => <p key={d} className="text-center text-[9px] font-black uppercase tracking-wider text-ks-muted">{d}</p>)}
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {Array.from({ length: 20 }).map((_, i) => {
          const record = recent[i];
          const color = record ? (statusColor[record.status] || '#f1f5f9') : '#f1f5f9';
          return (
            <div
              key={i}
              className="aspect-square rounded"
              style={{ background: color }}
              title={record ? `${record.date} — ${record.status}` : 'No record'}
            />
          );
        })}
      </div>
      <div className="flex gap-3 pt-1">
        {Object.entries(statusColor).map(([s, c]) => (
          <div key={s} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} />
            <span className="text-[9px] font-bold text-ks-muted">{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

export function StatCard({ label, value, detail, tone }: { label: string; value: string; detail?: string; tone?: 'blue' | 'green' | 'amber' | 'rose' }) {
  const accent = tone === 'rose' ? 'border-l-[#ef4444]' : tone === 'amber' ? 'border-l-[#f59e0b]' : tone === 'green' ? 'border-l-[#10b981]' : 'border-l-[#6C63FF]';
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`rounded-2xl border border-slate-200 border-l-4 ${accent} bg-white p-5 shadow-sm`}
    >
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-2 font-display text-3xl font-black text-slate-950">{value}</p>
      {detail && <p className="mt-1 text-xs font-bold text-slate-500">{detail}</p>}
    </motion.div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function ChartSkeleton({ height = 'h-52' }: { height?: string }) {
  return <div className={`${height} animate-pulse rounded-2xl bg-slate-100`} />;
}

export function StatSkeleton() {
  return <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />;
}
