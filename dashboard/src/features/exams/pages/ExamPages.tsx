import { Fragment, useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, Download, FileSpreadsheet, FileText, Layers, Lock,
  PlayCircle, Plus, RefreshCw, Send, Unlock, Upload, XCircle,
} from 'lucide-react';
import { Button } from '../../../components/common/Button';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorState } from '../../../components/common/ErrorState';
import { WorkspaceHeader } from '../../../components/layout/WorkspaceHeader';
import { formatClassLabel } from '../../../lib/classLabel';
import {
  downloadMarksTemplateCsv, downloadMeritExport,
  useAddExamWindowClasses, useComposeReportCards, useCreateEditRequest, useCreateExamType, useCreateExamWindow,
  useDecideEditRequest, useDeleteExamType, useEditRequests, useExamReference,
  useExamTypes, useExamWindow, useExamWindows, useExcludeExamWindowClasses, useMarksTemplate, useMeritList,
  useMigrateExamTypes, useSubmitAssessment, useTeacherExamWindows,
  usePreviewExamWindowClassExclusion, useUpdateExamWindow, useUploadMarks, useWindowAction,
} from '../api/examHooks';
import { useWindowReadiness } from '../api/readinessHooks';
import { ExemptionsPanel, ReadinessPanel } from './ExamReadiness';
import { WindowPlanPanel } from './ExamWindowPlan';
import { eligibleExamClasses, includedExamClassIds } from '../utils/examWindowClasses';

// ─── helpers ──────────────────────────────────────────────────────────────
const S = (v: unknown, d = '') => (v === null || v === undefined ? d : String(v));
const N = (v: unknown, d = 0) => (v === null || v === undefined || v === '' ? d : Number(v));

function statusTone(status: string): 'blue' | 'emerald' | 'amber' | 'rose' | 'slate' | 'gold' {
  switch (status) {
    case 'OPEN': return 'blue';
    case 'REOPENED': return 'amber';
    case 'CLOSED': return 'gold';
    case 'PUBLISHED': return 'emerald';
    case 'ARCHIVED': return 'slate';
    case 'GRANTED': return 'blue';
    case 'REJECTED': return 'rose';
    case 'COMPLETED': return 'amber';
    case 'REPUBLISHED': return 'emerald';
    case 'REQUESTED': return 'amber';
    default: return 'slate';
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-bold text-ks-navy">{label}</span>
      {children}
    </label>
  );
}
const inputCls = 'rounded-lg border border-ks-line px-3 py-2 text-sm focus:border-ks-blue focus:outline-none';

