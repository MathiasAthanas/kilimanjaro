import {
  AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, Copy,
  Download, Eye, FileText, Lock, Plus, Search, Settings,
  Shield, Trash2, Upload, XCircle,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import type { ServiceState } from '../api/adminApi';
import { handlebarsIsValid, typedConfirmationIsValid } from '../utils/adminValidation';

// ─── Shell ────────────────────────────────────────────────────────────────────

export function AdminShell({ title, eyebrow, children, action }: { title: string; eyebrow: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="space-y-gutter">
      <section className="relative overflow-hidden rounded-2xl border border-indigo-300/30 bg-[radial-gradient(circle_at_8%_18%,rgba(14,165,233,0.30),transparent_30%),radial-gradient(circle_at_88%_8%,rgba(99,102,241,0.22),transparent_32%),linear-gradient(135deg,#1E1B4B_0%,#312E81_50%,#4338CA_100%)] shadow-layer">
        <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-8 -top-8 h-48 w-48 rounded-full border border-white/5" />
        <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-sky-400/60 to-transparent" />
        <div className="relative grid gap-6 p-8 xl:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.32em] text-sky-300">{eyebrow}</p>
            <h1 className="mt-2 font-display text-[44px] font-black leading-tight tracking-[-0.04em] text-white">{title}</h1>
            <p className="mt-1.5 text-sm font-semibold text-white/60">System Admin · admin@ks.ac.tz · Production console</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-start gap-2 xl:pt-2">
            <AdminHeaderPill label="Env"    value="Production" color="text-sky-300" />
            <AdminHeaderPill label="Status" value="Gateway ✓"  color="text-emerald-300" />
            <AdminHeaderPill label="Alerts" value="2 degraded" color="text-amber-300" />
            {action}
          </div>
        </div>
      </section>
      {children}
    </div>
  );
}

function AdminHeaderPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="min-w-[110px] rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-center backdrop-blur">
      <p className="text-[9px] font-black uppercase tracking-widest text-white/50">{label}</p>
      <p className={`mt-1 font-mono text-sm font-black ${color}`}>{value}</p>
    </div>
  );
}

// ─── Metric strip ─────────────────────────────────────────────────────────────

export function AdminMetricStrip({ items }: { items: Array<{ label: string; value: string; detail: string; tone?: 'blue' | 'green' | 'amber' | 'rose' }> }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
      {items.map((item, i) => (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: i * 0.06, ease: 'easeOut' }}
          className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${toneBorder(item.tone)}`}
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{item.label}</p>
          <p className="mt-2 font-display text-3xl font-black text-slate-950">{item.value}</p>
          <p className="mt-1 text-xs font-bold text-slate-500">{item.detail}</p>
        </motion.div>
      ))}
    </div>
  );
}

function toneBorder(tone?: string) {
  return tone === 'rose'  ? 'border-l-4 border-l-[#F43F5E]'
       : tone === 'amber' ? 'border-l-4 border-l-[#F59E0B]'
       : tone === 'green' ? 'border-l-4 border-l-[#10B981]'
       :                    'border-l-4 border-l-[#0EA5E9]';
}

// ─── Service health ───────────────────────────────────────────────────────────

export function AdminStatusIndicator({ service, state, uptime, latency }: { service: string; state: ServiceState; uptime: string; latency: string }) {
  const dotColor = state === 'ONLINE'   ? 'bg-[#10B981]'
                 : state === 'DEGRADED' ? 'bg-[#F59E0B]'
                 : state === 'OFFLINE'  ? 'bg-[#F43F5E]'
                 :                        'bg-slate-400';
  const ringColor = state === 'ONLINE'   ? 'ring-[#10B981]/25'
                  : state === 'DEGRADED' ? 'ring-[#F59E0B]/25'
                  :                        'ring-transparent';
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 transition hover:border-slate-300 hover:shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`relative flex h-3 w-3 rounded-full ${dotColor}`}>
          {(state === 'ONLINE' || state === 'DEGRADED') && (
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${dotColor}`} />
          )}
          <span className={`relative inline-flex h-3 w-3 rounded-full ring-4 ${dotColor} ${ringColor}`} />
        </span>
        <p className="text-sm font-black text-slate-900">{service}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold text-slate-400">{uptime}</span>
        <span className="text-[10px] font-bold text-slate-400">{latency}</span>
        <Badge tone={state === 'ONLINE' ? 'emerald' : state === 'DEGRADED' ? 'amber' : 'rose'}>{state}</Badge>
      </div>
    </div>
  );
}

