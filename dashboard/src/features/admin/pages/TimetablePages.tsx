/**
 * Timetable management pages — Hub, Venues, Activities, Sheets, Builder, Print
 */
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle, Building2, Activity, Calendar, CheckCircle2,
  ChevronRight, Edit2, Plus, Printer, RefreshCw, Trash2, Wand2, X,
} from 'lucide-react';
import { toast } from '../../../lib/toast';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import {
  useVenues, useCreateVenueMutation, useUpdateVenueMutation, useDeleteVenueMutation,
  useTimetableActivities, useCreateTimetableActivityMutation, useUpdateTimetableActivityMutation, useDeleteTimetableActivityMutation,
  useTimetableSheets, useTimetableSheet, useCreateTimetableSheetMutation, useUpdateTimetableSheetMutation, useDeleteTimetableSheetMutation,
  useCreateTimetableSlotMutation, useUpdateTimetableSlotMutation, useDeleteTimetableSlotMutation,
  useAutoGenerateTimetableMutation,
  useAcademicYears, useAdminClasses, useTerms,
} from '../api/admin.hooks';

// ─── Types ────────────────────────────────────────────────────────────────────

type Venue = {
  id: string; name: string; type: string; capacity: number;
  stageFilter: string[]; description?: string; isActive: boolean;
};
type TimetableActivity = {
  id: string; name: string; activityType: string; defaultDuration: number;
  stageFilter: string[]; description?: string; colorCode?: string; isActive: boolean;
};
type TimetableSheet = {
  id: string; name: string; timetableType: string; stage?: string;
  classId?: string; className?: string; academicYearId: string;
  termId?: string; isPublished: boolean; note?: string;
  createdAt: string; updatedAt: string; slots?: TimetableSlot[];
};
type TimetableSlot = {
  id: string; sheetId: string; dayOfWeek: string; startTime: string; endTime: string;
  activityType: string; label?: string; subjectName?: string;
  teacherName?: string; venueId?: string; colorCode?: string; notes?: string;
  venue?: { name: string };
};

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;

const STAGE_OPTIONS = [
  { value: 'NURSERY',  label: 'Nursery' },
  { value: 'PRE_UNIT', label: 'Pre-Unit' },
  { value: 'PRIMARY',  label: 'Primary' },
  { value: 'O_LEVEL',  label: 'O-Level (Secondary)' },
  { value: 'A_LEVEL',  label: 'A-Level (Advanced)' },
];

const VENUE_TYPES = [
  'CLASSROOM', 'HALL', 'SPORTS_GROUND', 'LABORATORY',
  'LIBRARY', 'MUSIC_ROOM', 'COMPUTER_LAB', 'OTHER',
];
const ACTIVITY_TYPES = [
  'LESSON', 'BREAK', 'ASSEMBLY', 'SPORTS', 'CLUB', 'ARTS', 'MUSIC', 'EXAM', 'CUSTOM',
];
const TIMETABLE_TYPES = ['CLASS', 'EXTRACURRICULAR', 'CUSTOM'];

const ACTIVITY_COLORS: Record<string, string> = {
  LESSON: '#4338CA', BREAK: '#6B7280', ASSEMBLY: '#7C3AED', SPORTS: '#059669',
  CLUB: '#D97706', ARTS: '#DB2777', MUSIC: '#2563EB', EXAM: '#DC2626', CUSTOM: '#0891B2',
};