export function ExamTaskNavigation({ active }: { active: 'windows' | 'types' | 'composition' | 'performance' | 'requests' }) {
  const items = [
    { key: 'windows', to: '/exams', label: 'Exam windows' },
    { key: 'requests', to: '/exams/edit-requests', label: 'Edit requests' },
    { key: 'composition', to: '/exams/compose', label: 'Report-card composition' },
    { key: 'performance', to: '/exams/performance', label: 'Student lists & performance' },
    { key: 'types', to: '/exams/types', label: 'Exam types' },
  ] as const;
  return (
    <nav aria-label="Exam tasks" className="mb-5 flex flex-wrap gap-2 border-b border-ks-line pb-3">
      {items.map((item) => (
        <Link key={item.key} to={item.to} aria-current={active === item.key ? 'page' : undefined}
          className={`rounded-lg px-3 py-2 text-sm font-bold transition ${active === item.key ? 'bg-ks-blue text-white' : 'bg-ks-mist/30 text-ks-navy hover:bg-ks-mist/60'}`}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function Banner({ tone, children }: { tone: 'emerald' | 'rose' | 'amber'; children: React.ReactNode }) {
  const map = { emerald: 'bg-ks-emerald/10 text-ks-emerald border-ks-emerald/30', rose: 'bg-ks-rose/10 text-ks-rose border-ks-rose/30', amber: 'bg-ks-amber/10 text-[#7a5200] border-ks-amber/30' };
  return <div className={`rounded-lg border px-4 py-3 text-sm font-semibold ${map[tone]}`}>{children}</div>;
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN: Exam Windows list + create
// ═══════════════════════════════════════════════════════════════════════════
export function ExamWindowsListPage() {
  const [status, setStatus] = useState('');
  const windows = useExamWindows({ status: status || undefined });
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div>
      <WorkspaceHeader
        title="Exam Windows"
        description="Open an exam across chosen classes, track marks entry, compute the merit list, and publish."
        action={
          <div className="flex gap-2">
            <Link to="/exams/types"><Button variant="secondary"><Layers className="h-4 w-4" /> Exam Types</Button></Link>
            <Link to="/exams/compose"><Button variant="secondary"><FileText className="h-4 w-4" /> Compose Report Cards</Button></Link>
            <Button onClick={() => setShowCreate((v) => !v)}><Plus className="h-4 w-4" /> New Window</Button>
          </div>
        }
      />
      <ExamTaskNavigation active="windows" />

      {showCreate && <CreateWindowForm onDone={() => setShowCreate(false)} />}

      <div className="mb-4 flex gap-2">
        {['', 'DRAFT', 'OPEN', 'REOPENED', 'CLOSED', 'PUBLISHED', 'ARCHIVED'].map((s) => (
          <button key={s} onClick={() => setStatus(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold ${status === s ? 'bg-ks-blue text-white' : 'bg-ks-mist/30 text-ks-navy'}`}>
            {s ? s.charAt(0) + s.slice(1).toLowerCase() : 'All'}
          </button>
        ))}
      </div>

      {windows.isError && <ErrorState title="Could not load windows" message={S((windows.error as any)?.message, 'Try again')} onRetry={() => windows.refetch()} />}
      {windows.isLoading && <Card className="p-8 text-center text-ks-muted">Loading…</Card>}
      {windows.data && windows.data.length === 0 && <EmptyState title="No exam windows yet" message="Create your first exam window to begin the exam cycle." />}

      {windows.data && windows.data.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ks-paper text-left text-[11px] uppercase tracking-wider text-ks-muted">
                <tr>
                  <th className="px-4 py-3">Window</th><th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th><th className="px-4 py-3">Progress</th>
                  <th className="px-4 py-3">Classes</th><th className="px-4 py-3">Marks due</th><th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ks-line">
                {windows.data.map((w) => {
                  const prog = (w.progress ?? {}) as Record<string, unknown>;
                  return (
                    <tr key={S(w.id)} className="hover:bg-ks-paper/50">
                      <td className="px-4 py-3 font-bold text-ks-navy">{S(w.name)}</td>
                      <td className="px-4 py-3">{S((w.examType as any)?.name)}</td>
                      <td className="px-4 py-3"><Badge tone={statusTone(S(w.status))}>{S(w.status)}</Badge></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-ks-mist/40">
                            <div className="h-full bg-ks-emerald" style={{ width: `${N(prog.percentLocked)}%` }} />
                          </div>
                          <span className="text-xs text-ks-muted">{N(prog.percentSubmitted)}% submitted · {N(prog.percentLocked)}% locked</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-ks-navy">{S(w.status) === 'DRAFT' ? scopeLabel(w) : `${N(w.classCount)} class${N(w.classCount) === 1 ? '' : 'es'}`}</td>
                      <td className={`px-4 py-3 text-xs ${w.closesAt && ['OPEN', 'REOPENED'].includes(S(w.status)) && new Date(S(w.closesAt)) < new Date() ? 'font-bold text-ks-rose' : 'text-ks-muted'}`}>{w.closesAt ? new Date(S(w.closesAt)).toLocaleDateString() : '—'}{w.closesAt && ['OPEN', 'REOPENED'].includes(S(w.status)) && new Date(S(w.closesAt)) < new Date() ? ' · overdue' : ''}</td>
                      <td className="px-4 py-3 text-right"><Link to={`/exams/${S(w.id)}`}><Button variant="ghost">{S(w.status) === 'DRAFT' ? 'Review & open →' : 'Manage →'}</Button></Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

/** "All classes", "Standards 3, 4" or "2 classes": what a window covers, readable before it has any marks sheets. */
function scopeLabel(w: Record<string, unknown>) {
  const type = S(w.scopeType);
  if (type === 'STANDARDS') return `Standards ${((w.scopeLevels ?? []) as number[]).join(', ')}`;
  if (type === 'STREAMS') { const n = ((w.scopeClassIds ?? []) as unknown[]).length; return `${n} class${n === 1 ? '' : 'es'}`; }
  return 'All classes';
}

function CreateWindowForm({ onDone }: { onDone: () => void }) {
  const ref = useExamReference();
  const types = useExamTypes();
  const create = useCreateExamWindow();
  const nav = useNavigate();
  const [form, setForm] = useState<Record<string, any>>({ scopeType: 'STANDARDS', openNow: false, maxScore: 100 });
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const terms = (ref.data?.terms ?? []).filter((t: any) => !form.academicYearId || t.academicYearId === form.academicYearId);
  const classesForStreams = (ref.data?.classes ?? []).filter((c: any) =>
    (!form.academicYearId || c.academicYearId === form.academicYearId)
    && (!form.educationStage || c.educationStage === form.educationStage),
  );
  const levels = [...new Set(classesForStreams.map((c: any) => c.level).filter((l: any) => l != null))].sort((a: any, b: any) => a - b);

  const submit = async () => {
    const body: Record<string, unknown> = {
      examTypeId: form.examTypeId, name: form.name, academicYearId: form.academicYearId, termId: form.termId,
      educationStage: form.educationStage || undefined, scopeType: form.scopeType,
      maxScore: N(form.maxScore, 100), openNow: !!form.openNow,
      instructions: form.instructions?.trim() || undefined,
      opensAt: form.opensAt ? new Date(form.opensAt).toISOString() : undefined,
      closesAt: form.closesAt ? new Date(form.closesAt).toISOString() : undefined,
    };
    if (form.scopeType === 'STANDARDS') body.scopeLevels = (form.scopeLevels ?? []).map(Number);
    if (form.scopeType === 'STREAMS') body.scopeClassIds = form.scopeClassIds ?? [];
    const res = await create.mutateAsync(body);
    onDone();
    const id = (res as any)?.id;
    if (id) nav(`/exams/${id}`);
  };

  const canSubmit = form.examTypeId && form.name && form.academicYearId && form.termId &&
    (form.scopeType !== 'STANDARDS' || (form.scopeLevels ?? []).length) &&
    (form.scopeType !== 'STREAMS' || (form.scopeClassIds ?? []).length);

  return (
    <Card className="mb-6 p-5">
      <h3 className="mb-4 font-display text-lg font-bold text-ks-navy">New Exam Window</h3>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Exam type">
          <select className={inputCls} value={form.examTypeId ?? ''} onChange={(e) => set('examTypeId', e.target.value)}>
            <option value="">Select type…</option>
            {(types.data ?? []).map((t) => <option key={S(t.id)} value={S(t.id)}>{S(t.name)}{t.defaultWeight != null ? ` (${N(t.defaultWeight)}%)` : ''}</option>)}
          </select>
        </Field>
        <Field label="Window name"><input className={inputCls} placeholder="e.g. Terminal Exam" value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Max score per subject"><input className={inputCls} type="number" value={form.maxScore ?? 100} onChange={(e) => set('maxScore', e.target.value)} /></Field>
        <Field label="Academic year">
          <select className={inputCls} value={form.academicYearId ?? ''} onChange={(e) => setForm((current) => ({ ...current, academicYearId: e.target.value, termId: '', scopeLevels: [], scopeClassIds: [] }))}>
            <option value="">Select year…</option>
            {(ref.data?.years ?? []).map((y: any) => <option key={S(y.id)} value={S(y.id)}>{S(y.name)}</option>)}
          </select>
        </Field>
        <Field label="Term">
          <select className={inputCls} value={form.termId ?? ''} onChange={(e) => set('termId', e.target.value)}>
            <option value="">Select term…</option>
            {terms.map((t: any) => <option key={S(t.id)} value={S(t.id)}>{S(t.name)}</option>)}
          </select>
        </Field>
        <Field label="Stage (optional filter)">
          <select className={inputCls} value={form.educationStage ?? ''} onChange={(e) => setForm((current) => ({ ...current, educationStage: e.target.value, scopeLevels: [], scopeClassIds: [] }))}>
            <option value="">All stages</option>
            {['NURSERY', 'PRIMARY', 'O_LEVEL', 'A_LEVEL'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Scope">
          <select className={inputCls} value={form.scopeType} onChange={(e) => set('scopeType', e.target.value)}>
            <option value="ALL_CLASSES">All classes</option>
            <option value="STANDARDS">Selected standards (levels)</option>
            <option value="STREAMS">Selected streams (classes)</option>
          </select>
        </Field>
        {form.scopeType === 'STANDARDS' && (
          <Field label="Standards (levels)">
            <div className="flex flex-wrap gap-2">
              {levels.map((lv: any) => {
                const on = (form.scopeLevels ?? []).includes(lv);
                return <button type="button" key={lv} onClick={() => set('scopeLevels', on ? (form.scopeLevels ?? []).filter((x: any) => x !== lv) : [...(form.scopeLevels ?? []), lv])}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold ${on ? 'bg-ks-blue text-white' : 'bg-ks-mist/30 text-ks-navy'}`}>L{lv}</button>;
              })}
            </div>
          </Field>
        )}
        {form.scopeType === 'STREAMS' && (
          <Field label="Classes">
            <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto">
              {classesForStreams.map((c: any) => {
                const on = (form.scopeClassIds ?? []).includes(c.id);
                return <button type="button" key={S(c.id)} onClick={() => set('scopeClassIds', on ? (form.scopeClassIds ?? []).filter((x: any) => x !== c.id) : [...(form.scopeClassIds ?? []), c.id])}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold ${on ? 'bg-ks-blue text-white' : 'bg-ks-mist/30 text-ks-navy'}`}>{formatClassLabel(S(c.name), c.stream)}</button>;
              })}
            </div>
          </Field>
        )}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Field label="Marks open from (optional)"><input className={inputCls} type="datetime-local" value={form.opensAt ?? ''} onChange={(e) => set('opensAt', e.target.value)} /></Field>
        <Field label="Marks due by (optional)"><input className={inputCls} type="datetime-local" value={form.closesAt ?? ''} onChange={(e) => set('closesAt', e.target.value)} /></Field>
        <Field label="Instructions for teachers (optional)"><input className={inputCls} value={form.instructions ?? ''} onChange={(e) => set('instructions', e.target.value)} placeholder="e.g. Mark absent students as Absent" /></Field>
      </div>
      <label className="mt-4 flex items-start gap-2 text-sm font-semibold text-ks-navy">
        <input className="mt-1" type="checkbox" checked={!!form.openNow} onChange={(e) => set('openNow', e.target.checked)} />
        <span>Open straight away<span className="block text-xs font-normal text-ks-muted">Leave this off to review the subjects and teachers first, leave out anything that should not be examined, then open it.</span></span>
      </label>
      {create.isError && <div className="mt-3"><Banner tone="rose">{S((create.error as any)?.message, 'Could not create window')}</Banner></div>}
      <div className="mt-4 flex gap-2">
        <Button onClick={submit} loading={create.isPending} disabled={!canSubmit}>{form.openNow ? 'Create and open' : 'Create and review subjects'}</Button>
        <Button variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN: Exam Window detail (lifecycle + merit list + exports + edit requests)
// ═══════════════════════════════════════════════════════════════════════════
export function ExamWindowDetailPage() {
  const { id = '' } = useParams();
  const win = useExamWindow(id);
  const reference = useExamReference();
  const action = useWindowAction();
  const nav = useNavigate();
  const [tab, setTab] = useState<'overview' | 'readiness' | 'merit' | 'exemptions' | 'edits'>('overview');
  const [msg, setMsg] = useState<string>('');
  const [reopenReason, setReopenReason] = useState('');
  const [showReopen, setShowReopen] = useState(false);
  const [exemptSeed, setExemptSeed] = useState<{ classId: string; subjectId: string; studentId: string } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showClasses, setShowClasses] = useState(false);

  const w = win.data;
  const status = S(w?.status);
  const entryOpen = status === 'OPEN' || status === 'REOPENED';
  const readiness = useWindowReadiness(id, entryOpen);
  const notReady = entryOpen && readiness.data ? !readiness.data.canClose : false;
  const academicYear = (reference.data?.years ?? []).find((year) => S(year.id) === S(w?.academicYearId));
  const term = (reference.data?.terms ?? []).find((item) => S(item.id) === S(w?.termId));

  const runAction = async (act: string, body?: Record<string, unknown>) => {
    setMsg('');
    try {
      const res: any = await action.mutateAsync({ id, action: act, body });
      if (act === 'close') setMsg(`Closed & calculated ${N(res?.computed)} students${N(res?.exemptSubjects) ? ` (${N(res.exemptSubjects)} exempt subject result${N(res.exemptSubjects) === 1 ? '' : 's'})` : ''}${N(res?.ungraded) ? `, ${N(res.ungraded)} ungraded (too few eligible subjects)` : ''}.`);
      else if (act === 'republish') setMsg(`Recalculated, closed and published again to ${N(res?.published?.students)} students.`);
      else if (act === 'reopen') { setMsg(`Window reopened${res?.wasPublished ? ' and results unpublished' : ''}. Teachers and admins can now correct marks. When done, use "Close & republish".`); setShowReopen(false); setReopenReason(''); }
      else if (act === 'compute') setMsg(`Recalculated ${N(res?.computed)} students${N(res?.exemptSubjects) ? ` · ${N(res.exemptSubjects)} exempt subject result${N(res.exemptSubjects) === 1 ? '' : 's'}` : ''}.`);
      else if (act === 'publish') setMsg(`Published to ${N(res?.students)} students. Downstream snapshots: ${N(res?.downstream?.snapshots)}.`);
      else if (act === 'archive') { nav('/exams'); return; }
      else if (act === 'open') setMsg(`Opened: ${N(res?.assessmentsCreated)} marks sheet(s) created across ${N(res?.classesCovered)} class(es)${N(res?.omitted) ? `, ${N(res.omitted)} subject(s) left out` : ''}. Teachers can start entering marks.`);
      else setMsg(`${act} done.`);
    } catch (e: any) {
      setMsg(`${act} failed: ${e?.message ?? 'please try again'}`);
      if (act === 'close') setTab('readiness');
    }
  };

  if (win.isLoading) return <Card className="p-8 text-center text-ks-muted">Loading…</Card>;
  if (win.isError || !w) return <ErrorState title="Window not found" message={S((win.error as any)?.message, 'It may have been removed.')} onRetry={() => win.refetch()} />;

  return (
    <div>
      <Link to="/exams" className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-ks-blue"><ArrowLeft className="h-4 w-4" /> All windows</Link>
      <WorkspaceHeader
        title={S(w.name)}
        description={`${S((w.examType as any)?.name)} · ${S(academicYear?.name ?? academicYear?.year, 'Academic year unavailable')} · ${S(term?.name, 'Term unavailable')} · ${status === 'DRAFT' ? 'not opened yet' : `${N(w.assessmentCount)} marks sheets across ${N(w.classCount)} class${N(w.classCount) === 1 ? '' : 'es'}`}${w.closesAt ? ` · marks due ${new Date(S(w.closesAt)).toLocaleDateString()}` : ''}`}
        action={<Badge tone={statusTone(status)}>{status}</Badge>}
      />
      <ExamTaskNavigation active="windows" />

      {/* Lifecycle actions */}
      <Card className="mb-5 flex flex-wrap items-center gap-2 p-4">
        {(status === 'DRAFT' || status === 'REOPENED') && <Button onClick={() => runAction('open')} loading={action.isPending}><PlayCircle className="h-4 w-4" /> Open for entry</Button>}
        {(status === 'OPEN' || status === 'REOPENED') && <Button onClick={() => runAction('close')} loading={action.isPending} disabled={notReady} title={notReady ? 'Resolve the items on the Readiness tab first' : undefined}><Lock className="h-4 w-4" /> Close & calculate</Button>}
        {(status === 'CLOSED' || status === 'REOPENED') && <Button onClick={() => runAction('compute')} variant="secondary" loading={action.isPending}><RefreshCw className="h-4 w-4" /> Recalculate</Button>}
        {status === 'REOPENED' && <Button onClick={() => runAction('republish')} variant="success" loading={action.isPending} disabled={notReady} title={notReady ? 'Resolve the items on the Readiness tab first' : undefined}><CheckCircle2 className="h-4 w-4" /> Close & republish</Button>}
        {status === 'CLOSED' && <Button onClick={() => runAction('publish')} variant="success" loading={action.isPending}><CheckCircle2 className="h-4 w-4" /> Publish results</Button>}
        {(status === 'CLOSED' || status === 'PUBLISHED') && <Button onClick={() => setShowReopen((v) => !v)} variant="secondary"><Unlock className="h-4 w-4" /> Reopen for corrections</Button>}
        {status === 'PUBLISHED' && <Button onClick={() => runAction('unpublish')} variant="danger" loading={action.isPending}><Unlock className="h-4 w-4" /> Unpublish</Button>}
        {status !== 'ARCHIVED' && status !== 'PUBLISHED' && <Button onClick={() => setShowSettings((v) => !v)} variant="secondary">Settings</Button>}
        {status !== 'ARCHIVED' && <Button onClick={() => setShowClasses((v) => !v)} variant="secondary"><Plus className="h-4 w-4" /> Manage classes</Button>}
        {(status === 'DRAFT' || status === 'CLOSED') && <Button onClick={() => { if (window.confirm('Archive this exam window? It will be hidden from the list.')) void runAction('archive'); }} variant="ghost">Archive</Button>}
        <span className="ml-auto text-xs text-ks-muted">Lifecycle: DRAFT → OPEN → CLOSED → PUBLISHED</span>
      </Card>
      {showSettings && <WindowSettings w={w} status={status} onClose={() => setShowSettings(false)} onSaved={(m) => { setMsg(m); setShowSettings(false); }} />}
      {showClasses && <WindowClassesManager w={w} status={status} onClose={() => setShowClasses(false)} onAdded={(m) => setMsg(m)} />}
      {status === 'DRAFT' && <div className="mb-5"><Banner tone="amber">This exam is a draft. Teachers cannot see it yet. Check the subjects and teachers below, leave out anything that should not be examined, then press <b>Open for entry</b>.</Banner></div>}
      {showReopen && (
        <Card className="mb-5 p-4">
          <p className="mb-2 text-sm text-ks-muted">Marks are locked after closing. Reopening {status === 'PUBLISHED' ? 'unpublishes the results, ' : ''}unlocks every subject so corrections can be made, and is recorded in the audit trail. Afterwards use <b>Close &amp; republish</b>.</p>
          <Field label="Reason (required)">
            <input className={inputCls} value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} placeholder="e.g. Wrong mark entered for Mathematics, Standard 6 A" />
          </Field>
          <div className="mt-3 flex gap-2">
            <Button onClick={() => runAction('reopen', { reason: reopenReason })} loading={action.isPending} disabled={reopenReason.trim().length < 5}><Unlock className="h-4 w-4" /> Reopen window</Button>
            <Button variant="ghost" onClick={() => setShowReopen(false)}>Cancel</Button>
          </div>
        </Card>
      )}
      {msg && <div className="mb-5"><Banner tone={msg.toLowerCase().includes('fail') ? 'rose' : 'emerald'}><span className="whitespace-pre-line">{msg}</span></Banner></div>}
      {notReady && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-ks-rose/30 bg-ks-rose/5 px-4 py-3 text-sm" role="status">
          <span className="font-bold text-ks-rose">Not ready to close:</span>
          <span className="whitespace-pre-line text-ks-navy">{S(readiness.data?.blockers?.[0]?.message)}</span>
          <Button variant="secondary" className="ml-auto" onClick={() => setTab('readiness')}>Open readiness</Button>
        </div>
      )}

      <div className="mb-4 flex gap-2 border-b border-ks-line">
        {(['overview', 'readiness', 'merit', 'exemptions', 'edits'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-bold ${tab === t ? 'border-b-2 border-ks-blue text-ks-blue' : 'text-ks-muted'}`}>
            {t === 'overview' ? 'Subjects & teachers' : t === 'readiness' ? 'Readiness' : t === 'merit' ? 'Merit List' : t === 'exemptions' ? 'Exemptions' : 'Edit Requests'}
          </button>
        ))}
      </div>

      {tab === 'overview' && <WindowPlanPanel windowId={id} status={status} entry={Object.fromEntries(((w.assessments ?? []) as Record<string, any>[]).map((a) => [S(a.id), { ...(a.entry ?? {}), status: S(a.status) }]))} />}
      {tab === 'readiness' && (
        status === 'DRAFT'
          ? <EmptyState title="Window not open yet" message="Open the window to see which results are still missing." />
          : <ReadinessPanel windowId={id} status={status} onExempt={(seed) => { setExemptSeed(seed); setTab('exemptions'); }} />
      )}
      {tab === 'merit' && <MeritListPanel windowId={id} status={status} />}
      {tab === 'exemptions' && (
        <ExemptionsPanel key={exemptSeed ? `${exemptSeed.studentId}:${exemptSeed.subjectId}` : 'blank'} windowId={id} window={w} seed={exemptSeed} onChanged={(m) => { setMsg(m); setExemptSeed(null); }} />
      )}
      {tab === 'edits' && <EditRequestsPanel windowId={id} />}
    </div>
  );
}

function ProgressBar({ entered, required }: { entered: number; required: number }) {
  const pct = required ? Math.min(100, Math.round((entered / required) * 100)) : 0;
  const done = required > 0 && entered >= required;
  return (
    <div className="min-w-[120px]">
      <div className="h-2 overflow-hidden rounded-full bg-ks-mist/60"><div className={`h-full ${done ? 'bg-ks-emerald' : 'bg-ks-blue'}`} style={{ width: `${pct}%` }} /></div>
      <div className="mt-1 text-[11px] font-semibold text-ks-muted">{entered}/{required} entered</div>
    </div>
  );
}

function WindowSettings({ w, status, onClose, onSaved }: { w: Record<string, any>; status: string; onClose: () => void; onSaved: (m: string) => void }) {
  const update = useUpdateExamWindow(S(w.id));
  const ref = useExamReference();
  const local = (iso: unknown) => (iso ? new Date(S(iso)).toISOString().slice(0, 16) : '');
  const [f, setF] = useState<Record<string, any>>({
    name: S(w.name), maxScore: N(w.maxScore, 100), weight: N(w.weight, 100), countsToReportCard: w.countsToReportCard !== false,
    opensAt: local(w.opensAt), closesAt: local(w.closesAt), instructions: S(w.instructions),
    scopeType: S(w.scopeType, 'ALL_CLASSES'), scopeLevels: (w.scopeLevels ?? []) as number[], scopeClassIds: (w.scopeClassIds ?? []) as string[], educationStage: S(w.educationStage),
  });
  const [err, setErr] = useState('');
  const set = (k: string, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  const draft = status === 'DRAFT';
  const eligibleClasses = eligibleExamClasses((ref.data?.classes ?? []) as Record<string, unknown>[], w);
  const levels = [...new Set(eligibleClasses.map((c: any) => c.level).filter((l: any) => l != null))].sort((x: any, y: any) => x - y);
  const toggle = (key: 'scopeLevels' | 'scopeClassIds', v: any) => set(key, (f[key] as any[]).includes(v) ? (f[key] as any[]).filter((x) => x !== v) : [...(f[key] as any[]), v]);
  const save = async () => {
    setErr('');
    const body: Record<string, unknown> = {
      name: f.name, maxScore: N(f.maxScore, 100), weight: N(f.weight, 100), countsToReportCard: !!f.countsToReportCard, instructions: f.instructions,
      opensAt: f.opensAt ? new Date(f.opensAt).toISOString() : undefined, closesAt: f.closesAt ? new Date(f.closesAt).toISOString() : undefined,
    };
    if (draft) { body.scopeType = f.scopeType; body.educationStage = f.educationStage || undefined; if (f.scopeType === 'STANDARDS') body.scopeLevels = f.scopeLevels; if (f.scopeType === 'STREAMS') body.scopeClassIds = f.scopeClassIds; }
    try { await update.mutateAsync(body); onSaved('Exam settings saved.'); } catch (e: any) { setErr(S(e?.message, 'Could not save the settings')); }
  };
  return (
    <Card className="mb-5 p-5">
      <h3 className="mb-3 font-display text-lg font-bold text-ks-navy">Exam settings</h3>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Name"><input className={inputCls} value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <Field label="Max score per subject"><input className={inputCls} type="number" value={f.maxScore} disabled={status === 'CLOSED'} onChange={(e) => set('maxScore', e.target.value)} /></Field>
        <Field label="Report-card weight %"><input className={inputCls} type="number" value={f.weight} onChange={(e) => set('weight', e.target.value)} /></Field>
        <Field label="Marks open from"><input className={inputCls} type="datetime-local" value={f.opensAt} onChange={(e) => set('opensAt', e.target.value)} /></Field>
        <Field label="Marks due by"><input className={inputCls} type="datetime-local" value={f.closesAt} onChange={(e) => set('closesAt', e.target.value)} /></Field>
        <Field label="Instructions for teachers"><input className={inputCls} value={f.instructions} onChange={(e) => set('instructions', e.target.value)} /></Field>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-ks-navy"><input type="checkbox" checked={f.countsToReportCard} onChange={(e) => set('countsToReportCard', e.target.checked)} /> Counts towards the term report card</label>
      {draft ? (
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Field label="Which classes">
            <select className={inputCls} value={f.scopeType} onChange={(e) => set('scopeType', e.target.value)}>
              <option value="ALL_CLASSES">All classes</option><option value="STANDARDS">Selected standards (levels)</option><option value="STREAMS">Selected classes</option>
            </select>
          </Field>
          {f.scopeType === 'STANDARDS' && <Field label="Standards"><div className="flex flex-wrap gap-2">{levels.map((lv: any) => <button type="button" key={lv} onClick={() => toggle('scopeLevels', lv)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${f.scopeLevels.includes(lv) ? 'bg-ks-blue text-white' : 'bg-ks-mist/30 text-ks-navy'}`}>L{lv}</button>)}</div></Field>}
          {f.scopeType === 'STREAMS' && <Field label="Classes"><div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto">{eligibleClasses.map((c: any) => <button type="button" key={S(c.id)} onClick={() => toggle('scopeClassIds', c.id)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${f.scopeClassIds.includes(c.id) ? 'bg-ks-blue text-white' : 'bg-ks-mist/30 text-ks-navy'}`}>{formatClassLabel(S(c.name), c.stream)}</button>)}</div></Field>}
        </div>
      ) : <p className="mt-3 text-xs text-ks-muted">Which classes the exam covers is fixed once it opens. To leave a subject or class out, use the Subjects &amp; teachers tab.{status !== 'CLOSED' ? ' Changing the maximum score updates every marks sheet that is not locked.' : ' Reopen the window to change the maximum score.'}</p>}
      {err && <div className="mt-3"><Banner tone="rose">{err}</Banner></div>}
      <div className="mt-4 flex gap-2"><Button onClick={save} loading={update.isPending} disabled={!f.name.trim()}>Save settings</Button><Button variant="ghost" onClick={onClose}>Cancel</Button></div>
    </Card>
  );
}

function WindowClassesManager({ w, status, onClose, onAdded }: { w: Record<string, any>; status: string; onClose: () => void; onAdded: (message: string) => void }) {
  const ref = useExamReference();
  const addClasses = useAddExamWindowClasses(S(w.id));
  const previewExclusion = usePreviewExamWindowClassExclusion(S(w.id));
  const excludeClasses = useExcludeExamWindowClasses(S(w.id));
  const [selectedToAdd, setSelectedToAdd] = useState<string[]>([]);
  const [selectedToExclude, setSelectedToExclude] = useState<string[]>([]);
  const [impact, setImpact] = useState<Awaited<ReturnType<typeof previewExclusion.mutateAsync>> | null>(null);
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [discardMarks, setDiscardMarks] = useState(false);
  const [err, setErr] = useState('');
  const canChange = ['DRAFT', 'OPEN', 'REOPENED'].includes(status);
  const eligible = eligibleExamClasses((ref.data?.classes ?? []) as Record<string, unknown>[], w);
  const included = includedExamClassIds(eligible, w);
  const available = eligible.filter((item) => !included.has(S(item.id)));
  const resetImpact = () => {
    setImpact(null);
    setReason('');
    setConfirmation('');
    setDiscardMarks(false);
  };
  const toggle = (classId: string, isIncluded: boolean) => {
    setErr('');
    if (isIncluded) {
      resetImpact();
      setSelectedToExclude((current) => current.includes(classId) ? current.filter((id) => id !== classId) : [...current, classId]);
      return;
    }
    setSelectedToAdd((current) => current.includes(classId) ? current.filter((id) => id !== classId) : [...current, classId]);
  };

  const add = async () => {
    setErr('');
    try {
      const result = await addClasses.mutateAsync(selectedToAdd) as Record<string, unknown>;
      setSelectedToAdd([]);
      onAdded(S(result.message, `${N(result.addedClasses)} class(es) added to the exam window.`));
    } catch (error: any) {
      setErr(S(error?.message, 'Could not add the selected classes.'));
    }
  };

  const reviewExclusion = async () => {
    setErr('');
    try {
      setImpact(await previewExclusion.mutateAsync(selectedToExclude));
      setReason('');
      setConfirmation('');
      setDiscardMarks(false);
    } catch (error: any) {
      setErr(S(error?.message, 'Could not review the selected classes.'));
    }
  };

  const exclude = async () => {
    if (!impact) return;
    setErr('');
    try {
      const result = await excludeClasses.mutateAsync({
        classIds: impact.classIds,
        reason: reason.trim(),
        discardMarks: impact.requiresDiscardConfirmation ? discardMarks : false,
      }) as Record<string, unknown>;
      setSelectedToExclude([]);
      resetImpact();
      onAdded(S(result.message, `${N(result.excludedClasses)} class(es) excluded from the exam window.`));
    } catch (error: any) {
      setErr(S(error?.message, 'Could not exclude the selected classes. Review the impact again.'));
    }
  };

  return (
    <Card className="mb-5 p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-ks-navy">Manage exam classes</h3>
          <p className="mt-1 text-sm text-ks-muted">Add classes that sat this exam, or select included classes to leave them out. Excluding never deletes the school class, students or accounts.</p>
        </div>
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>
      {ref.isLoading && <p className="text-sm text-ks-muted">Loading classes...</p>}
      {ref.isError && <ErrorState title="Could not load classes" message={S((ref.error as any)?.message, 'Refresh and try again.')} onRetry={() => ref.refetch()} />}
      {!canChange && <Banner tone="amber">Reopen this window before changing its classes. Closed or published results must not change silently.</Banner>}
      {!ref.isLoading && !ref.isError && (
        <>
          <div className="mb-3 flex flex-wrap gap-2 text-xs font-bold">
            <span className="rounded-lg bg-ks-emerald/10 px-3 py-1.5 text-ks-emerald">{included.size} included</span>
            <span className="rounded-lg bg-ks-mist/40 px-3 py-1.5 text-ks-navy">{available.length} available</span>
          </div>
          <div className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
            {eligible.map((item: any) => {
              const classId = S(item.id);
              const isIncluded = included.has(classId);
              const isSelected = isIncluded ? selectedToExclude.includes(classId) : selectedToAdd.includes(classId);
              return (
                <button type="button" key={classId} disabled={!canChange} onClick={() => toggle(classId, isIncluded)}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm font-bold transition ${isIncluded && isSelected ? 'border-ks-rose bg-ks-rose/10 text-ks-rose' : isIncluded ? 'border-ks-emerald/30 bg-ks-emerald/5 text-ks-emerald hover:border-ks-rose/60' : isSelected ? 'border-ks-blue bg-ks-blue text-white' : 'border-ks-line bg-white text-ks-navy hover:border-ks-blue'}`}>
                  <span>{formatClassLabel(S(item.name), item.stream)}</span>
                  <span className={`ml-2 text-[11px] ${!isIncluded && isSelected ? 'text-white/80' : 'text-ks-muted'}`}>{isIncluded ? (isSelected ? 'Leave out' : 'Included') : `${N(item.studentCount)} students`}</span>
                </button>
              );
            })}
          </div>
          {!eligible.length && <EmptyState title="No eligible classes" message="No classes match this exam's school, academic year and stage." />}
          {!!eligible.length && !available.length && <p className="mt-3 text-sm font-semibold text-ks-emerald">All eligible classes are already included.</p>}
          {!!selectedToAdd.length && <div className="mt-4 rounded-lg border border-ks-blue/20 bg-ks-blue/5 px-4 py-3 text-sm text-ks-navy">This will add <b>{selectedToAdd.length}</b> class{selectedToAdd.length === 1 ? '' : 'es'}. Existing marks will not be changed or removed.</div>}
          {!!selectedToExclude.length && !impact && <div className="mt-4 rounded-lg border border-ks-amber/30 bg-ks-amber/10 px-4 py-3 text-sm text-[#6b4b00]">
            <b>{selectedToExclude.length}</b> included class{selectedToExclude.length === 1 ? '' : 'es'} selected to leave out. Review the exact marks sheets, entered marks and calculated results before confirming.
          </div>}
          {impact && <div className="mt-4 space-y-4 rounded-lg border border-ks-rose/30 bg-ks-rose/5 p-4">
            <div>
              <h4 className="font-bold text-ks-navy">Final exclusion review</h4>
              <p className="mt-1 text-sm text-ks-muted">Classes: {impact.classes.map((item) => formatClassLabel(item.name, item.stream)).join(', ')}</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg bg-white p-3"><div className="text-xs text-ks-muted">Marks sheets removed</div><div className="text-xl font-bold text-ks-navy">{impact.marksSheets}</div></div>
              <div className="rounded-lg bg-white p-3"><div className="text-xs text-ks-muted">Entered marks removed</div><div className="text-xl font-bold text-ks-rose">{impact.marksEntered}</div></div>
              <div className="rounded-lg bg-white p-3"><div className="text-xs text-ks-muted">Calculated results removed</div><div className="text-xl font-bold text-ks-navy">{impact.calculatedResults}</div></div>
            </div>
            <Banner tone="amber">Only this exam window changes. The classes, enrolments, students, guardians and login accounts remain unchanged. The class can be added back later.</Banner>
            <Field label="Reason for leaving these classes out"><input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Example: Class did not sit this exam" /></Field>
            {impact.requiresDiscardConfirmation && <label className="flex items-start gap-2 text-sm font-semibold text-ks-rose"><input className="mt-1" type="checkbox" checked={discardMarks} onChange={(e) => setDiscardMarks(e.target.checked)} /> I understand that {impact.marksEntered} entered mark{impact.marksEntered === 1 ? '' : 's'} will be permanently removed from this exam.</label>}
            <Field label={`Type ${impact.confirmationText} to confirm`}><input className={inputCls} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} /></Field>
            <div className="flex flex-wrap gap-2">
              <Button variant="danger" onClick={exclude} loading={excludeClasses.isPending} disabled={reason.trim().length < 3 || confirmation !== impact.confirmationText || (impact.requiresDiscardConfirmation && !discardMarks)}><XCircle className="h-4 w-4" /> Exclude from this exam</Button>
              <Button variant="ghost" onClick={() => { resetImpact(); setSelectedToExclude([]); }}>Cancel exclusion</Button>
            </div>
          </div>}
          {err && <div className="mt-3"><Banner tone="rose">{err}</Banner></div>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={add} loading={addClasses.isPending} disabled={!canChange || !selectedToAdd.length}><Plus className="h-4 w-4" /> Add selected classes</Button>
            <Button variant="secondary" onClick={reviewExclusion} loading={previewExclusion.isPending} disabled={!canChange || !selectedToExclude.length || !!impact}><XCircle className="h-4 w-4" /> Review class exclusion</Button>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
          </div>
        </>
      )}
    </Card>
  );
}

function MeritListPanel({ windowId, status }: { windowId: string; status: string }) {
  const merit = useMeritList(windowId);
  const [dl, setDl] = useState('');
  const m = merit.data as any;

  const doExport = async (fmt: 'xlsx' | 'pdf' | 'csv') => {
    setDl(fmt);
    try { await downloadMeritExport(windowId, fmt); } catch (e: any) { /* surfaced below */ } finally { setDl(''); }
  };

  if (status === 'DRAFT' || status === 'OPEN') return <EmptyState title="Merit list not ready" message="Close the window to compute the merit list." />;
  if (merit.isLoading) return <Card className="p-8 text-center text-ks-muted">Computing view…</Card>;
  if (merit.isError) return <ErrorState title="Could not load merit list" message={S((merit.error as any)?.message)} onRetry={() => merit.refetch()} />;
  const subjects = (m?.subjects ?? []) as any[];
  const rows = (m?.rows ?? []) as any[];
  const showCombination = rows.some((row) => S(row.educationStage) === 'A_LEVEL');
  if (!rows.length) return <EmptyState title="No results" message="No computed results for this window yet." />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => doExport('xlsx')} loading={dl === 'xlsx'}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
        <Button variant="secondary" onClick={() => doExport('pdf')} loading={dl === 'pdf'}><FileText className="h-4 w-4" /> PDF</Button>
        <Button variant="secondary" onClick={() => doExport('csv')} loading={dl === 'csv'}><Download className="h-4 w-4" /> CSV</Button>
        <span className="ml-auto self-center text-xs text-ks-muted">{rows.length} candidates</span>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-ks-navy text-left text-white">
              <tr>
                <th className="px-2 py-2">OVR</th><th className="px-2 py-2">STR</th><th className="px-2 py-2">ADMNO</th>
                <th className="px-2 py-2">Name</th><th className="px-2 py-2">Str</th>{showCombination && <th className="px-2 py-2 text-center">Comb</th>}
                {subjects.map((s) => <th key={s.subjectId} className="px-2 py-2 text-center" title={s.subjectName}>{S(s.code || s.subjectName).slice(0, 5)}</th>)}
                <th className="px-2 py-2 text-center">SBJ</th><th className="px-2 py-2 text-center">TOT</th>
                <th className="px-2 py-2 text-center">MN %</th><th className="px-2 py-2 text-center">DEV</th><th className="px-2 py-2 text-center">GR</th><th className="px-2 py-2 text-center">DIV</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ks-line">
              {rows.map((r) => {
                const scores = (r.subjectScores ?? {}) as Record<string, any>;
                const dev = r.prevWindowDelta ?? r.classMeanDev ?? 0;
                return (
                  <tr key={S(r.studentId)} className="hover:bg-ks-paper/50">
                    <td className="px-2 py-2 font-bold text-ks-navy">{N(r.standardRank)}</td>
                    <td className="px-2 py-2 text-ks-muted">{N(r.streamRank)}</td>
                    <td className="px-2 py-2">{S(r.registrationNumber)}</td>
                    <td className="px-2 py-2 font-semibold text-ks-navy">{S(r.studentName)}</td>
                    <td className="px-2 py-2">{S(r.stream)}</td>
                    {showCombination && <td className="px-2 py-2 text-center font-black text-ks-navy">{S(r.combinationCode, '—')}</td>}
                    {subjects.map((s) => {
                      const cell = scores[s.subjectId];
                      const exempt = cell?.status === 'EXEMPT';
                      const displayOnly = cell?.countsTowardAggregate === false;
                      const title = exempt
                        ? `Exempt: ${S(cell?.exemptReason)}`
                        : displayOnly
                          ? 'Shown for reference; excluded from total, average, rank and division'
                          : undefined;
                      return <td key={s.subjectId} className={`px-2 py-2 text-center ${exempt ? 'bg-ks-blue/10 font-bold text-ks-blue' : displayOnly ? 'bg-ks-paper text-ks-muted' : cell?.status === 'NOT_SAT' || cell?.isAbsent ? 'bg-ks-amber/15 text-[#7a5200]' : ''}`} title={title}>{cell ? (cell.missing ? '–' : exempt ? 'EXEMPT' : cell.status === 'NOT_SAT' ? 'NS' : cell.isAbsent ? 'ABS' : `${Math.round(N(cell.score))} ${S(cell.grade)}${displayOnly ? '*' : ''}`) : '·'}</td>;
                    })}
                    <td className="px-2 py-2 text-center" title="Subjects counted in the average of subjects expected">{N(r.subjectsAssessed ?? r.subjectCount)}{N(r.subjectsExpected) > N(r.subjectsAssessed ?? r.subjectCount) ? `/${N(r.subjectsExpected)}` : ''}</td>
                    <td className="px-2 py-2 text-center font-bold">{N(r.total)}</td>
                    <td className="px-2 py-2 text-center">{N(r.mean)}</td>
                    <td className={`px-2 py-2 text-center ${N(dev) < 0 ? 'text-ks-rose' : 'text-ks-emerald'}`}>{N(dev) > 0 ? '+' : ''}{Math.round(N(dev) * 10) / 10}</td>
                    <td className="px-2 py-2 text-center"><Badge tone={statusTone('')}>{S(r.overallGrade)}</Badge></td>
                    <td className="px-2 py-2 text-center text-[10px] font-bold text-ks-navy" title={S(r.divisionNote)}>{r.divisionPoints === null || r.divisionPoints === undefined ? S(r.division, '—').replace('Division ', 'Div ') : `${S(r.division, '—').replace('Division ', 'Div ')} - ${Number(r.divisionPoints).toFixed(Number(r.divisionPoints) % 1 === 0 ? 0 : 1)} pts`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <SummaryTables summaries={m?.summaries} gradeCodes={m?.gradeCodes ?? []} />
    </div>
  );
}

function SummaryTables({ summaries, gradeCodes }: { summaries: any; gradeCodes: string[] }) {
  if (!summaries) return null;
  const divisionKeys = ['Division I', 'Division II', 'Division III', 'Division IV', 'Division 0', 'Ungraded'];
  const section = (title: string, first: string, recs: any[]) => (
    <Card className="overflow-hidden">
      <div className="border-b border-ks-line bg-ks-paper px-4 py-2 text-sm font-bold text-ks-navy">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-left text-ks-muted"><tr>
            <th className="px-3 py-2">{first}</th>{gradeCodes.map((g) => <th key={g} className="px-2 py-2 text-center">{g}</th>)}
            <th className="px-2 py-2 text-center">Entries</th><th className="px-2 py-2 text-center">Mean</th>
            <th className="px-2 py-2 text-center">High</th><th className="px-2 py-2 text-center">Low</th><th className="px-2 py-2 text-center">Pass %</th>
          </tr></thead>
          <tbody className="divide-y divide-ks-line">
            {recs.map((rec, i) => (
              <tr key={i}>
                <td className="px-3 py-2 font-semibold text-ks-navy">{S(rec.className ? formatClassLabel(rec.className, rec.stream) : rec.subjectName ?? rec.gender)}</td>
                {gradeCodes.map((g) => <td key={g} className="px-2 py-2 text-center">{N((rec.distribution ?? {})[g])}</td>)}
                <td className="px-2 py-2 text-center">{N(rec.entries)}</td><td className="px-2 py-2 text-center">{N(rec.meanMarks)}</td>
                <td className="px-2 py-2 text-center">{N(rec.highestMarks)}</td><td className="px-2 py-2 text-center">{N(rec.lowestMarks)}</td>
                <td className="px-2 py-2 text-center font-bold">{N(rec.passRate)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
  const divisionRows = (summaries.byStream ?? []).filter((row: any) => ['O_LEVEL', 'A_LEVEL'].includes(S(row.educationStage)));
  const overall = summaries.overall;
  return (
    <div className="space-y-4">
      {overall && <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[['Students', overall.entries], ['Classes', overall.classes], ['Mean', overall.meanMarks], ['Highest', overall.highestMarks], ['Lowest', overall.lowestMarks], ['Pass rate', `${N(overall.passRate)}%`]].map(([label, value]) => (
            <div key={String(label)}><p className="text-[10px] font-bold uppercase tracking-wide text-ks-muted">{label}</p><p className="mt-1 text-xl font-black text-ks-navy">{value}</p></div>
          ))}
        </div>
      </Card>}
      <div className="grid gap-4 xl:grid-cols-2">
        {section('Performance by Class / Stream', 'Class', summaries.byStream ?? [])}
        {section('Performance by Subject', 'Subject', summaries.bySubject ?? [])}
      </div>
      {divisionRows.length > 0 && <Card className="overflow-hidden">
        <div className="border-b border-ks-line bg-ks-paper px-4 py-2 text-sm font-bold text-ks-navy">Division Analysis by Class / Stream</div>
        <div className="overflow-x-auto"><table className="w-full text-xs">
          <thead className="text-left text-ks-muted"><tr><th className="px-3 py-2">Class</th>{divisionKeys.map((key) => <th key={key} className="px-2 py-2 text-center">{key.replace('Division ', 'Div ')}</th>)}</tr></thead>
          <tbody className="divide-y divide-ks-line">{divisionRows.map((row: any) => <tr key={S(row.classId)}>
            <td className="px-3 py-2 font-semibold text-ks-navy">{formatClassLabel(S(row.className), row.stream)}</td>
            {divisionKeys.map((key) => <td key={key} className="px-2 py-2 text-center font-semibold">{N(row.divisionDistribution?.[key])}</td>)}
          </tr>)}</tbody>
        </table></div>
      </Card>}
      {section('Performance by Gender', 'Gender', summaries.byGender ?? [])}
      <p className="text-xs text-ks-muted">* A marked A-Level supporting subject is displayed but is not used in the student total, average, rank or division.</p>
    </div>
  );
}

export function EditRequestCard({ r, showWindow }: { r: Record<string, any>; showWindow?: boolean }) {
  const decide = useDecideEditRequest();
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const go = async (decision: 'grant' | 'reject') => {
    setErr('');
    try { await decide.mutateAsync({ id: S(r.id), decision, note: note.trim() || undefined }); } catch (e: any) { setErr(S(e?.message, 'Could not save the decision')); }
  };
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start gap-3">
        <Badge tone={statusTone(S(r.status))}>{S(r.status)}</Badge>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ks-navy">{S(r.reason)}</p>
          <p className="text-xs text-ks-muted">
            {S(r.requestedByName, S(r.requestedByRole))}{r.subjectName ? ` · ${S(r.subjectName)}` : ' · whole window'}
            {showWindow ? ` · ${S(r.examWindow?.name)} (${S(r.examWindow?.status)})` : ''} · {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}
          </p>
          {r.decisionNote && <p className="mt-1 text-xs text-ks-muted">Decision note: {S(r.decisionNote)}</p>}
        </div>
      </div>
      {S(r.status) === 'REQUESTED' && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input className={`${inputCls} min-w-[200px] flex-1`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note to the teacher" />
          <Button variant="success" onClick={() => go('grant')} loading={decide.isPending}><Unlock className="h-4 w-4" /> Approve & unlock</Button>
          <Button variant="danger" onClick={() => go('reject')} loading={decide.isPending}><XCircle className="h-4 w-4" /> Decline</Button>
        </div>
      )}
      {S(r.status) === 'REQUESTED' && <p className="mt-2 text-xs text-ks-muted">Approving unpublishes the window's results, unlocks this subject for the teacher, and the window must be closed and republished afterwards.</p>}
      {err && <p className="mt-2 text-xs font-semibold text-ks-rose" role="alert">{err}</p>}
    </Card>
  );
}

function EditRequestsPanel({ windowId }: { windowId: string }) {
  const reqs = useEditRequests({ examWindowId: windowId });
  return (
    <div className="space-y-3">
      {reqs.isLoading && <Card className="p-6 text-center text-ks-muted">Loading…</Card>}
      {reqs.data && reqs.data.length === 0 && <EmptyState title="No edit requests" message="Teachers can request to edit locked results; approvals appear here." />}
      {(reqs.data ?? []).map((r) => <EditRequestCard key={S(r.id)} r={r} />)}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN: Exam Types
// ═══════════════════════════════════════════════════════════════════════════
export function ExamTypesPage() {
  const types = useExamTypes();
  const create = useCreateExamType();
  const del = useDeleteExamType();
  const migrate = useMigrateExamTypes();
  const [form, setForm] = useState<Record<string, any>>({ defaultWeight: 100 });
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));
  const [msg, setMsg] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const submit = async () => {
    if (!form.name || !form.code) return;
    await create.mutateAsync({ name: form.name, code: form.code, defaultWeight: N(form.defaultWeight, 100), educationStage: form.educationStage || undefined });
    setForm({ defaultWeight: 100 });
    setShowCreate(false);
  };

  return (
    <div>
      <Link to="/exams" className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-ks-blue"><ArrowLeft className="h-4 w-4" /> Windows</Link>
      <WorkspaceHeader
        title="Exam Types"
        description="The catalogue of exam types (Weekly, Monthly, Midterm, Terminal…). The weight is used when composing report cards."
        action={<div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={async () => { const r: any = await migrate.mutateAsync(); setMsg(`Imported ${N(r?.created)} type(s) from legacy assessment types.`); }} loading={migrate.isPending}><RefreshCw className="h-4 w-4" /> Import legacy</Button>
          <Button onClick={() => setShowCreate((visible) => !visible)}><Plus className="h-4 w-4" /> {showCreate ? 'Close' : 'Add Exam Type'}</Button>
        </div>}
      />
      <ExamTaskNavigation active="types" />
      {msg && <div className="mb-4"><Banner tone="emerald">{msg}</Banner></div>}

      {showCreate && <Card className="mb-6 p-5">
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Name"><input className={inputCls} value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} placeholder="Terminal Exam" /></Field>
          <Field label="Code"><input className={inputCls} value={form.code ?? ''} onChange={(e) => set('code', e.target.value)} placeholder="TERM" /></Field>
          <Field label="Weight %"><input className={inputCls} type="number" value={form.defaultWeight ?? 100} onChange={(e) => set('defaultWeight', e.target.value)} /></Field>
          <div className="flex items-end"><Button onClick={submit} loading={create.isPending} disabled={!form.name || !form.code}><Plus className="h-4 w-4" /> Add type</Button></div>
        </div>
        {create.isError && <div className="mt-3"><Banner tone="rose">{S((create.error as any)?.message)}</Banner></div>}
      </Card>}

      {types.isLoading && <Card className="p-6 text-center text-ks-muted">Loading…</Card>}
      {types.data && types.data.length === 0 && <EmptyState title="No exam types" message="Use Add Exam Type above, or import from legacy assessment types." />}
      {types.data && types.data.length > 0 && (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ks-paper text-left text-[11px] uppercase tracking-wider text-ks-muted">
              <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Code</th><th className="px-4 py-3">Weight</th><th className="px-4 py-3">Stage</th><th className="px-4 py-3"></th></tr>
            </thead>
            <tbody className="divide-y divide-ks-line">
              {types.data.map((t) => (
                <tr key={S(t.id)}>
                  <td className="px-4 py-3 font-semibold text-ks-navy">{S(t.name)}</td>
                  <td className="px-4 py-3"><Badge tone="slate">{S(t.code)}</Badge></td>
                  <td className="px-4 py-3">{N(t.defaultWeight)}%</td>
                  <td className="px-4 py-3 text-ks-muted">{S(t.educationStage, 'All')}</td>
                  <td className="px-4 py-3 text-right"><Button variant="ghost" onClick={() => del.mutate(S(t.id))}>Delete</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN: Compose report cards
// ═══════════════════════════════════════════════════════════════════════════
export function ComposeReportCardsPage() {
  const ref = useExamReference();
  const [year, setYear] = useState('');
  const [term, setTerm] = useState('');
  const windows = useExamWindows({ academicYearId: year || undefined, termId: term || undefined, status: undefined });
  const compose = useComposeReportCards();
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [scopeLevel, setScopeLevel] = useState('');
  const [publish, setPublish] = useState(false);
  const [result, setResult] = useState<any>(null);

  const composable = (windows.data ?? []).filter((w) => ['CLOSED', 'PUBLISHED', 'REOPENED'].includes(S(w.status)));
  const terms = (ref.data?.terms ?? []).filter((t: any) => !year || t.academicYearId === year);
  const levels = [...new Set((ref.data?.classes ?? []).map((c: any) => c.level).filter((l: any) => l != null))].sort((a: any, b: any) => a - b);

  const toggle = (w: any) => setSelected((s) => {
    const n = { ...s };
    if (n[w.id] != null) delete n[w.id]; else n[w.id] = N(w.weight, 100);
    // One window fills the card; several start from an even split so the total is valid immediately.
    const ids = Object.keys(n);
    if (ids.length === 1) n[ids[0]] = 100;
    else if (ids.length > 1 && !(n[w.id] != null && s[w.id] != null)) ids.forEach((k, i) => { n[k] = Math.round((100 / ids.length) * 100) / 100 + (i === ids.length - 1 ? Math.round((100 - Math.round((100 / ids.length) * 100) / 100 * ids.length) * 100) / 100 : 0); });
    return n;
  });
  const weightTotal = Math.round(Object.values(selected).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0) * 100) / 100;
  const weightsOk = Object.keys(selected).length > 0 && Object.values(selected).every((v) => v > 0) && Math.abs(weightTotal - 100) <= 0.01;
  const canCompose = year && term && weightsOk;

  const submit = async () => {
    setResult(null);
    const body = {
      academicYearId: year, termId: term, scopeLevel: scopeLevel ? Number(scopeLevel) : undefined, publish,
      windows: Object.entries(selected).map(([examWindowId, weight]) => ({ examWindowId, weight })),
    };
    try { const res = await compose.mutateAsync(body); setResult(res); } catch { /* shown via compose.isError */ }
  };

  return (
    <div>
      <Link to="/exams" className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-ks-blue"><ArrowLeft className="h-4 w-4" /> Windows</Link>
      <WorkspaceHeader title="Compose Report Cards" description="Choose which exam windows make up the term report card and how much each weighs." />
      <ExamTaskNavigation active="composition" />

      <Card className="mb-5 p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Academic year">
            <select className={inputCls} value={year} onChange={(e) => { setYear(e.target.value); setTerm(''); }}>
              <option value="">Select…</option>
              {(ref.data?.years ?? []).map((y: any) => <option key={S(y.id)} value={S(y.id)}>{S(y.name)}</option>)}
            </select>
          </Field>
          <Field label="Term">
            <select className={inputCls} value={term} onChange={(e) => setTerm(e.target.value)}>
              <option value="">Select…</option>
              {terms.map((t: any) => <option key={S(t.id)} value={S(t.id)}>{S(t.name)}</option>)}
            </select>
          </Field>
          <Field label="Standard (optional)">
            <select className={inputCls} value={scopeLevel} onChange={(e) => setScopeLevel(e.target.value)}>
              <option value="">All in scope</option>
              {levels.map((lv: any) => <option key={lv} value={lv}>Level {lv}</option>)}
            </select>
          </Field>
        </div>
      </Card>

      {term && (
        <Card className="mb-5 p-5">
          <h3 className="mb-3 font-display text-lg font-bold text-ks-navy">Windows in this term</h3>
          {composable.length === 0 && <p className="text-sm text-ks-muted">No computed/published windows in this term yet.</p>}
          <div className="space-y-2">
            {composable.map((w) => {
              const on = selected[S(w.id)] != null;
              return (
                <div key={S(w.id)} className={`flex items-center gap-3 rounded-lg border p-3 ${on ? 'border-ks-blue bg-ks-blue/5' : 'border-ks-line'}`}>
                  <input type="checkbox" checked={on} onChange={() => toggle(w)} />
                  <div className="flex-1"><span className="font-semibold text-ks-navy">{S(w.name)}</span> <Badge tone={statusTone(S(w.status))}>{S(w.status)}</Badge></div>
                  {on && (
                    <label className="flex items-center gap-1 text-xs font-bold text-ks-navy">Weight
                      <input className="w-20 rounded border border-ks-line px-2 py-1" type="number" value={selected[S(w.id)]} onChange={(e) => setSelected((s) => ({ ...s, [S(w.id)]: Number(e.target.value) }))} />%
                    </label>
                  )}
                </div>
              );
            })}
          </div>
          {Object.keys(selected).length > 0 && (
            <p className={`mt-3 text-sm font-bold ${weightsOk ? 'text-ks-emerald' : 'text-ks-rose'}`} role="status">
              Weights total {weightTotal}% {weightsOk ? '✓' : '— they must be positive and add up to exactly 100%.'}
            </p>
          )}
          <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-ks-navy">
            <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} /> Publish report cards immediately
          </label>
          {compose.isError && <div className="mt-3"><Banner tone="rose">{S((compose.error as any)?.message)}</Banner></div>}
          <div className="mt-4"><Button onClick={submit} loading={compose.isPending} disabled={!canCompose}>Generate report cards</Button></div>
        </Card>
      )}

      {result && (
        <Banner tone="emerald">
          Generated {N(result.reportCardsGenerated)} report cards for {N(result.students)} students across {N(result.classes)} class(es){result.published ? ' · published' : ''}.
          {N(result.exemptSubjects) > 0 ? ` ${N(result.exemptSubjects)} exempt subject result(s) are shown as EXEMPT and left out of averages.` : ''}
        </Banner>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TEACHER: open windows
// ═══════════════════════════════════════════════════════════════════════════
import { SchoolBadge } from '../../teacher/components/TeacherBits';

export function TeacherExamWindowsPage() {
  const windows = useTeacherExamWindows();
  const reference = useExamReference();
  const editReq = useCreateEditRequest();
  const [reqFor, setReqFor] = useState<{ windowId: string; assessmentId: string } | null>(null);
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const everything = (windows.data ?? []) as any[];
  const isOpen = (w: any) => w.status === 'OPEN' || w.status === 'REOPENED';
  // Windows still collecting marks come first; the finished ones sit below.
  const all = [...everything.filter(isOpen), ...everything.filter((w) => !isOpen(w))];
  const todo = all
    .filter((w) => w.status === 'OPEN' || w.status === 'REOPENED')
    .flatMap((w) => (w.mySubjects as any[]).filter((s) => s.canEdit && !s.complete));

  const sendRequest = async () => {
    if (!reqFor) return;
    setErr('');
    try {
      await editReq.mutateAsync({ examWindowId: reqFor.windowId, assessmentId: reqFor.assessmentId, reason });
      setMsg('Request sent. Your Head of Department or an administrator will review it. You will see the answer here.');
      setReqFor(null); setReason('');
      windows.refetch();
    } catch (e: any) { setErr(S(e?.message, 'Could not send the request')); }
  };

  return (
    <div>
      <WorkspaceHeader title="Exam Windows" description="Enter the marks for the subjects you teach. Everything you need for each exam is on this page." />
      <ol className="mb-5 grid gap-2 text-sm sm:grid-cols-4" aria-label="How exam marks work">
        {['1. Open your subject', '2. Type marks, or download the template and upload the filled file', '3. Save. Mark absent students "Absent" or "Not sat"', '4. Submit when every student has a result'].map((t) => (
          <li key={t} className="rounded-lg border border-ks-line bg-ks-paper/40 px-3 py-2 font-semibold text-ks-navy">{t}</li>
        ))}
      </ol>
      {windows.isLoading && <Card className="p-8 text-center text-ks-muted">Loading…</Card>}
      {windows.isError && <ErrorState title="Could not load" message={S((windows.error as any)?.message)} onRetry={() => windows.refetch()} />}
      {windows.data && todo.length > 0 && <div className="mb-4"><Banner tone="amber">{todo.length} subject{todo.length === 1 ? '' : 's'} still need marks.</Banner></div>}
      {windows.data && windows.data.length > 0 && todo.length === 0 && <div className="mb-4"><Banner tone="emerald">You are up to date. Nothing is waiting for your marks.</Banner></div>}
      {msg && <div className="mb-4"><Banner tone="emerald">{msg}</Banner></div>}
      {windows.data && windows.data.length === 0 && <EmptyState title="No exam windows" message="When an exam window is opened for a class you teach, your subjects appear here." />}
      <div className="grid gap-4 lg:grid-cols-2">
        {all.map((w, wi) => {
          const open = w.status === 'OPEN' || w.status === 'REOPENED';
          const overdue = open && w.closesAt && new Date(w.closesAt) < new Date();
          const firstClosed = !open && (wi === 0 || isOpen(all[wi - 1]));
          return (
            <Fragment key={S(w.id)}>
            {firstClosed && <h2 className="col-span-full mt-2 font-display text-lg font-black text-ks-navy lg:col-span-2">Closed or published</h2>}
            <Card className="p-5">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <h3 className="flex flex-wrap items-center gap-2 font-display text-lg font-bold text-ks-navy">{S(w.name)} <SchoolBadge schoolId={w.schoolId} /></h3>
                  <p className="text-xs text-ks-muted">{S(w.examType?.name)}{w.termId ? ` · ${S(reference.data?.terms.find((term) => S(term.id) === S(w.termId))?.name, 'Term')}` : ''} · out of {N(w.maxScore)}</p>
                  {w.closesAt && <p className={`text-xs font-semibold ${overdue ? 'text-ks-rose' : 'text-ks-muted'}`}>{overdue ? 'Deadline passed: ' : 'Marks due: '}{new Date(w.closesAt).toLocaleDateString()}</p>}
                </div>
                <Badge tone={statusTone(S(w.status))}>{S(w.status)}</Badge>
              </div>
              {w.instructions && <p className="mb-3 rounded-lg bg-ks-paper/60 p-2 text-xs text-ks-navy">{S(w.instructions)}</p>}
              {!open && <p className="mb-3 text-xs text-ks-muted">{w.status === 'PUBLISHED' ? 'Results are published.' : 'Entry is closed.'} Marks are locked. To change one, ask your Head of Department or an administrator for permission.</p>}
              <div className="space-y-2">
                {((w.mySubjects ?? []) as any[]).map((s) => {
                  const klass = reference.data?.classes.find((item) => S(item.id) === S(s.classId));
                  const er = s.editRequest;
                  const asking = reqFor?.assessmentId === s.assessmentId;
                  return (
                    <div key={S(s.assessmentId)} className="rounded-lg border border-ks-line p-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <span className="font-semibold text-ks-navy">{S(s.subjectName)}</span>
                          <span className="block text-xs text-ks-muted">{klass ? formatClassLabel(S(klass.name), klass.stream, ' · ') : 'Class'}</span>
                        </div>
                        <ProgressBar entered={N(s.marksEntered)} required={N(s.required)} />
                        {s.canEdit
                          ? <Link to={`/teacher/exams/marks/${S(s.assessmentId)}`} className="rounded-lg bg-ks-blue px-3 py-2 text-xs font-bold text-white hover:opacity-90">{s.complete ? (S(s.status) === 'SUBMITTED' ? 'Review marks' : 'Review & submit') : 'Enter marks'}</Link>
                          : <Link to={`/teacher/exams/marks/${S(s.assessmentId)}`} className="rounded-lg border border-ks-line px-3 py-2 text-xs font-bold text-ks-navy hover:bg-ks-paper">View</Link>}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <Badge tone={S(s.status) === 'LOCKED' ? 'emerald' : S(s.status) === 'SUBMITTED' ? 'amber' : 'blue'}>{S(s.status)}</Badge>
                        {er && <Badge tone={statusTone(S(er.status))}>Edit request: {S(er.status)}</Badge>}
                        {er?.status === 'GRANTED' && <span className="font-semibold text-ks-emerald">Edit approved. Open the subject and make your changes.</span>}
                        {er?.status === 'REJECTED' && <span className="text-ks-rose">{S(er.decisionNote, 'Declined')}</span>}
                        {!s.canEdit && !open && (!er || ['REJECTED', 'REPUBLISHED', 'COMPLETED'].includes(S(er.status))) && (
                          <button type="button" className="font-bold text-ks-blue underline" onClick={() => { setReqFor({ windowId: S(w.id), assessmentId: S(s.assessmentId) }); setErr(''); }}>Request permission to edit</button>
                        )}
                      </div>
                      {asking && (
                        <div className="mt-3 space-y-2 rounded-lg bg-ks-paper/60 p-3">
                          <Field label="Why does this need to change?">
                            <textarea className={inputCls} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Entered 45 instead of 54 for one student" />
                          </Field>
                          {err && <p className="text-xs font-semibold text-ks-rose" role="alert">{err}</p>}
                          <div className="flex gap-2">
                            <Button onClick={sendRequest} loading={editReq.isPending} disabled={reason.trim().length < 5}>Send request</Button>
                            <Button variant="ghost" onClick={() => setReqFor(null)}>Cancel</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TEACHER: marks entry for one assessment (grid + template + upload)
// ═══════════════════════════════════════════════════════════════════════════
export function TeacherExamMarksPage() {
  const { assessmentId = '' } = useParams();
  const tpl = useMarksTemplate(assessmentId);
  const reference = useExamReference();
  const upload = useUploadMarks();
  const submit = useSubmitAssessment();
  const editReq = useCreateEditRequest();
  type EntryStatus = 'SCORED' | 'ABSENT' | 'NOT_SAT';
  const [rows, setRows] = useState<Record<string, { score: string; status: EntryStatus }>>({});
  const [result, setResult] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [showReq, setShowReq] = useState(false);
  const [fileMsg, setFileMsg] = useState('');
  const location = useLocation();
  const decide = useDecideEditRequest();
  const adminView = location.pathname.startsWith('/exams');

  const data = tpl.data as any;
  const myRequests = useEditRequests({ examWindowId: S(data?.assessment?.examWindow?.id) || undefined });
  const grantedRequest = (myRequests.data ?? []).find((r) => S(r.assessmentId) === assessmentId && S(r.status) === 'GRANTED');
  const assessment = data?.assessment;
  const classInfo = reference.data?.classes.find((klass) => S(klass.id) === S(assessment?.classId));
  const yearInfo = reference.data?.years.find((year) => S(year.id) === S(assessment?.examWindow?.academicYearId));
  const termInfo = reference.data?.terms.find((term) => S(term.id) === S(assessment?.examWindow?.termId));
  const maxScore = N(assessment?.maxScore, 100);
  const status = S(assessment?.status);
  // Editable while the window is open, even after "submit" (a slip can still be fixed). Locked once the window closes.
  const windowOpen = ['OPEN', 'REOPENED'].includes(S(assessment?.examWindow?.status));
  const locked = !windowOpen || ['LOCKED', 'HOD_APPROVED', 'APPROVED'].includes(status);

  // Seed the grid ONCE per assessment when the template loads. Using a ref guard
  // (not the raw data reference) prevents React Query's re-fetches from wiping
  // the teacher's in-progress edits.
  const seededRef = useRef('');
  useEffect(() => {
    if (data?.rows && seededRef.current !== assessmentId) {
      seededRef.current = assessmentId;
      const seed: Record<string, { score: string; status: EntryStatus }> = {};
      for (const r of data.rows as any[]) seed[S(r.registrationNumber)] = { score: r.score === '' || r.score == null ? '' : String(r.score), status: r.notSat ? 'NOT_SAT' : r.isAbsent ? 'ABSENT' : 'SCORED' };
      setRows(seed);
    }
  }, [data, assessmentId]);

  const save = async (autoSubmit = false) => {
    setResult(null);
    const all = data?.rows as any[];
    const localOf = (r: any) => rows[S(r.registrationNumber)] ?? { score: '', status: 'SCORED' as EntryStatus };
    const isBlank = (r: any) => { const l = localOf(r); return l.status === 'SCORED' && l.score.trim() === ''; };
    // Catch obvious slips here, naming the student, instead of failing the whole save on the server.
    const outOfRange = all.filter((r) => { const l = localOf(r); if (l.status !== 'SCORED' || l.score.trim() === '') return false; const n = Number(l.score); return !Number.isFinite(n) || n < 0 || n > maxScore; });
    if (outOfRange.length) {
      setResult({ warn: true, message: `Fix ${outOfRange.length} score${outOfRange.length === 1 ? '' : 's'} outside 0–${maxScore}: ${outOfRange.slice(0, 4).map((r) => S(r.studentName)).join(', ')}${outOfRange.length > 4 ? '…' : ''}.` });
      return;
    }
    const blanks = all.filter(isBlank).length;
    if (autoSubmit && blanks > 0) {
      setResult({ warn: true, message: `${blanks} student${blanks === 1 ? ' still has' : 's still have'} no result. Enter a score, or choose Absent / Not sat, before submitting. You can use Save marks to keep your progress.` });
      return;
    }
    // A draft save keeps whatever is filled in; blanks are simply left for later.
    const filled = all.filter((r) => !isBlank(r));
    if (!filled.length) { setResult({ warn: true, message: 'Nothing to save yet. Enter at least one score.' }); return; }
    const payload = filled.map((r) => {
      const local = localOf(r);
      return {
        registrationNumber: S(r.registrationNumber),
        score: local.status !== 'SCORED' ? undefined : Number(local.score),
        isAbsent: local.status === 'ABSENT', notSat: local.status === 'NOT_SAT', row: all.indexOf(r) + 2,
      };
    });
    try {
      const res = await upload.mutateAsync({ assessmentId, rows: payload, autoSubmit });
      setResult(blanks > 0 && !autoSubmit ? { ...(res as object), message: `${S((res as any)?.message, 'Saved.')} ${blanks} student${blanks === 1 ? ' is' : 's are'} still without a result.` } : res);
    } catch (e: any) {
      setResult({ warn: true, message: S(e?.message, 'Could not save. Please try again.') });
    }
  };

  /** Fill the grid from a CSV / Excel file (the downloaded template, filled in). Nothing is saved until the teacher clicks Save. */
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setFileMsg(''); setResult(null);
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const grid: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' });
      const hi = grid.findIndex((row) => row.some((c) => /^registration[_ ]?number$|^admno$|^adm\.? ?no$/i.test(String(c).trim())));
      if (hi < 0) { setFileMsg('Could not find the "registration_number" column. Use the downloaded template.'); return; }
      const head = grid[hi].map((c) => String(c).trim().toLowerCase().replace(/\s+/g, '_'));
      const col = (re: RegExp) => head.findIndex((h) => re.test(h));
      const ci = { reg: col(/^(registration_number|admno|adm\.?_?no)$/), score: col(/^score|marks?$/), abs: col(/^is_absent|absent$/), ns: col(/^not_sat|notsat$/) };
      const yes = (v: unknown) => ['yes', 'y', 'true', '1', 'x'].includes(String(v ?? '').trim().toLowerCase());
      const known = new Set((data.rows as any[]).map((r) => S(r.registrationNumber).toUpperCase()));
      const isFlag = (v: unknown) => /^(yes|y|true|1|x|no|n|false|0)?$/i.test(String(v ?? '').trim());
      const next = { ...rows };
      let applied = 0; const unknown: string[] = []; const misplaced: string[] = [];
      for (const row of grid.slice(hi + 1)) {
        const reg = S(row[ci.reg]).trim();
        if (!reg) continue;
        if (!known.has(reg.toUpperCase())) { unknown.push(reg); continue; }
        const key = (data.rows as any[]).find((r) => S(r.registrationNumber).toUpperCase() === reg.toUpperCase()).registrationNumber;
        // A number (or any text) under is_absent / not_sat means the marks were typed into the wrong column.
        if ((ci.abs >= 0 && !isFlag(row[ci.abs])) || (ci.ns >= 0 && !isFlag(row[ci.ns]))) { misplaced.push(reg); continue; }
        const score = ci.score >= 0 ? String(row[ci.score] ?? '').trim() : '';
        const status: EntryStatus = ci.ns >= 0 && yes(row[ci.ns]) ? 'NOT_SAT' : ci.abs >= 0 && yes(row[ci.abs]) ? 'ABSENT' : 'SCORED';
        next[S(key)] = { score: status === 'SCORED' ? score : '', status };
        applied += 1;
      }
      if (misplaced.length > 0) {
        setFileMsg(`Could not use ${misplaced.length} row(s): the "is_absent" or "not_sat" column holds something other than yes / no (for example ${S(grid[hi + 1 + 0]?.[ci.abs] ?? '')}). Scores go in the "score" column. Move them over and upload the file again. ${applied ? `${applied} other row(s) were loaded.` : 'Nothing was loaded.'}`);
        if (applied) setRows(next);
        return;
      }
      setRows(next);
      setFileMsg(`Loaded ${applied} row(s) from ${file.name}.${unknown.length ? ` ${unknown.length} registration number(s) are not in this class and were ignored: ${unknown.slice(0, 5).join(', ')}.` : ''} Review the marks below, then click "Save marks".`);
    } catch (e: any) { setFileMsg(`Could not read that file: ${S(e?.message)}`); }
  };

  if (tpl.isLoading) return <Card className="p-8 text-center text-ks-muted">Loading marks sheet…</Card>;
  if (tpl.isError || !data) return <ErrorState title="Could not load" message={S((tpl.error as any)?.message)} onRetry={() => tpl.refetch()} />;

  return (
    <div>
      <Link to={adminView ? `/exams/${S(assessment?.examWindow?.id)}` : '/teacher/exams'} className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-ks-blue"><ArrowLeft className="h-4 w-4" /> {adminView ? 'Back to the exam window' : 'My exam windows'}</Link>
      <WorkspaceHeader
        title={`${S(assessment?.subjectName)} — Marks`}
        description={[formatClassLabel(S(classInfo?.name, 'Class'), classInfo?.stream, ' · '), S(assessment?.examWindow?.name), S(yearInfo?.name ?? yearInfo?.year), S(termInfo?.name), `out of ${maxScore}`].filter(Boolean).join(' · ')}
        action={<Badge tone={statusTone(status === 'OPEN' ? 'OPEN' : status)}>{status}</Badge>}
      />

      <Card className="mb-4 flex flex-wrap items-center gap-2 p-4">
        <Button variant="secondary" onClick={() => downloadMarksTemplateCsv(assessmentId)}><Download className="h-4 w-4" /> Download template</Button>
        {!locked && (
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-ks-line bg-white px-4 py-2.5 text-sm font-bold text-ks-navy hover:bg-ks-paper">
            <FileSpreadsheet className="h-4 w-4" /> Upload filled file
            <input type="file" accept=".csv,.xlsx,.xls" className="sr-only" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
        )}
        {grantedRequest && <Button variant="success" onClick={async () => { await decide.mutateAsync({ id: S(grantedRequest.id), decision: 'complete' }); setResult({ message: 'Thank you. This subject is locked again and waiting for the administrator to republish.' }); tpl.refetch(); }} loading={decide.isPending}><CheckCircle2 className="h-4 w-4" /> Finish editing</Button>}
        {!locked && <><Button onClick={() => save(false)} loading={upload.isPending}><Upload className="h-4 w-4" /> Save marks</Button>
          <Button variant="success" onClick={() => save(true)} loading={upload.isPending}><Send className="h-4 w-4" /> Save & submit</Button></>}
        {locked && !adminView && !grantedRequest && <Button variant="secondary" onClick={() => setShowReq((v) => !v)}><Unlock className="h-4 w-4" /> Request permission to edit</Button>}
        <span className="ml-auto text-xs text-ks-muted">{N(data.rosterSize)} students</span>
      </Card>

      {fileMsg && <div className="mb-4"><Banner tone={fileMsg.startsWith('Could not') ? 'rose' : 'emerald'}>{fileMsg}</Banner></div>}
      {locked && <div className="mb-4"><Banner tone="amber">These marks are locked. {adminView ? 'Reopen the window from the exam window page to correct them.' : 'To change one, ask for permission below. Your Head of Department or an administrator approves it.'}</Banner></div>}
      {showReq && (
        <Card className="mb-4 p-4">
          <Field label="Reason for editing locked results">
            <textarea className={inputCls} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Entered wrong mark for one student" />
          </Field>
          <div className="mt-3 flex gap-2">
            <Button onClick={async () => { await editReq.mutateAsync({ examWindowId: S(assessment?.examWindow?.id), assessmentId, reason }); setShowReq(false); setResult({ message: 'Edit request sent to the exam administrator.' }); }} loading={editReq.isPending} disabled={reason.length < 5}>Send request</Button>
            <Button variant="ghost" onClick={() => setShowReq(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      {result && (
        <div className="mb-4">
          <Banner tone={result.warn || (result.errors?.length ?? 0) > 0 ? 'amber' : 'emerald'}>
            {S(result.message, 'Saved.')}
            {result.autoSubmitted ? ' Submitted for approval.' : ''}
          </Banner>
          {(result.errors ?? []).length > 0 && (
            <div className="mt-2 rounded-lg border border-ks-amber/30 bg-ks-amber/5 p-3 text-xs text-[#7a5200]">
              {result.errors.slice(0, 10).map((e: any, i: number) => <div key={i}>Row {N(e.row)}: {S(e.message)}</div>)}
            </div>
          )}
        </div>
      )}

      {!locked && (() => {
        const blank = (data.rows as any[]).filter((r) => { const l = rows[S(r.registrationNumber)]; return !l || (l.status === 'SCORED' && l.score === ''); }).length;
        return (
          <p className={`mb-3 text-xs font-semibold ${blank ? 'text-ks-rose' : 'text-ks-emerald'}`} role="status">
            {blank ? `${blank} student${blank === 1 ? '' : 's'} still without a result — enter a score, or choose Absent / Not sat. Results cannot be closed with blanks.` : 'Every student has a result.'}
          </p>
        );
      })()}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ks-paper text-left text-[11px] uppercase tracking-wider text-ks-muted">
              <tr><th className="px-4 py-3">ADMNO</th><th className="px-4 py-3">Student</th><th className="px-4 py-3 w-32">Score</th><th className="px-4 py-3">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-ks-line">
              {(data.rows as any[]).map((r) => {
                const reg = S(r.registrationNumber);
                const local = rows[reg] ?? { score: '', status: 'SCORED' as EntryStatus };
                const empty = local.status === 'SCORED' && local.score === '';
                return (
                  <tr key={reg} className={empty && !locked ? 'bg-ks-rose/5' : ''}>
                    <td className="px-4 py-2 text-ks-muted">{reg}</td>
                    <td className="px-4 py-2 font-semibold text-ks-navy">{S(r.studentName)}</td>
                    <td className="px-4 py-2">
                      <input type="number" min={0} max={maxScore} disabled={locked || local.status !== 'SCORED'} value={local.score} aria-label={`Score for ${S(r.studentName)}`}
                        onChange={(e) => setRows((s) => ({ ...s, [reg]: { ...local, score: e.target.value } }))}
                        className="w-24 rounded border border-ks-line px-2 py-1 disabled:bg-ks-mist/20" />
                    </td>
                    <td className="px-4 py-2">
                      <select disabled={locked} value={local.status} aria-label={`Status for ${S(r.studentName)}`}
                        onChange={(e) => setRows((s) => ({ ...s, [reg]: { ...local, status: e.target.value as EntryStatus, score: e.target.value === 'SCORED' ? local.score : '' } }))}
                        className="rounded border border-ks-line px-2 py-1 text-xs">
                        <option value="SCORED">Scored</option>
                        <option value="ABSENT">Absent (0)</option>
                        <option value="NOT_SAT">Not sat (0)</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