// ─── Data table ───────────────────────────────────────────────────────────────

export function AdminDataTable({ columns, children, minWidth = 980 }: { columns: string[]; children: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          className="h-9 flex-1 rounded-lg border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-[#4338CA]"
          placeholder="Search or filter…"
        />
        <Button variant="secondary" className="rounded-lg py-2 text-xs">Columns</Button>
        <Button variant="secondary" className="rounded-lg py-2 text-xs"><Download className="h-3.5 w-3.5" /> Export</Button>
        <Button variant="secondary" className="rounded-lg py-2 text-xs">Bulk Actions ▾</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" style={{ minWidth }}>
          <thead className="sticky top-0 bg-[#1E1B4B] text-[11px] font-black uppercase tracking-widest text-white">
            <tr>
              {columns.map((col) => <th key={col} className="px-5 py-4">{col}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">{children}</tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-xs font-bold text-slate-500">
        <span>Pagination ready · results from live API</span>
        <span>Rows 1–25</span>
      </div>
    </div>
  );
}

export function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-5 py-3.5 font-semibold text-slate-700 ${className}`}>{children}</td>;
}

// ─── Form primitives ──────────────────────────────────────────────────────────

/** Single-line text / date / number / email / tel input */
export function Field({
  label, value = '', type = 'text', placeholder = '', readOnly = false,
}: {
  label: string; value?: string; type?: string; placeholder?: string; readOnly?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">{label}</span>
      <input
        defaultValue={value}
        type={type}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`mt-2 h-11 w-full rounded-xl border border-slate-200 px-4 font-semibold outline-none transition focus:border-[#4338CA] focus:bg-white ${
          readOnly ? 'cursor-default bg-slate-100 text-slate-400' : 'bg-slate-50 hover:border-slate-300'
        }`}
      />
    </label>
  );
}

/** Dropdown select with options list */
export function SelectField({
  label, options, value = '', onChange,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  value?: string;
  onChange?: (value: string) => void;
}) {
  const [val, setVal] = useState(value);
  return (
    <label className="block">
      <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">{label}</span>
      <select
        value={val}
        onChange={(e) => { setVal(e.target.value); onChange?.(e.target.value); }}
        className="mt-2 h-11 w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 font-semibold outline-none transition hover:border-slate-300 focus:border-[#4338CA] focus:bg-white"
      >
        {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
    </label>
  );
}

/** On/off toggle switch */
export function FeatureToggle({ label, description, enabled = false }: { label: string; description: string; enabled?: boolean }) {
  const [on, setOn] = useState(enabled);
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-5 py-3.5 transition hover:bg-slate-50/60">
      <div>
        <p className="text-sm font-black text-slate-900">{label}</p>
        <p className="text-xs font-semibold text-slate-500">{description}</p>
      </div>
      <button
        onClick={() => setOn((v) => !v)}
        aria-pressed={on}
        className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4338CA]/40 ${on ? 'bg-[#4338CA]' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all duration-200 ${on ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
  );
}

// ─── Form section (collapsible) ───────────────────────────────────────────────

export function AdminFormSection({ title, subtitle, children, badge }: { title: string; subtitle: string; children: ReactNode; badge?: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <button className="flex w-full items-start justify-between gap-4 text-left" onClick={() => setOpen((v) => !v)}>
        <div>
          <h2 className="font-display text-xl font-black text-slate-950">{title}</h2>
          <p className="mt-0.5 text-sm font-semibold text-slate-500">{subtitle}</p>
        </div>
        <span className="flex shrink-0 items-center gap-2 pt-0.5">
          {badge}
          <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="mt-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

// ─── CSV bulk import zone ─────────────────────────────────────────────────────

export function CsvImportZone({ entity }: { entity: string }) {
  const [dragging, setDragging] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); }}
      className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
        dragging ? 'border-[#4338CA] bg-indigo-50' : 'border-slate-200 bg-slate-50/60 hover:border-[#4338CA]/40 hover:bg-indigo-50/20'
      }`}
    >
      <Upload className="mx-auto h-8 w-8 text-slate-400" />
      <p className="mt-3 text-sm font-black text-slate-700">
        Drop {entity} CSV here for bulk import
      </p>
      <p className="mt-1 text-xs font-semibold text-slate-400">
        Up to 500 rows · all fields validated before commit
      </p>
      <div className="mt-5 flex justify-center gap-3">
        <Button variant="secondary" className="rounded-xl py-2 text-xs">
          <Download className="h-3.5 w-3.5" /> Download Template
        </Button>
        <Button className="rounded-xl bg-[#4338CA] py-2 text-xs">
          <Upload className="h-3.5 w-3.5" /> Choose CSV File
        </Button>
      </div>
    </div>
  );
}