function fmtLabel(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function typeBadge(type: string) {
  const map: Record<string, 'blue' | 'emerald' | 'amber'> = {
    CLASS: 'blue', EXTRACURRICULAR: 'emerald', CUSTOM: 'amber',
  };
  return <Badge tone={map[type] ?? 'blue'}>{fmtLabel(type)}</Badge>;
}

function stageBadge(stage?: string) {
  if (!stage) return <Badge tone="slate">All Stages</Badge>;
  const map: Record<string, 'rose' | 'amber' | 'blue' | 'emerald' | 'slate'> = {
    NURSERY: 'rose', PRE_UNIT: 'amber', PRIMARY: 'blue', O_LEVEL: 'emerald', A_LEVEL: 'slate',
  };
  return <Badge tone={map[stage] ?? 'slate'}>{fmtLabel(stage)}</Badge>;
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function PageShell({ title, eyebrow, actions, children }: {
  title: string; eyebrow: string; actions?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-indigo-300/30 bg-[radial-gradient(circle_at_8%_18%,rgba(14,165,233,0.30),transparent_30%),linear-gradient(135deg,#1E1B4B_0%,#312E81_50%,#4338CA_100%)] shadow-layer print:hidden">
        <div className="relative grid gap-4 p-8 xl:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.32em] text-sky-300">{eyebrow}</p>
            <h1 className="mt-2 font-display text-4xl font-black leading-tight tracking-tight text-white">{title}</h1>
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-start gap-2 xl:pt-2">{actions}</div>}
        </div>
      </section>
      {children}
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
      <p className="font-display text-sm font-black uppercase tracking-wider text-slate-800">{title}</p>
      {action}
    </div>
  );
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-sm font-semibold text-slate-700 ${className}`}>{children}</td>;
}

function DataTable({ columns, children, minWidth = 700 }: {
  columns: string[]; children: React.ReactNode; minWidth?: number;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" style={{ minWidth }}>
          <thead className="sticky top-0 bg-[#1E1B4B] text-[11px] font-black uppercase tracking-widest text-white">
            <tr>{columns.map((c) => <th key={c} className="px-4 py-3.5">{c}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

function InlineForm({ onCancel, children, error, onSubmit, loading, submitLabel = 'Save' }: {
  onCancel: () => void; children: React.ReactNode; error?: string;
  onSubmit: () => void; loading: boolean; submitLabel?: string;
}) {
  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-5 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
      {error && (
        <p className="flex items-center gap-2 text-sm font-semibold text-rose-600">
          <AlertTriangle className="h-4 w-4 shrink-0" />{error}
        </p>
      )}
      <div className="flex gap-2 pt-1">
        <Button onClick={onSubmit} disabled={loading}>{loading ? 'Saving…' : submitLabel}</Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

function FInput({ label, value, onChange, type = 'text', placeholder = '' }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
      />
    </label>
  );
}

function FSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

function FMultiCheck({ label, options, selected, onChange }: {
  label: string; options: { value: string; label: string }[];
  selected: string[]; onChange: (v: string[]) => void;
}) {
  const toggle = (v: string) => onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  return (
    <div>
      <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">{label}</span>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            className={`rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
              selected.includes(o.value)
                ? 'border-indigo-500 bg-indigo-100 text-indigo-800'
                : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300'
            }`}
          >
            {o.label}
          </button>
        ))}
        {selected.length === 0 && (
          <span className="text-[11px] font-semibold text-slate-400 self-center">All stages (none selected)</span>
        )}
      </div>
    </div>
  );
}

// ─── Hub Page ─────────────────────────────────────────────────────────────────

export function TimetableHubPage() {
  const navigate = useNavigate();
  const { data: venues     = [] } = useVenues();
  const { data: activities = [] } = useTimetableActivities();
  const { data: sheets     = [] } = useTimetableSheets();

  const venueList = venues     as Venue[];
  const actList   = activities as TimetableActivity[];
  const sheetList = sheets     as TimetableSheet[];

  const published = sheetList.filter((s) => s.isPublished).length;
  const classTT   = sheetList.filter((s) => s.timetableType === 'CLASS').length;
  const extraTT   = sheetList.filter((s) => s.timetableType === 'EXTRACURRICULAR').length;

  const quickLinks = [
    { label: 'Manage Venues',    desc: 'Register and configure teaching venues',       to: '/admin/timetable/venues',     icon: Building2,  color: 'bg-blue-50 border-blue-200 text-blue-700'     },
    { label: 'Activity Types',   desc: 'Configure slot activities and colours',         to: '/admin/timetable/activities', icon: Activity,   color: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
    { label: 'All Timetables',   desc: 'Browse, create and manage timetable sheets',    to: '/admin/timetable/sheets',     icon: Calendar,   color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
    { label: 'Create Timetable', desc: 'Start a new class or extra-curricular sheet',  to: '/admin/timetable/sheets/new', icon: Plus,       color: 'bg-amber-50 border-amber-200 text-amber-700'  },
  ];

  return (
    <PageShell title="School Timetable" eyebrow="Academic scheduling system">
      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Venues',     value: venueList.filter((v) => v.isActive).length, detail: 'Active teaching spaces',     icon: Building2,    color: 'text-blue-600'    },
          { label: 'Sheets',     value: sheetList.length,                           detail: 'Timetable sheets total',     icon: Calendar,     color: 'text-indigo-600'  },
          { label: 'Published',  value: published,                                  detail: 'Visible to staff & students', icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'Activities', value: actList.length,                             detail: 'Configured slot types',      icon: Activity,     color: 'text-amber-600'   },
        ].map((m) => (
          <Card key={m.label} className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">{m.label}</p>
                <p className="mt-1.5 font-display text-3xl font-black text-slate-950">{m.value}</p>
                <p className="mt-1 text-xs font-bold text-slate-400">{m.detail}</p>
              </div>
              <m.icon className={`h-7 w-7 ${m.color}`} />
            </div>
          </Card>
        ))}
      </div>

      {/* Quick links */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {quickLinks.map((q) => (
          <button
            key={q.to}
            onClick={() => navigate(q.to)}
            className={`group flex items-start gap-4 rounded-2xl border p-5 text-left transition hover:shadow-md ${q.color}`}
          >
            <q.icon className="mt-0.5 h-6 w-6 shrink-0" />
            <div>
              <p className="font-display text-sm font-black">{q.label}</p>
              <p className="mt-0.5 text-xs font-semibold opacity-75">{q.desc}</p>
            </div>
            <ChevronRight className="ml-auto mt-0.5 h-4 w-4 shrink-0 opacity-40 group-hover:opacity-70" />
          </button>
        ))}
      </div>

      {/* Recent sheets */}
      <Card>
        <SectionHeader
          title="Recent Timetable Sheets"
          action={<Button variant="secondary" onClick={() => navigate('/admin/timetable/sheets')}>View all</Button>}
        />
        {sheetList.length === 0 ? (
          <div className="p-10 text-center text-sm font-semibold text-slate-400">
            No timetable sheets yet — create your first one.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {sheetList.slice(0, 8).map((sheet) => (
              <li key={sheet.id} className="flex items-center gap-4 px-6 py-3.5 transition hover:bg-slate-50">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-slate-900">{sheet.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {typeBadge(sheet.timetableType)}
                    {stageBadge(sheet.stage)}
                    {sheet.className && <Badge tone="slate">{sheet.className}</Badge>}
                  </div>
                </div>
                {sheet.isPublished ? <Badge tone="emerald">Published</Badge> : <Badge tone="slate">Draft</Badge>}
                <Button variant="ghost" onClick={() => navigate(`/admin/timetable/builder/${sheet.id}`)}>Open</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Breakdown */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Class Timetables',        value: classTT  },
          { label: 'Extra-curricular Sheets',  value: extraTT  },
          { label: 'Custom Sheets',            value: sheetList.filter((s) => s.timetableType === 'CUSTOM').length },
        ].map((s) => (
          <Card key={s.label} className="flex items-center justify-between p-5">
            <p className="font-bold text-slate-700">{s.label}</p>
            <span className="font-display text-2xl font-black text-slate-950">{s.value}</span>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}

// ─── Venues Page ─────────────────────────────────────────────────────────────

export function VenuesPage() {
  const { data: rawVenues = [] } = useVenues();
  const createMut = useCreateVenueMutation();
  const updateMut = useUpdateVenueMutation();
  const deleteMut = useDeleteVenueMutation();
  const venues    = rawVenues as Venue[];

  type Mode = 'none' | 'add' | { type: 'edit'; id: string } | { type: 'del'; id: string };
  const [mode, setMode] = useState<Mode>('none');
  const [err, setErr]   = useState('');

  const blank = { name: '', type: 'CLASSROOM', capacity: '40', stageFilter: [] as string[], description: '' };
  const [form, setForm] = useState(blank);
  function set(k: keyof typeof blank, v: unknown) { setForm((p) => ({ ...p, [k]: v })); }

  async function doSave() {
    setErr('');
    if (!form.name.trim()) { setErr('Venue name is required.'); return; }
    const payload = { ...form, capacity: Number(form.capacity) || 40 };
    try {
      if (mode === 'add') {
        await createMut.mutateAsync(payload);
        toast('Venue created.');
      } else if (typeof mode === 'object' && mode.type === 'edit') {
        await updateMut.mutateAsync({ id: mode.id, payload });
        toast('Venue updated.');
      }
      setMode('none'); setForm(blank);
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? e?.message ?? 'Failed.');
    }
  }

  async function doDelete(id: string) {
    try {
      await deleteMut.mutateAsync(id);
      toast('Venue deleted.'); setMode('none');
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? e?.message ?? 'Delete failed.');
    }
  }

  function startEdit(v: Venue) {
    setForm({ name: v.name, type: v.type, capacity: String(v.capacity), stageFilter: v.stageFilter, description: v.description ?? '' });
    setMode({ type: 'edit', id: v.id });
    setErr('');
  }

  return (
    <PageShell
      title="Venues"
      eyebrow="School timetable · Teaching spaces"
      actions={
        <Button onClick={() => { setMode('add'); setForm(blank); setErr(''); }}>
          <Plus className="mr-1.5 h-4 w-4" /> Add Venue
        </Button>
      }
    >
      {mode === 'add' && (
        <InlineForm onCancel={() => setMode('none')} onSubmit={doSave}
          loading={createMut.isPending} error={err} submitLabel="Create Venue">
          <FInput label="Venue Name" value={form.name} onChange={(v) => set('name', v)} placeholder="e.g. Library Hall" />
          <FSelect label="Type" value={form.type} onChange={(v) => set('type', v)}
            options={VENUE_TYPES.map((t) => ({ value: t, label: fmtLabel(t) }))} />
          <FInput label="Capacity" value={form.capacity} onChange={(v) => set('capacity', v)} type="number" placeholder="40" />
          <div className="sm:col-span-2 lg:col-span-3">
            <FMultiCheck label="Stage Restriction (blank = all stages)" options={STAGE_OPTIONS}
              selected={form.stageFilter} onChange={(v) => set('stageFilter', v)} />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <FInput label="Description (optional)" value={form.description} onChange={(v) => set('description', v)} />
          </div>
        </InlineForm>
      )}

      <DataTable columns={['Venue', 'Type', 'Capacity', 'Stages', 'Status', '']}>
        {venues.length === 0 && (
          <tr>
            <td colSpan={6} className="px-4 py-10 text-center text-sm font-semibold text-slate-400">
              No venues registered yet.
            </td>
          </tr>
        )}
        {venues.map((v) => (
          <React.Fragment key={v.id}>
            <tr className="hover:bg-slate-50">
              <Td><span className="font-bold text-slate-900">{v.name}</span></Td>
              <Td><Badge tone="blue">{fmtLabel(v.type)}</Badge></Td>
              <Td>{v.capacity}</Td>
              <Td>
                {v.stageFilter.length === 0
                  ? <Badge tone="slate">All stages</Badge>
                  : v.stageFilter.map((s) => <span key={s} className="mr-1">{stageBadge(s)}</span>)}
              </Td>
              <Td>{v.isActive ? <Badge tone="emerald">Active</Badge> : <Badge tone="slate">Inactive</Badge>}</Td>
              <Td>
                <div className="flex items-center gap-1">
                  <button onClick={() => startEdit(v)}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600" title="Edit">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => { setMode({ type: 'del', id: v.id }); setErr(''); }}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </Td>
            </tr>
            {typeof mode === 'object' && mode.type === 'edit' && mode.id === v.id && (
              <tr>
                <td colSpan={6} className="px-4 pb-3">
                  <InlineForm onCancel={() => setMode('none')} onSubmit={doSave}
                    loading={updateMut.isPending} error={err} submitLabel="Update Venue">
                    <FInput label="Venue Name" value={form.name} onChange={(v2) => set('name', v2)} />
                    <FSelect label="Type" value={form.type} onChange={(v2) => set('type', v2)}
                      options={VENUE_TYPES.map((t) => ({ value: t, label: fmtLabel(t) }))} />
                    <FInput label="Capacity" value={form.capacity} onChange={(v2) => set('capacity', v2)} type="number" />
                    <div className="sm:col-span-2 lg:col-span-3">
                      <FMultiCheck label="Stage Restriction" options={STAGE_OPTIONS}
                        selected={form.stageFilter} onChange={(v2) => set('stageFilter', v2)} />
                    </div>
                    <div className="sm:col-span-2 lg:col-span-3">
                      <FInput label="Description" value={form.description} onChange={(v2) => set('description', v2)} />
                    </div>
                  </InlineForm>
                </td>
              </tr>
            )}
            {typeof mode === 'object' && mode.type === 'del' && mode.id === v.id && (
              <tr>
                <td colSpan={6} className="px-4 pb-3">
                  <div className="flex items-center gap-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
                    <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600" />
                    <p className="flex-1 text-sm font-semibold text-rose-700">
                      Delete <strong>{v.name}</strong>? This cannot be undone.
                    </p>
                    {err && <p className="text-sm font-semibold text-rose-600">{err}</p>}
                    <Button variant="danger" onClick={() => doDelete(v.id)} disabled={deleteMut.isPending}>
                      {deleteMut.isPending ? 'Deleting…' : 'Delete'}
                    </Button>
                    <Button variant="ghost" onClick={() => setMode('none')}>Cancel</Button>
                  </div>
                </td>
              </tr>
            )}
          </React.Fragment>
        ))}
      </DataTable>
    </PageShell>
  );
}

// ─── Activities Page ──────────────────────────────────────────────────────────

export function TimetableActivitiesPage() {
  const { data: rawActs = [] } = useTimetableActivities();
  const createMut  = useCreateTimetableActivityMutation();
  const updateMut  = useUpdateTimetableActivityMutation();
  const deleteMut  = useDeleteTimetableActivityMutation();
  const activities = rawActs as TimetableActivity[];

  type Mode = 'none' | 'add' | { type: 'edit'; id: string } | { type: 'del'; id: string };
  const [mode, setMode] = useState<Mode>('none');
  const [err, setErr]   = useState('');

  const blank = { name: '', activityType: 'LESSON', defaultDuration: '40', stageFilter: [] as string[], description: '', colorCode: '#4338CA' };
  const [form, setForm] = useState(blank);
  function set(k: keyof typeof blank, v: unknown) { setForm((p) => ({ ...p, [k]: v })); }

  async function doSave() {
    setErr('');
    if (!form.name.trim()) { setErr('Name is required.'); return; }
    const payload = { ...form, defaultDuration: Number(form.defaultDuration) || 40 };
    try {
      if (mode === 'add') {
        await createMut.mutateAsync(payload);
        toast('Activity type created.');
      } else if (typeof mode === 'object' && mode.type === 'edit') {
        await updateMut.mutateAsync({ id: mode.id, payload });
        toast('Activity type updated.');
      }
      setMode('none'); setForm(blank);
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? e?.message ?? 'Failed.');
    }
  }

  async function doDelete(id: string) {
    try {
      await deleteMut.mutateAsync(id);
      toast('Activity type deleted.'); setMode('none');
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? e?.message ?? 'Delete failed.');
    }
  }

  function startEdit(a: TimetableActivity) {
    setForm({
      name: a.name, activityType: a.activityType, defaultDuration: String(a.defaultDuration),
      stageFilter: a.stageFilter, description: a.description ?? '',
      colorCode: a.colorCode ?? '#4338CA',
    });
    setMode({ type: 'edit', id: a.id });
    setErr('');
  }

  return (
    <PageShell
      title="Activity Types"
      eyebrow="School timetable · Slot configuration"
      actions={
        <Button onClick={() => { setMode('add'); setForm(blank); setErr(''); }}>
          <Plus className="mr-1.5 h-4 w-4" /> Add Activity
        </Button>
      }
    >
      {mode === 'add' && (
        <InlineForm onCancel={() => setMode('none')} onSubmit={doSave}
          loading={createMut.isPending} error={err} submitLabel="Create Activity">
          <FInput label="Name" value={form.name} onChange={(v) => set('name', v)} placeholder="e.g. Morning Assembly" />
          <FSelect label="Activity Type" value={form.activityType} onChange={(v) => set('activityType', v)}
            options={ACTIVITY_TYPES.map((t) => ({ value: t, label: fmtLabel(t) }))} />
          <FInput label="Default Duration (min)" value={form.defaultDuration} onChange={(v) => set('defaultDuration', v)} type="number" />
          <div>
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Colour</span>
            <input type="color" value={form.colorCode} onChange={(e) => set('colorCode', e.target.value)}
              className="mt-1.5 h-9 w-16 cursor-pointer rounded-lg border border-slate-300 p-0.5" />
          </div>
          <div className="sm:col-span-2">
            <FMultiCheck label="Stage Restriction (blank = all)" options={STAGE_OPTIONS}
              selected={form.stageFilter} onChange={(v) => set('stageFilter', v)} />
          </div>
          <FInput label="Description" value={form.description} onChange={(v) => set('description', v)} />
        </InlineForm>
      )}

      <DataTable columns={['Activity', 'Type', 'Duration', 'Colour', 'Stages', 'Status', '']}>
        {activities.length === 0 && (
          <tr>
            <td colSpan={7} className="px-4 py-10 text-center text-sm font-semibold text-slate-400">
              No activity types yet. Add one to start building timetables.
            </td>
          </tr>
        )}
        {activities.map((a) => (
          <React.Fragment key={a.id}>
            <tr className="hover:bg-slate-50">
              <Td><span className="font-bold text-slate-900">{a.name}</span></Td>
              <Td><Badge tone="blue">{fmtLabel(a.activityType)}</Badge></Td>
              <Td>{a.defaultDuration} min</Td>
              <Td>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-4 w-4 rounded-full border border-white shadow" style={{ background: a.colorCode ?? '#4338CA' }} />
                  <span className="font-mono text-xs text-slate-500">{a.colorCode}</span>
                </span>
              </Td>
              <Td>
                {a.stageFilter.length === 0
                  ? <Badge tone="slate">All</Badge>
                  : a.stageFilter.map((s) => <span key={s} className="mr-1">{stageBadge(s)}</span>)}
              </Td>
              <Td>{a.isActive ? <Badge tone="emerald">Active</Badge> : <Badge tone="slate">Inactive</Badge>}</Td>
              <Td>
                <div className="flex items-center gap-1">
                  <button onClick={() => startEdit(a)}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => { setMode({ type: 'del', id: a.id }); setErr(''); }}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </Td>
            </tr>
            {typeof mode === 'object' && mode.type === 'edit' && mode.id === a.id && (
              <tr>
                <td colSpan={7} className="px-4 pb-3">
                  <InlineForm onCancel={() => setMode('none')} onSubmit={doSave}
                    loading={updateMut.isPending} error={err} submitLabel="Update Activity">
                    <FInput label="Name" value={form.name} onChange={(v) => set('name', v)} />
                    <FSelect label="Activity Type" value={form.activityType} onChange={(v) => set('activityType', v)}
                      options={ACTIVITY_TYPES.map((t) => ({ value: t, label: fmtLabel(t) }))} />
                    <FInput label="Default Duration (min)" value={form.defaultDuration} onChange={(v) => set('defaultDuration', v)} type="number" />
                    <div>
                      <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Colour</span>
                      <input type="color" value={form.colorCode} onChange={(e) => set('colorCode', e.target.value)}
                        className="mt-1.5 h-9 w-16 cursor-pointer rounded-lg border border-slate-300 p-0.5" />
                    </div>
                    <div className="sm:col-span-2">
                      <FMultiCheck label="Stage Restriction" options={STAGE_OPTIONS}
                        selected={form.stageFilter} onChange={(v) => set('stageFilter', v)} />
                    </div>
                    <FInput label="Description" value={form.description} onChange={(v) => set('description', v)} />
                  </InlineForm>
                </td>
              </tr>
            )}
            {typeof mode === 'object' && mode.type === 'del' && mode.id === a.id && (
              <tr>
                <td colSpan={7} className="px-4 pb-3">
                  <div className="flex flex-wrap items-center gap-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
                    <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600" />
                    <p className="flex-1 text-sm font-semibold text-rose-700">
                      Delete <strong>{a.name}</strong>? Slots using this activity will lose the reference.
                    </p>
                    {err && <p className="text-sm font-semibold text-rose-600">{err}</p>}
                    <Button variant="danger" onClick={() => doDelete(a.id)} disabled={deleteMut.isPending}>
                      {deleteMut.isPending ? 'Deleting…' : 'Delete'}
                    </Button>
                    <Button variant="ghost" onClick={() => setMode('none')}>Cancel</Button>
                  </div>
                </td>
              </tr>
            )}
          </React.Fragment>
        ))}
      </DataTable>
    </PageShell>
  );
}

// ─── Sheets List Page ─────────────────────────────────────────────────────────

export function TimetableSheetsPage() {
  const navigate  = useNavigate();
  const deleteMut = useDeleteTimetableSheetMutation();
  const updateMut = useUpdateTimetableSheetMutation();
  const { data: rawYears = [] } = useAcademicYears();
  const { data: rawTerms = [] } = useTerms();

  const years = rawYears as { id: string; name: string }[];
  const terms = rawTerms as { id: string; name: string; academicYearId?: string }[];

  const [filter, setFilter] = useState({ type: '', stage: '', academicYearId: '', termId: '' });
  const [delId,  setDelId]  = useState('');
  const [delErr, setDelErr] = useState('');

  const apiParams = Object.fromEntries(
    Object.entries({ timetableType: filter.type, stage: filter.stage, academicYearId: filter.academicYearId, termId: filter.termId }).filter(([, v]) => Boolean(v)),
  ) as Record<string, string>;

  const { data: rawSheets = [] } = useTimetableSheets(Object.keys(apiParams).length ? apiParams : undefined);
  const sheets = rawSheets as TimetableSheet[];
  const filtered = sheets;
  const termOptions = filter.academicYearId ? terms.filter((t) => !t.academicYearId || t.academicYearId === filter.academicYearId) : terms;

  async function doDelete(id: string) {
    try {
      await deleteMut.mutateAsync(id);
      toast('Sheet deleted.'); setDelId('');
    } catch (e: any) {
      setDelErr(e?.response?.data?.message ?? e?.message ?? 'Failed.');
    }
  }

  async function togglePublish(s: TimetableSheet) {
    try {
      await updateMut.mutateAsync({ id: s.id, payload: { isPublished: !s.isPublished } });
      toast(s.isPublished ? 'Sheet unpublished.' : 'Sheet published.');
    } catch (e: any) {
      toast(e?.response?.data?.message ?? 'Failed.', 'error');
    }
  }

  return (
    <PageShell
      title="Timetable Sheets"
      eyebrow="School timetable · All sheets"
      actions={
        <Button onClick={() => navigate('/admin/timetable/sheets/new')}>
          <Plus className="mr-1.5 h-4 w-4" /> New Sheet
        </Button>
      }
    >
      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <FSelect label="Academic Year" value={filter.academicYearId}
            onChange={(v) => setFilter((p) => ({ ...p, academicYearId: v, termId: '' }))}
            options={[{ value: '', label: 'All years' }, ...years.map((y) => ({ value: y.id, label: y.name }))]} />
          <FSelect label="Term" value={filter.termId}
            onChange={(v) => setFilter((p) => ({ ...p, termId: v }))}
            options={[{ value: '', label: 'All terms' }, ...termOptions.map((t) => ({ value: t.id, label: t.name }))]} />
          <FSelect label="Type" value={filter.type}
            onChange={(v) => setFilter((p) => ({ ...p, type: v }))}
            options={[{ value: '', label: 'All types' }, ...TIMETABLE_TYPES.map((t) => ({ value: t, label: fmtLabel(t) }))]} />
          <FSelect label="Stage" value={filter.stage}
            onChange={(v) => setFilter((p) => ({ ...p, stage: v }))}
            options={[{ value: '', label: 'All stages' }, ...STAGE_OPTIONS]} />
        </div>
      </Card>

      <DataTable columns={['Sheet Name', 'Type', 'Stage', 'Class', 'Slots', 'Status', '']} minWidth={900}>
        {filtered.length === 0 && (
          <tr>
            <td colSpan={7} className="px-4 py-10 text-center text-sm font-semibold text-slate-400">
              No sheets found. {(filter.type || filter.stage || filter.academicYearId || filter.termId) ? 'Clear filters or ' : ''}Create your first timetable.
            </td>
          </tr>
        )}
        {filtered.map((s) => (
          <React.Fragment key={s.id}>
            <tr className="hover:bg-slate-50">
              <Td>
                <button
                  className="text-left font-bold text-indigo-700 hover:underline"
                  onClick={() => navigate(`/admin/timetable/builder/${s.id}`)}
                >
                  {s.name}
                </button>
              </Td>
              <Td>{typeBadge(s.timetableType)}</Td>
              <Td>{stageBadge(s.stage)}</Td>
              <Td>{s.className ?? <span className="text-slate-400">—</span>}</Td>
              <Td>{(s.slots ?? []).length}</Td>
              <Td>
                <button onClick={() => togglePublish(s)} className="focus:outline-none">
                  {s.isPublished ? <Badge tone="emerald">Published</Badge> : <Badge tone="slate">Draft</Badge>}
                </button>
              </Td>
              <Td>
                <div className="flex items-center gap-1">
                  <button onClick={() => navigate(`/admin/timetable/builder/${s.id}`)}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600" title="Open Builder">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => navigate(`/admin/timetable/print/${s.id}`)}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600" title="Print">
                    <Printer className="h-4 w-4" />
                  </button>
                  <button onClick={() => { setDelId(s.id); setDelErr(''); }}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600" title="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </Td>
            </tr>
            {delId === s.id && (
              <tr>
                <td colSpan={7} className="px-4 pb-3">
                  <div className="flex flex-wrap items-center gap-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
                    <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600" />
                    <p className="flex-1 text-sm font-semibold text-rose-700">
                      Delete <strong>{s.name}</strong>? All {(s.slots ?? []).length} slot{(s.slots ?? []).length !== 1 ? 's' : ''} will be permanently removed.
                    </p>
                    {delErr && <p className="text-sm font-semibold text-rose-600">{delErr}</p>}
                    <Button variant="danger" onClick={() => doDelete(s.id)} disabled={deleteMut.isPending}>
                      {deleteMut.isPending ? 'Deleting…' : 'Delete'}
                    </Button>
                    <Button variant="ghost" onClick={() => setDelId('')}>Cancel</Button>
                  </div>
                </td>
              </tr>
            )}
          </React.Fragment>
        ))}
      </DataTable>
    </PageShell>
  );
}

// ─── Create Sheet Page ────────────────────────────────────────────────────────

export function CreateTimetableSheetPage() {
  const navigate  = useNavigate();
  const createMut = useCreateTimetableSheetMutation();
  const { data: rawYears   = [] } = useAcademicYears() as any;
  const { data: rawClasses = [] } = useAdminClasses()  as any;

  const [form, setForm] = useState({
    name: '', timetableType: 'CLASS', stage: '', classId: '',
    academicYearId: '', termId: '', note: '',
  });
  const [err, setErr] = useState('');

  const years   = Array.isArray(rawYears)   ? rawYears   : [];
  const classes = Array.isArray(rawClasses) ? rawClasses : [];

  const stageClasses = form.stage
    ? classes.filter((c: any) => !form.stage || c.stage === form.stage)
    : classes;

  async function doCreate() {
    setErr('');
    if (!form.name.trim())           { setErr('Sheet name is required.'); return; }
    if (!form.academicYearId.trim()) { setErr('Academic year is required.'); return; }
    try {
      const payload: any = { ...form };
      if (!payload.stage)   delete payload.stage;
      if (!payload.classId) delete payload.classId;
      if (!payload.termId)  delete payload.termId;
      if (!payload.note)    delete payload.note;
      const sheet = await createMut.mutateAsync(payload);
      toast('Timetable sheet created.');
      navigate(`/admin/timetable/builder/${(sheet as any).id}`);
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? e?.message ?? 'Failed.');
    }
  }

  return (
    <PageShell title="New Timetable Sheet" eyebrow="School timetable · Create">
      <Card className="max-w-2xl">
        <SectionHeader title="Sheet Details" />
        <div className="space-y-5 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <FInput label="Sheet Name" value={form.name} onChange={(v) => setForm((p) => ({ ...p, name: v }))}
              placeholder="e.g. Primary 4A — Term 1 2025" />
            <FSelect label="Timetable Type" value={form.timetableType}
              onChange={(v) => setForm((p) => ({ ...p, timetableType: v }))}
              options={TIMETABLE_TYPES.map((t) => ({ value: t, label: fmtLabel(t) }))} />
            <FSelect label="Stage" value={form.stage}
              onChange={(v) => setForm((p) => ({ ...p, stage: v, classId: '' }))}
              options={[{ value: '', label: 'All stages / none' }, ...STAGE_OPTIONS]} />
            {form.timetableType === 'CLASS' && (
              <FSelect label="Class (optional)" value={form.classId}
                onChange={(v) => setForm((p) => ({ ...p, classId: v }))}
                options={[
                  { value: '', label: 'No specific class' },
                  ...stageClasses.map((c: any) => ({ value: c.id, label: c.name })),
                ]} />
            )}
            <FSelect label="Academic Year" value={form.academicYearId}
              onChange={(v) => setForm((p) => ({ ...p, academicYearId: v }))}
              options={[
                { value: '', label: 'Select year…' },
                ...years.map((y: any) => ({ value: y.id, label: y.name })),
              ]} />
            <FInput label="Notes (optional)" value={form.note}
              onChange={(v) => setForm((p) => ({ ...p, note: v }))} />
          </div>

          {err && (
            <p className="flex items-center gap-2 text-sm font-semibold text-rose-600">
              <AlertTriangle className="h-4 w-4" />{err}
            </p>
          )}
          <div className="flex gap-2 pt-2">
            <Button onClick={doCreate} disabled={createMut.isPending}>
              {createMut.isPending ? 'Creating…' : 'Create & Open Builder'}
            </Button>
            <Button variant="ghost" onClick={() => navigate('/admin/timetable/sheets')}>Cancel</Button>
          </div>
        </div>
      </Card>
    </PageShell>
  );
}

// ─── Builder Page ─────────────────────────────────────────────────────────────

type SlotModalState = { open: boolean; day: string; slot?: TimetableSlot };

const EMPTY_SLOT_FORM = {
  dayOfWeek: 'MONDAY', startTime: '08:00', endTime: '08:40',
  activityType: 'LESSON', label: '', subjectName: '', teacherName: '',
  venueId: '', colorCode: '', notes: '',
};

export function TimetableBuilderPage() {
  const { id: sheetId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: sheetData, isLoading, isError } = useTimetableSheet(sheetId);
  const { data: rawVenues = [] } = useVenues();

  const createSlotMut  = useCreateTimetableSlotMutation();
  const updateSlotMut  = useUpdateTimetableSlotMutation();
  const deleteSlotMut  = useDeleteTimetableSlotMutation();
  const autoGenMut     = useAutoGenerateTimetableMutation();
  const updateSheetMut = useUpdateTimetableSheetMutation();

  const sheet  = sheetData as TimetableSheet | undefined;
  const slots  = (sheet?.slots ?? []) as TimetableSlot[];
  const venues = rawVenues as Venue[];

  const [modal,      setModal]      = useState<SlotModalState>({ open: false, day: 'MONDAY' });
  const [slotForm,   setSlotForm]   = useState(EMPTY_SLOT_FORM);
  const [slotErr,    setSlotErr]    = useState('');
  const [conflict,   setConflict]   = useState<string | null>(null);
  const [showAutoGen, setShowAutoGen] = useState(false);
  const [genConfig,  setGenConfig]  = useState({
    startTime: '07:00', endTime: '17:00',
    breakAfterPeriods: '3', breakDuration: '20', periodDuration: '40',
  });

  function slotsByDay(day: string) {
    return slots
      .filter((s) => s.dayOfWeek === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  function openAdd(day: string) {
    setSlotForm({ ...EMPTY_SLOT_FORM, dayOfWeek: day });
    setModal({ open: true, day });
    setSlotErr(''); setConflict(null);
  }

  function openEdit(slot: TimetableSlot) {
    setSlotForm({
      dayOfWeek:    slot.dayOfWeek,
      startTime:    slot.startTime,
      endTime:      slot.endTime,
      activityType: slot.activityType,
      label:        slot.label        ?? '',
      subjectName:  slot.subjectName  ?? '',
      teacherName:  slot.teacherName  ?? '',
      venueId:      slot.venueId      ?? '',
      colorCode:    slot.colorCode    ?? '',
      notes:        slot.notes        ?? '',
    });
    setModal({ open: true, day: slot.dayOfWeek, slot });
    setSlotErr(''); setConflict(null);
  }

  async function doSaveSlot() {
    setSlotErr(''); setConflict(null);
    if (!slotForm.startTime || !slotForm.endTime) { setSlotErr('Start and end time are required.'); return; }
    if (slotForm.startTime >= slotForm.endTime)   { setSlotErr('End time must be after start time.'); return; }

    const payload: any = {
      ...slotForm,
      sheetId,
      label: slotForm.label || slotForm.subjectName || fmtLabel(slotForm.activityType),
      colorCode: slotForm.colorCode || ACTIVITY_COLORS[slotForm.activityType] || '#4338CA',
    };
    if (!payload.venueId)     delete payload.venueId;
    if (!payload.subjectName) delete payload.subjectName;
    if (!payload.teacherName) delete payload.teacherName;
    if (!payload.notes)       delete payload.notes;

    try {
      if (modal.slot) {
        await updateSlotMut.mutateAsync({ id: modal.slot.id, payload });
        toast('Slot updated.');
      } else {
        await createSlotMut.mutateAsync(payload);
        toast('Slot added.');
      }
      setModal({ open: false, day: 'MONDAY' });
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Failed.';
      if (msg.toLowerCase().includes('conflict')) setConflict(msg);
      else setSlotErr(msg);
    }
  }

  async function doDeleteSlot(slot: TimetableSlot) {
    try {
      await deleteSlotMut.mutateAsync({ id: slot.id, sheetId: sheetId! });
      toast('Slot removed.');
    } catch (e: any) {
      toast(e?.response?.data?.message ?? 'Failed.', 'error');
    }
  }

  async function doAutoGenerate() {
    if (!sheetId) return;
    try {
      const payload = {
        startTime: genConfig.startTime,
        endTime: genConfig.endTime,
        breakAfterPeriods: Number(genConfig.breakAfterPeriods),
        breakDuration: Number(genConfig.breakDuration),
        periodDuration: Number(genConfig.periodDuration),
        classId: sheet?.classId,
        stage: sheet?.stage,
        academicYearId: sheet?.academicYearId,
        termId: sheet?.termId,
      };
      await autoGenMut.mutateAsync({ sheetId, payload });
      toast('Timetable auto-generated successfully!');
      setShowAutoGen(false);
    } catch (e: any) {
      toast(e?.response?.data?.message ?? 'Auto-generate failed.', 'error');
    }
  }

  async function togglePublish() {
    if (!sheet || !sheetId) return;
    try {
      await updateSheetMut.mutateAsync({ id: sheetId, payload: { isPublished: !sheet.isPublished } });
      toast(sheet.isPublished ? 'Sheet unpublished.' : 'Sheet published.');
    } catch (e: any) {
      toast(e?.response?.data?.message ?? 'Failed.', 'error');
    }
  }

  const activityColor = (type: string) => ACTIVITY_COLORS[type] ?? '#4338CA';

  if (isLoading) return (
    <div className="flex h-60 items-center justify-center font-semibold text-slate-400">Loading timetable…</div>
  );
  if (isError || !sheet) return (
    <div className="flex h-60 items-center justify-center font-semibold text-rose-500">Could not load timetable sheet.</div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="relative overflow-hidden rounded-2xl border border-indigo-300/30 bg-[linear-gradient(135deg,#1E1B4B_0%,#312E81_50%,#4338CA_100%)] p-6 print:hidden">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.32em] text-sky-300">Timetable Builder</p>
            <h1 className="mt-1.5 font-display text-3xl font-black text-white">{sheet.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {typeBadge(sheet.timetableType)}
              {stageBadge(sheet.stage)}
              {sheet.className && <Badge tone="slate">{sheet.className}</Badge>}
              {sheet.isPublished ? <Badge tone="emerald">Published</Badge> : <Badge tone="amber">Draft</Badge>}
              <span className="text-xs text-white/50">{slots.length} slot{slots.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline-white" onClick={() => setShowAutoGen(!showAutoGen)}>
              <Wand2 className="mr-1.5 h-4 w-4" /> Auto-Generate
            </Button>
            <Button variant="outline-white" onClick={() => navigate(`/admin/timetable/print/${sheetId}`)}>
              <Printer className="mr-1.5 h-4 w-4" /> Print
            </Button>
            <Button onClick={togglePublish} disabled={updateSheetMut.isPending}>
              {sheet.isPublished ? 'Unpublish' : 'Publish'}
            </Button>
          </div>
        </div>
      </section>

      {/* Auto-generate panel */}
      {showAutoGen && (
        <Card className="print:hidden">
          <SectionHeader title="Auto-Generate Timetable" />
          <div className="space-y-4 p-5">
            <p className="text-sm font-semibold text-slate-600">
              The system will fetch assigned subjects for this class and distribute them evenly across Mon–Fri,
              inserting breaks at regular intervals. Existing slots are cleared first.
            </p>
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <FInput label="Start Time"          value={genConfig.startTime}         onChange={(v) => setGenConfig((p) => ({ ...p, startTime: v }))}         type="time" />
              <FInput label="End Time"            value={genConfig.endTime}           onChange={(v) => setGenConfig((p) => ({ ...p, endTime: v }))}           type="time" />
              <FInput label="Period (min)"         value={genConfig.periodDuration}    onChange={(v) => setGenConfig((p) => ({ ...p, periodDuration: v }))}    type="number" />
              <FInput label="Break after N periods" value={genConfig.breakAfterPeriods} onChange={(v) => setGenConfig((p) => ({ ...p, breakAfterPeriods: v }))} type="number" />
              <FInput label="Break duration (min)"  value={genConfig.breakDuration}     onChange={(v) => setGenConfig((p) => ({ ...p, breakDuration: v }))}     type="number" />
            </div>
            <div className="flex gap-2">
              <Button onClick={doAutoGenerate} disabled={autoGenMut.isPending}>
                <RefreshCw className={`mr-1.5 h-4 w-4 ${autoGenMut.isPending ? 'animate-spin' : ''}`} />
                {autoGenMut.isPending ? 'Generating…' : 'Generate Now'}
              </Button>
              <Button variant="ghost" onClick={() => setShowAutoGen(false)}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      {/* Slot Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:hidden">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <h2 className="font-display text-lg font-black text-slate-900">
                {modal.slot ? 'Edit Slot' : `Add Slot — ${fmtLabel(modal.day)}`}
              </h2>
              <button onClick={() => setModal({ open: false, day: 'MONDAY' })} className="text-slate-400 hover:text-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <FSelect label="Activity Type" value={slotForm.activityType}
                  onChange={(v) => setSlotForm((p) => ({ ...p, activityType: v, colorCode: ACTIVITY_COLORS[v] ?? '' }))}
                  options={ACTIVITY_TYPES.map((t) => ({ value: t, label: fmtLabel(t) }))} />
                <FSelect label="Day" value={slotForm.dayOfWeek}
                  onChange={(v) => setSlotForm((p) => ({ ...p, dayOfWeek: v }))}
                  options={DAYS.map((d) => ({ value: d, label: fmtLabel(d) }))} />
                <FInput label="Start Time" value={slotForm.startTime} onChange={(v) => setSlotForm((p) => ({ ...p, startTime: v }))} type="time" />
                <FInput label="End Time"   value={slotForm.endTime}   onChange={(v) => setSlotForm((p) => ({ ...p, endTime: v }))}   type="time" />
                <FInput label="Label (display)" value={slotForm.label}
                  onChange={(v) => setSlotForm((p) => ({ ...p, label: v }))}
                  placeholder={slotForm.subjectName || fmtLabel(slotForm.activityType)} />
                <FInput label="Subject Name" value={slotForm.subjectName}
                  onChange={(v) => setSlotForm((p) => ({ ...p, subjectName: v }))}
                  placeholder="e.g. Mathematics" />
                <FInput label="Teacher Name" value={slotForm.teacherName}
                  onChange={(v) => setSlotForm((p) => ({ ...p, teacherName: v }))} />
                <FSelect label="Venue (optional)" value={slotForm.venueId}
                  onChange={(v) => setSlotForm((p) => ({ ...p, venueId: v }))}
                  options={[
                    { value: '', label: 'No specific venue' },
                    ...venues.filter((v) => v.isActive).map((v) => ({ value: v.id, label: `${v.name} (${fmtLabel(v.type)})` })),
                  ]} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Colour</span>
                  <div className="mt-1.5 flex items-center gap-2">
                    <input type="color"
                      value={slotForm.colorCode || activityColor(slotForm.activityType)}
                      onChange={(e) => setSlotForm((p) => ({ ...p, colorCode: e.target.value }))}
                      className="h-9 w-16 cursor-pointer rounded-lg border border-slate-300 p-0.5" />
                    <span className="font-mono text-xs text-slate-500">
                      {slotForm.colorCode || activityColor(slotForm.activityType)}
                    </span>
                  </div>
                </div>
                <FInput label="Notes" value={slotForm.notes} onChange={(v) => setSlotForm((p) => ({ ...p, notes: v }))} />
              </div>

              {conflict && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                  <div>
                    <p className="text-sm font-black text-rose-700">Scheduling Conflict Detected</p>
                    <p className="mt-0.5 text-xs font-semibold text-rose-600">{conflict}</p>
                  </div>
                </div>
              )}
              {slotErr && (
                <p className="flex items-center gap-1.5 text-sm font-semibold text-rose-600">
                  <AlertTriangle className="h-4 w-4" />{slotErr}
                </p>
              )}
            </div>
            <div className="flex gap-2 border-t border-slate-100 p-5">
              <Button onClick={doSaveSlot} disabled={createSlotMut.isPending || updateSlotMut.isPending}>
                {createSlotMut.isPending || updateSlotMut.isPending ? 'Saving…' : modal.slot ? 'Update Slot' : 'Add Slot'}
              </Button>
              <Button variant="ghost" onClick={() => setModal({ open: false, day: 'MONDAY' })}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* Week Grid */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid min-w-[700px]" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
          {DAYS.map((day) => (
            <div key={day} className="border-r border-slate-100 last:border-r-0">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-[#1E1B4B] px-3 py-3">
                <span className="font-display text-sm font-black uppercase tracking-wider text-white">{fmtLabel(day)}</span>
                <button
                  onClick={() => openAdd(day)}
                  className="rounded-lg p-1 text-white/50 transition hover:bg-white/10 hover:text-white print:hidden"
                  title={`Add slot on ${fmtLabel(day)}`}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <div className="flex min-h-[200px] flex-col gap-2 p-2">
                {slotsByDay(day).length === 0 ? (
                  <button
                    onClick={() => openAdd(day)}
                    className="mt-2 flex h-16 w-full items-center justify-center rounded-lg border-2 border-dashed border-slate-200 text-xs font-bold text-slate-400 transition hover:border-indigo-300 hover:text-indigo-500 print:hidden"
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add slot
                  </button>
                ) : (
                  slotsByDay(day).map((slot) => (
                    <div
                      key={slot.id}
                      className="group relative rounded-lg border-l-4 bg-white shadow-sm"
                      style={{ borderColor: slot.colorCode ?? activityColor(slot.activityType) }}
                    >
                      <div
                        className="rounded-r-lg px-2.5 py-2"
                        style={{ background: (slot.colorCode ?? activityColor(slot.activityType)) + '18' }}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-xs font-bold leading-tight text-slate-900">
                            {slot.label || slot.subjectName || fmtLabel(slot.activityType)}
                          </p>
                          <div className="flex shrink-0 gap-0.5 opacity-0 transition group-hover:opacity-100 print:hidden">
                            <button onClick={() => openEdit(slot)} className="rounded p-0.5 hover:bg-black/10">
                              <Edit2 className="h-3 w-3 text-slate-600" />
                            </button>
                            <button onClick={() => doDeleteSlot(slot)} className="rounded p-0.5 hover:bg-rose-100">
                              <Trash2 className="h-3 w-3 text-rose-500" />
                            </button>
                          </div>
                        </div>
                        <p className="mt-0.5 text-[10px] font-semibold text-slate-500">
                          {slot.startTime} – {slot.endTime}
                        </p>
                        {slot.teacherName && (
                          <p className="truncate text-[10px] text-slate-500">{slot.teacherName}</p>
                        )}
                        {slot.venue && (
                          <p className="truncate text-[10px] text-slate-400">{slot.venue.name}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 print:hidden">
        {ACTIVITY_TYPES.map((t) => (
          <span key={t} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <span className="h-3 w-3 rounded-full" style={{ background: ACTIVITY_COLORS[t] }} />
            {fmtLabel(t)}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── PDF generator ────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace('#', '');
  const n = parseInt(c.length === 3 ? c.split('').map((x) => x + x).join('') : c, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

async function generateTimetablePdf(sheet: TimetableSheet, slots: TimetableSlot[]) {
  const { jsPDF } = await import('jspdf');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const PW = 297;  // page width  (landscape A4)
  const PH = 210;  // page height
  const M  = 12;   // margin

  // ── palette ──────────────────────────────────────────────────────────────
  const DARK   : [number,number,number] = [30, 27, 75];   // #1E1B4B
  const MID    : [number,number,number] = [49, 46, 129];  // #312E81
  const ACCENT : [number,number,number] = [67, 56, 202];  // #4338CA
  const SKY    : [number,number,number] = [125, 211, 252]; // sky-300
  const SLATE50: [number,number,number] = [248, 250, 252];
  const SLATE2 : [number,number,number] = [226, 232, 240];
  const SLATE9 : [number,number,number] = [15, 23, 42];
  const WHITE  : [number,number,number] = [255, 255, 255];

  // ── HEADER BAND ───────────────────────────────────────────────────────────
  doc.setFillColor(...DARK);
  doc.rect(0, 0, PW, 36, 'F');

  // accent bar left
  doc.setFillColor(...ACCENT);
  doc.rect(0, 0, 4, 36, 'F');

  // Logo circle
  doc.setFillColor(...MID);
  doc.circle(M + 12, 18, 11, 'F');
  doc.setFillColor(...SKY);
  doc.circle(M + 12, 18, 9, 'F');
  doc.setFillColor(...DARK);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text('KEMS', M + 12, 16.5, { align: 'center' });
  doc.setFontSize(5.5);
  doc.text('SCHOOL', M + 12, 20, { align: 'center' });

  // School name
  doc.setTextColor(...WHITE);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('KILIMANJARO EDUCATION MANAGEMENT', M + 28, 14);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...SKY);
  doc.text('Excellence in Education  ·  Discipline  ·  Knowledge  ·  Service', M + 28, 20);

  // Right side: OFFICIAL TIMETABLE
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...SKY);
  doc.text('OFFICIAL TIMETABLE', PW - M, 14, { align: 'right' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 200, 220);
  doc.text(
    `Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}`,
    PW - M, 21, { align: 'right' },
  );

  // ── META BAND ─────────────────────────────────────────────────────────────
  doc.setFillColor(...SLATE50);
  doc.rect(0, 36, PW, 16, 'F');
  doc.setDrawColor(...SLATE2);
  doc.setLineWidth(0.2);
  doc.line(0, 52, PW, 52);

  const metaItems = [
    { label: 'TIMETABLE', value: sheet.name },
    ...(sheet.className ? [{ label: 'CLASS', value: sheet.className }] : []),
    ...(sheet.stage     ? [{ label: 'STAGE', value: fmtLabel(sheet.stage) }] : []),
    { label: 'TYPE', value: fmtLabel(sheet.timetableType) },
    { label: 'LESSONS', value: `${slots.filter((s) => s.activityType === 'LESSON').length} periods` },
    { label: 'STATUS', value: sheet.isPublished ? 'Published' : 'Draft' },
  ];

  const metaX = M + 4;
  const colW = (PW - M * 2 - 8) / metaItems.length;
  metaItems.forEach((item, i) => {
    const x = metaX + i * colW;
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...ACCENT);
    doc.text(item.label, x, 42);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...SLATE9);
    doc.text(item.value, x, 49);
  });

  // ── TIMETABLE GRID ────────────────────────────────────────────────────────
  const tableTop = 56;
  const tableH   = PH - tableTop - 18;  // leave room for footer
  const colWidth = (PW - M * 2) / 5;

  // Time column header placeholder (no time col — just day headers)
  DAYS.forEach((day, di) => {
    const cx = M + di * colWidth;
    doc.setFillColor(...MID);
    doc.rect(cx, tableTop, colWidth, 10, 'F');
    doc.setDrawColor(...DARK);
    doc.setLineWidth(0.3);
    doc.rect(cx, tableTop, colWidth, 10, 'S');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...WHITE);
    doc.text(fmtLabel(day).toUpperCase(), cx + colWidth / 2, tableTop + 6.5, { align: 'center' });
  });

  // Slot rows
  const slotsByDayFn = (day: string) =>
    slots.filter((s) => s.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime));

  const maxRows = Math.max(...DAYS.map((d) => slotsByDayFn(d).length), 1);
  const rowH    = Math.min((tableH - 10) / maxRows, 22);

  Array.from({ length: maxRows }).forEach((_, ri) => {
    const rowY = tableTop + 10 + ri * rowH;
    const bg   = ri % 2 === 0 ? WHITE : SLATE50;

    DAYS.forEach((day, di) => {
      const cx   = M + di * colWidth;
      const slot = slotsByDayFn(day)[ri];

      doc.setFillColor(...bg);
      doc.rect(cx, rowY, colWidth, rowH, 'F');
      doc.setDrawColor(...SLATE2);
      doc.setLineWidth(0.15);
      doc.rect(cx, rowY, colWidth, rowH, 'S');

      if (!slot) return;

      const color = slot.colorCode ?? ACTIVITY_COLORS[slot.activityType] ?? '#4338CA';
      const [cr, cg, cb] = hexToRgb(color);

      // Colour accent bar
      doc.setFillColor(cr, cg, cb);
      doc.rect(cx, rowY, 2.5, rowH, 'F');

      // Tinted background
      doc.setFillColor(cr, cg, cb);
      doc.setGState(doc.GState({ opacity: 0.07 }));
      doc.rect(cx + 2.5, rowY, colWidth - 2.5, rowH, 'F');
      doc.setGState(doc.GState({ opacity: 1 }));

      // Slot label
      const label = slot.label || slot.subjectName || fmtLabel(slot.activityType);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...SLATE9);
      const lines = doc.splitTextToSize(label, colWidth - 8);
      doc.text(lines[0] as string, cx + 5, rowY + 5.5);

      // Time
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`${slot.startTime} – ${slot.endTime}`, cx + 5, rowY + 10);

      // Teacher
      if (slot.teacherName && rowH > 14) {
        doc.setFontSize(5.5);
        doc.setTextColor(148, 163, 184);
        const tLines = doc.splitTextToSize(slot.teacherName, colWidth - 8);
        doc.text(tLines[0] as string, cx + 5, rowY + 14.5);
      }

      // Venue
      if (slot.venue?.name && rowH > 18) {
        doc.setFontSize(5);
        doc.setTextColor(203, 213, 225);
        doc.text(slot.venue.name, cx + 5, rowY + 18.5);
      }
    });
  });

  // ── LEGEND ────────────────────────────────────────────────────────────────
  const usedTypes = ACTIVITY_TYPES.filter((t) => slots.some((s) => s.activityType === t));
  const legendY   = PH - 13;
  doc.setFillColor(...SLATE50);
  doc.rect(0, legendY - 3, PW, 16, 'F');
  doc.setDrawColor(...SLATE2);
  doc.line(0, legendY - 3, PW, legendY - 3);

  let lx = M;
  usedTypes.forEach((t) => {
    const [cr, cg, cb] = hexToRgb(ACTIVITY_COLORS[t] ?? '#4338CA');
    doc.setFillColor(cr, cg, cb);
    doc.circle(lx + 2, legendY + 1.5, 2, 'F');
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...SLATE9);
    doc.text(fmtLabel(t), lx + 6, legendY + 3);
    lx += doc.getTextWidth(fmtLabel(t)) + 14;
  });

  // Footer right
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('Kilimanjaro Education Management System · Timetable Office', PW - M, legendY + 3, { align: 'right' });

  // ── Bottom accent line ────────────────────────────────────────────────────
  doc.setFillColor(...ACCENT);
  doc.rect(0, PH - 2, PW, 2, 'F');

  const filename = `Timetable_${sheet.name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
}

// ─── Print Page ───────────────────────────────────────────────────────────────

export function TimetablePrintPage() {
  const { id: sheetId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [generating, setGenerating] = React.useState(false);

  const { data: sheetData, isLoading } = useTimetableSheet(sheetId);
  const sheet = sheetData as TimetableSheet | undefined;
  const slots = (sheet?.slots ?? []) as TimetableSlot[];

  function slotsByDay(day: string) {
    return slots.filter((s) => s.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  function actColor(slot: TimetableSlot) {
    return slot.colorCode ?? ACTIVITY_COLORS[slot.activityType] ?? '#4338CA';
  }

  async function handleDownloadPdf() {
    if (!sheet) return;
    setGenerating(true);
    try {
      await generateTimetablePdf(sheet, slots);
    } finally {
      setGenerating(false);
    }
  }

  if (isLoading) return (
    <div className="flex h-60 items-center justify-center font-semibold text-slate-400">Loading…</div>
  );
  if (!sheet) return (
    <div className="flex h-60 items-center justify-center font-semibold text-rose-500">Sheet not found.</div>
  );

  const maxRows = Math.max(...DAYS.map((d) => slotsByDay(d).length), 1);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleDownloadPdf} disabled={generating}>
          <Printer className="mr-1.5 h-4 w-4" />
          {generating ? 'Generating PDF…' : 'Download PDF'}
        </Button>
        <Button variant="ghost" onClick={() => navigate(`/admin/timetable/builder/${sheetId}`)}>
          ← Back to Builder
        </Button>
        <span className="ml-auto text-xs font-semibold text-slate-400">
          {slots.length} slot{slots.length !== 1 ? 's' : ''} · {slots.filter((s) => s.activityType === 'LESSON').length} lessons
        </span>
      </div>

      {/* Preview card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">

        {/* Branded header */}
        <div className="relative overflow-hidden bg-[#1E1B4B] px-8 py-7">
          <div className="absolute left-0 top-0 h-full w-1.5 bg-[#4338CA]" />
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#312E81] opacity-40" />
          <div className="absolute -bottom-6 right-20 h-24 w-24 rounded-full bg-[#4338CA] opacity-20" />

          <div className="relative flex items-center gap-6">
            {/* Logo badge */}
            <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-600 shadow-lg">
              <span className="font-display text-xs font-black leading-none text-white">KEMS</span>
              <span className="mt-0.5 text-[8px] font-bold uppercase tracking-widest text-white/80">SCHOOL</span>
            </div>

            <div className="flex-1">
              <h1 className="font-display text-2xl font-black tracking-tight text-white">
                KILIMANJARO EDUCATION MANAGEMENT
              </h1>
              <p className="mt-1 text-sm font-semibold text-sky-300">
                Excellence in Education · Discipline · Knowledge · Service
              </p>
            </div>

            <div className="shrink-0 text-right">
              <p className="font-display text-lg font-black text-sky-300">OFFICIAL TIMETABLE</p>
              <p className="mt-1 text-xs font-semibold text-white/50">
                {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        </div>

        {/* Meta strip */}
        <div className="grid grid-cols-3 gap-px bg-slate-200 sm:grid-cols-6">
          {[
            { label: 'Timetable', value: sheet.name },
            { label: 'Class',     value: sheet.className ?? '—' },
            { label: 'Stage',     value: sheet.stage ? fmtLabel(sheet.stage) : '—' },
            { label: 'Type',      value: fmtLabel(sheet.timetableType) },
            { label: 'Lessons',   value: `${slots.filter((s) => s.activityType === 'LESSON').length} periods` },
            { label: 'Status',    value: sheet.isPublished ? 'Published' : 'Draft' },
          ].map((m) => (
            <div key={m.label} className="bg-slate-50 px-4 py-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-indigo-500">{m.label}</p>
              <p className="mt-0.5 text-sm font-black text-slate-900">{m.value}</p>
            </div>
          ))}
        </div>

        {/* Week grid */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: 700 }}>
            <thead>
              <tr>
                {DAYS.map((day) => (
                  <th key={day}
                    className="border border-slate-300 bg-[#312E81] px-3 py-3 text-center font-display text-xs font-black uppercase tracking-widest text-white">
                    {fmtLabel(day)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: maxRows }, (_, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                  {DAYS.map((day) => {
                    const s = slotsByDay(day)[ri];
                    return (
                      <td key={day} className="border border-slate-200 p-1.5 align-top" style={{ minWidth: 130 }}>
                        {s ? (
                          <div
                            className="rounded-lg p-2.5"
                            style={{
                              borderLeft: `4px solid ${actColor(s)}`,
                              background: actColor(s) + '12',
                            }}
                          >
                            <p className="text-xs font-black leading-snug text-slate-900">
                              {s.label || s.subjectName || fmtLabel(s.activityType)}
                            </p>
                            <p className="mt-1 text-[10px] font-bold text-slate-500">
                              {s.startTime} – {s.endTime}
                            </p>
                            {s.teacherName && (
                              <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-400">{s.teacherName}</p>
                            )}
                            {s.venue?.name && (
                              <p className="truncate text-[9px] text-slate-300">{s.venue.name}</p>
                            )}
                          </div>
                        ) : (
                          <div className="h-full min-h-[60px]" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 border-t border-slate-100 bg-white px-6 py-4">
          {ACTIVITY_TYPES.filter((t) => slots.some((s) => s.activityType === t)).map((t) => (
            <span key={t} className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
              <span className="h-2.5 w-2.5 rounded-full shadow-sm" style={{ background: ACTIVITY_COLORS[t] }} />
              {fmtLabel(t)}
            </span>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-8 py-3.5">
          <p className="text-[10px] font-semibold text-slate-400">Kilimanjaro Education Management System · Timetable Office</p>
          <p className={`text-[10px] font-black ${sheet.isPublished ? 'text-emerald-600' : 'text-amber-500'}`}>
            {sheet.isPublished ? '✓ OFFICIAL — Published' : '⚠ DRAFT — Not for distribution'}
          </p>
        </div>

        {/* Bottom accent */}
        <div className="h-1.5 bg-gradient-to-r from-[#1E1B4B] via-[#4338CA] to-sky-400" />
      </div>
    </div>
  );
}