// ─── Assessment type inline editor ───────────────────────────────────────────

export function AssessmentTypeEditor({
  types,
}: {
  types: Array<{ id: string; name: string; weight: number; maxScore: number; scope: string }>;
}) {
  const [rows, setRows] = useState(types.map((t) => ({ ...t })));
  const total = rows.reduce((s, r) => s + r.weight, 0);
  const valid = Math.abs(total - 100) < 0.001;

  const update = (i: number, field: string, val: string | number) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, [field]: val } : r)));

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3.5">
        <p className="font-display font-black text-slate-950">Assessment Weight Distribution</p>
        <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ${valid ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>
          {valid
            ? <CheckCircle2 className="h-3.5 w-3.5" />
            : <AlertTriangle className="h-3.5 w-3.5" />
          }
          Total: {total}% {valid ? '— valid' : '— must equal 100%'}
        </span>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-[#1E1B4B] text-[11px] font-black uppercase tracking-widest text-white">
          <tr>
            <th className="px-5 py-3.5 text-left">Name</th>
            <th className="px-5 py-3.5 text-left">Weight %</th>
            <th className="px-5 py-3.5 text-left">Max Score</th>
            <th className="px-5 py-3.5 text-left">Scope</th>
            <th className="px-5 py-3.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr key={row.id} className="hover:bg-slate-50/80">
              <td className="px-5 py-3">
                <input
                  defaultValue={row.name}
                  onChange={(e) => update(i, 'name', e.target.value)}
                  className="h-9 w-full max-w-[180px] rounded-lg border border-slate-200 px-3 font-semibold outline-none transition focus:border-[#4338CA] focus:bg-white"
                />
              </td>
              <td className="px-5 py-3">
                <input
                  type="number" min={0} max={100} value={row.weight}
                  onChange={(e) => update(i, 'weight', Number(e.target.value))}
                  className="h-9 w-20 rounded-lg border border-slate-200 px-3 text-right font-black outline-none transition focus:border-[#4338CA] focus:bg-white"
                />
              </td>
              <td className="px-5 py-3">
                <input
                  type="number" min={0} defaultValue={row.maxScore}
                  className="h-9 w-20 rounded-lg border border-slate-200 px-3 text-right font-semibold outline-none transition focus:border-[#4338CA] focus:bg-white"
                />
              </td>
              <td className="px-5 py-3">
                <select
                  defaultValue={row.scope}
                  className="h-9 cursor-pointer rounded-lg border border-slate-200 bg-white px-3 font-semibold outline-none transition focus:border-[#4338CA]"
                >
                  <option value="Term">Term</option>
                  <option value="Year">Year</option>
                </select>
              </td>
              <td className="px-5 py-3 text-right">
                <button
                  onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-2 border-t border-slate-200 px-5 py-3">
        <Button
          variant="quiet"
          className="rounded-xl py-2 text-xs"
          onClick={() => setRows((prev) => [...prev, { id: `new-${Date.now()}`, name: 'New Type', weight: 0, maxScore: 100, scope: 'Term' }])}
        >
          <Plus className="h-3.5 w-3.5" /> Add Type
        </Button>
        <Button disabled={!valid} className="ml-auto rounded-xl bg-[#4338CA]">
          Save Assessment Types
        </Button>
      </div>
    </div>
  );
}

// ─── Grading boundary editor ──────────────────────────────────────────────────

export function GradingBoundaryEditor({
  scale,
}: {
  scale: { id: string; name: string; active: boolean; boundaries: Array<{ label: string; min: number; max: number }> };
}) {
  const [rows, setRows] = useState(scale.boundaries.map((b) => ({ ...b })));

  const update = (i: number, field: string, val: string | number) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, [field]: val } : r)));

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3.5">
        <div>
          <p className="font-display font-black text-slate-950">{scale.name}</p>
          <p className="text-xs font-semibold text-slate-500">Boundaries must cover 0–100 with no gaps</p>
        </div>
        {scale.active && <Badge tone="emerald">Active</Badge>}
      </div>
      <table className="w-full text-sm">
        <thead className="bg-[#1E1B4B] text-[11px] font-black uppercase tracking-widest text-white">
          <tr>
            <th className="px-5 py-3.5 text-left">Grade</th>
            <th className="px-5 py-3.5 text-left">Min %</th>
            <th className="px-5 py-3.5 text-left">Max %</th>
            <th className="px-5 py-3.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-slate-50/80">
              <td className="px-5 py-3">
                <input
                  defaultValue={row.label}
                  onChange={(e) => update(i, 'label', e.target.value)}
                  className="h-9 w-16 rounded-lg border border-slate-200 px-3 text-center font-black outline-none transition focus:border-[#4338CA] focus:bg-white"
                />
              </td>
              <td className="px-5 py-3">
                <input
                  type="number" min={0} max={100} defaultValue={row.min}
                  onChange={(e) => update(i, 'min', Number(e.target.value))}
                  className="h-9 w-20 rounded-lg border border-slate-200 px-3 text-right font-semibold outline-none transition focus:border-[#4338CA] focus:bg-white"
                />
              </td>
              <td className="px-5 py-3">
                <input
                  type="number" min={0} max={100} defaultValue={row.max}
                  onChange={(e) => update(i, 'max', Number(e.target.value))}
                  className="h-9 w-20 rounded-lg border border-slate-200 px-3 text-right font-semibold outline-none transition focus:border-[#4338CA] focus:bg-white"
                />
              </td>
              <td className="px-5 py-3 text-right">
                <button
                  onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-2 border-t border-slate-200 px-5 py-3">
        <Button
          variant="quiet"
          className="rounded-xl py-2 text-xs"
          onClick={() => setRows((prev) => [...prev, { label: '', min: 0, max: 0 }])}
        >
          <Plus className="h-3.5 w-3.5" /> Add Boundary
        </Button>
        <Button className="ml-auto rounded-xl bg-[#4338CA]">Save Scale</Button>
      </div>
    </div>
  );
}

// ─── Danger confirmation dialog ───────────────────────────────────────────────

export function DangerActionDialog({ title, entity, confirmation = 'CONFIRM' }: { title: string; entity: string; confirmation?: string }) {
  const [input, setInput] = useState('');
  const valid = typedConfirmationIsValid(input, confirmation);
  return (
    <div className="rounded-2xl border border-[#F43F5E]/30 bg-[#F43F5E]/5 p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#F43F5E]" />
        <div>
          <h3 className="font-display text-xl font-black text-[#9f1239]">{title}</h3>
          <p className="mt-1 text-sm font-semibold text-[#9f1239]/80">
            Affected entity: {entity}. This action is logged in the audit trail.
          </p>
        </div>
      </div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="mt-4 h-11 w-full rounded-xl border border-[#F43F5E]/30 px-4 font-mono font-black outline-none transition focus:border-[#F43F5E]/60"
        placeholder={`Type ${confirmation} to confirm`}
      />
      <textarea
        className="mt-3 h-20 w-full rounded-xl border border-[#F43F5E]/30 p-3 text-sm font-semibold outline-none transition focus:border-[#F43F5E]/60"
        placeholder="Audit note required…"
      />
      <Button disabled={!valid} variant="danger" className="mt-3 w-full rounded-xl">{title}</Button>
    </div>
  );
}

// ─── JSON payload inspector ───────────────────────────────────────────────────

export function JsonInspector({ value }: { value: unknown }) {
  const [open, setOpen] = useState(false);
  const json = JSON.stringify(value, null, 2);
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-950">
      <button
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-black text-white"
        onClick={() => setOpen((v) => !v)}
      >
        <span>JSON payload</span>
        <span className="flex items-center gap-2 text-sky-300">
          <Copy className="h-4 w-4" /> {open ? 'Collapse' : 'Expand'}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <pre className="max-h-72 overflow-auto border-t border-white/10 p-4 text-xs font-semibold text-white/80">{json}</pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Notification template editor ────────────────────────────────────────────

export function NotificationTemplateEditor({ template }: { template: { name: string; channel: string; eventType: string; body: string } }) {
  const [body, setBody] = useState(template.body);
  const valid = handlebarsIsValid(body) && body.trim().length > 0;
  return (
    <div className="grid gap-gutter xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-gutter">
        <AdminFormSection title="Template Identity" subtitle="Channel, event type, and subject configuration">
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Name" value={template.name} />
            <Field label="Channel" value={template.channel} readOnly />
            <Field label="Event Type" value={template.eventType} readOnly />
          </div>
        </AdminFormSection>
        <AdminFormSection title="Body" subtitle="Handlebars variables validated before save">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="h-56 w-full rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm outline-none transition focus:border-[#4338CA] focus:bg-white"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {['student.name', 'term.name', 'guardian.name', 'finance.balance'].map((chip) => (
              <Badge key={chip} tone="blue">{`{{${chip}}}`}</Badge>
            ))}
          </div>
        </AdminFormSection>
      </div>
      <div className="sticky top-24 h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          {valid
            ? <CheckCircle2 className="h-5 w-5 text-[#10B981]" />
            : <XCircle className="h-5 w-5 text-[#F43F5E]" />
          }
          <h3 className="font-display text-xl font-black text-slate-950">Preview</h3>
        </div>
        <div className="mt-4 min-h-[80px] rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-relaxed text-slate-700">
          {body
            .replaceAll('{{student.name}}',    'Amina')
            .replaceAll('{{term.name}}',       'Term II')
            .replaceAll('{{guardian.name}}',   'Mr. Juma')
            .replaceAll('{{finance.balance}}', 'TZS 400,000')
          }
        </div>
        <Button disabled={!valid} className="mt-4 w-full rounded-xl bg-[#4338CA]">Save Template</Button>
      </div>
    </div>
  );
}

// ─── Quick nav card ───────────────────────────────────────────────────────────

export function AdminQuickCard({ title, detail, to, icon = 'settings' }: { title: string; detail: string; to: string; icon?: 'settings' | 'shield' | 'file' | 'eye' }) {
  const Icon = icon === 'shield' ? Shield : icon === 'file' ? FileText : icon === 'eye' ? Eye : Settings;
  return (
    <NavLink
      to={to}
      className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-[#4338CA]/40 hover:shadow-layer"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 transition group-hover:bg-indigo-100">
        <Icon className="h-5 w-5 text-[#4338CA]" />
      </div>
      <h3 className="mt-4 font-display text-xl font-black text-slate-950">{title}</h3>
      <p className="mt-1.5 text-sm font-semibold text-slate-500">{detail}</p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-[#0EA5E9]">
        Open <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
      </span>
    </NavLink>
  );
}

// ─── Pending integration banner ───────────────────────────────────────────────

export function PendingIntegration({ endpoint }: { endpoint: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#F59E0B] bg-[#F59E0B]/10 p-5">
      <div className="flex items-center gap-2 font-black text-[#92400e]">
        <Lock className="h-5 w-5" /> Pending backend integration
      </div>
      <p className="mt-1 text-sm font-semibold text-[#92400e]/80">
        UI ready · awaiting endpoint: {endpoint}
      </p>
    </div>
  );
}
