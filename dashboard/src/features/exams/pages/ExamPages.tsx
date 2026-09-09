import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
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
import {
  downloadMarksTemplateCsv, downloadMeritExport,
  useComposeReportCards, useCreateEditRequest, useCreateExamType, useCreateExamWindow,
  useDecideEditRequest, useDeleteExamType, useEditRequests, useExamReference,
  useExamTypes, useExamWindow, useExamWindows, useMarksTemplate, useMeritList,
  useMigrateExamTypes, useSubmitAssessment, useTeacherExamWindows,
  useUploadMarks, useWindowAction,
} from '../api/examHooks';

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

      {showCreate && <CreateWindowForm onDone={() => setShowCreate(false)} />}

      <div className="mb-4 flex gap-2">
        {['', 'DRAFT', 'OPEN', 'CLOSED', 'PUBLISHED'].map((s) => (
          <button key={s} onClick={() => setStatus(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold ${status === s ? 'bg-ks-blue text-white' : 'bg-ks-mist/30 text-ks-navy'}`}>
            {s || 'All'}
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
                  <th className="px-4 py-3">Classes</th><th className="px-4 py-3"></th>
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
                          <span className="text-xs text-ks-muted">{N(prog.percentSubmitted)}% in · {N(prog.percentLocked)}% locked</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">{N(w.classCount ?? (prog.totalAssessments ? undefined : 0))}</td>
                      <td className="px-4 py-3 text-right"><Link to={`/exams/${S(w.id)}`}><Button variant="ghost">Manage →</Button></Link></td>
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

function CreateWindowForm({ onDone }: { onDone: () => void }) {
  const ref = useExamReference();
  const types = useExamTypes();
  const create = useCreateExamWindow();
  const nav = useNavigate();
  const [form, setForm] = useState<Record<string, any>>({ scopeType: 'STANDARDS', openNow: true, maxScore: 100 });
  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const terms = (ref.data?.terms ?? []).filter((t: any) => !form.academicYearId || t.academicYearId === form.academicYearId);
  const levels = [...new Set((ref.data?.classes ?? []).map((c: any) => c.level).filter((l: any) => l != null))].sort((a: any, b: any) => a - b);
  const classesForStreams = (ref.data?.classes ?? []).filter((c: any) => !form.educationStage || c.educationStage === form.educationStage);

  const submit = async () => {
    const body: Record<string, unknown> = {
      examTypeId: form.examTypeId, name: form.name, academicYearId: form.academicYearId, termId: form.termId,
      educationStage: form.educationStage || undefined, scopeType: form.scopeType,
      maxScore: N(form.maxScore, 100), openNow: !!form.openNow,
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
          <select className={inputCls} value={form.academicYearId ?? ''} onChange={(e) => { set('academicYearId', e.target.value); set('termId', ''); }}>
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
          <select className={inputCls} value={form.educationStage ?? ''} onChange={(e) => set('educationStage', e.target.value)}>
            <option value="">All stages</option>
            {['NURSERY', 'PRE_UNIT', 'PRIMARY', 'O_LEVEL', 'A_LEVEL'].map((s) => <option key={s} value={s}>{s}</option>)}
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
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold ${on ? 'bg-ks-blue text-white' : 'bg-ks-mist/30 text-ks-navy'}`}>{S(c.name)}{c.stream ? ` ${c.stream}` : ''}</button>;
              })}
            </div>
          </Field>
        )}
      </div>
      <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-ks-navy">
        <input type="checkbox" checked={!!form.openNow} onChange={(e) => set('openNow', e.target.checked)} />
        Open immediately (teachers can start entering marks)
      </label>
      {create.isError && <div className="mt-3"><Banner tone="rose">{S((create.error as any)?.message, 'Could not create window')}</Banner></div>}
      <div className="mt-4 flex gap-2">
        <Button onClick={submit} loading={create.isPending} disabled={!canSubmit}>Create window</Button>
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
  const action = useWindowAction();
  const [tab, setTab] = useState<'overview' | 'merit' | 'edits'>('overview');
  const [msg, setMsg] = useState<string>('');

  const w = win.data;
  const status = S(w?.status);

  const runAction = async (act: string) => {
    setMsg('');
    try {
      const res: any = await action.mutateAsync({ id, action: act });
      if (act === 'close') setMsg(`Closed & computed ${N(res?.computed)} students.`);
      else if (act === 'publish') setMsg(`Published to ${N(res?.students)} students. Downstream snapshots: ${N(res?.downstream?.snapshots)}.`);
      else setMsg(`${act} done.`);
    } catch (e: any) { setMsg(e?.message ?? `${act} failed`); }
  };

  if (win.isLoading) return <Card className="p-8 text-center text-ks-muted">Loading…</Card>;
  if (win.isError || !w) return <ErrorState title="Window not found" message={S((win.error as any)?.message, 'It may have been removed.')} onRetry={() => win.refetch()} />;

  return (
    <div>
      <Link to="/exams" className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-ks-blue"><ArrowLeft className="h-4 w-4" /> All windows</Link>
      <WorkspaceHeader
        title={S(w.name)}
        description={`${S((w.examType as any)?.name)} · ${N(w.assessmentCount)} subjects across ${N(w.classCount)} classes`}
        action={<Badge tone={statusTone(status)}>{status}</Badge>}
      />

      {/* Lifecycle actions */}
      <Card className="mb-5 flex flex-wrap items-center gap-2 p-4">
        {(status === 'DRAFT' || status === 'REOPENED') && <Button onClick={() => runAction('open')} loading={action.isPending}><PlayCircle className="h-4 w-4" /> Open for entry</Button>}
        {(status === 'OPEN' || status === 'REOPENED') && <Button onClick={() => runAction('close')} loading={action.isPending}><Lock className="h-4 w-4" /> Close & compute</Button>}
        {status === 'CLOSED' && <Button onClick={() => runAction('compute')} variant="secondary" loading={action.isPending}><RefreshCw className="h-4 w-4" /> Recompute</Button>}
        {(status === 'CLOSED' || status === 'REOPENED') && <Button onClick={() => runAction('publish')} variant="success" loading={action.isPending}><CheckCircle2 className="h-4 w-4" /> Publish results</Button>}
        {status === 'PUBLISHED' && <Button onClick={() => runAction('unpublish')} variant="danger" loading={action.isPending}><Unlock className="h-4 w-4" /> Unpublish</Button>}
        <span className="ml-auto text-xs text-ks-muted">Lifecycle: DRAFT → OPEN → CLOSED → PUBLISHED</span>
      </Card>
      {msg && <div className="mb-5"><Banner tone={msg.toLowerCase().includes('fail') ? 'rose' : 'emerald'}>{msg}</Banner></div>}

      <div className="mb-4 flex gap-2 border-b border-ks-line">
        {(['overview', 'merit', 'edits'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-bold ${tab === t ? 'border-b-2 border-ks-blue text-ks-blue' : 'text-ks-muted'}`}>
            {t === 'overview' ? 'Subjects' : t === 'merit' ? 'Merit List' : 'Edit Requests'}
          </button>
        ))}
      </div>

      {tab === 'overview' && <WindowSubjects w={w} />}
      {tab === 'merit' && <MeritListPanel windowId={id} status={status} />}
      {tab === 'edits' && <EditRequestsPanel windowId={id} />}
    </div>
  );
}

function WindowSubjects({ w }: { w: Record<string, unknown> }) {
  const assessments = (w.assessments ?? []) as Record<string, unknown>[];
  if (!assessments.length) return <EmptyState title="No subjects yet" message="Open the window to fan out one marks sheet per class-subject in scope." />;
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-ks-paper text-left text-[11px] uppercase tracking-wider text-ks-muted">
            <tr><th className="px-4 py-3">Subject</th><th className="px-4 py-3">Class</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Max</th></tr>
          </thead>
          <tbody className="divide-y divide-ks-line">
            {assessments.map((a) => (
              <tr key={S(a.id)}>
                <td className="px-4 py-3 font-semibold text-ks-navy">{S((a.classSubject as any)?.subject?.name)}</td>
                <td className="px-4 py-3 text-ks-muted">{S(a.classId).slice(0, 8)}</td>
                <td className="px-4 py-3"><Badge tone={S(a.status) === 'LOCKED' ? 'emerald' : S(a.status) === 'SUBMITTED' || S(a.status) === 'HOD_APPROVED' ? 'amber' : 'slate'}>{S(a.status)}</Badge></td>
                <td className="px-4 py-3">{N(a.maxScore)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
                <th className="px-2 py-2">Name</th><th className="px-2 py-2">Str</th>
                {subjects.map((s) => <th key={s.subjectId} className="px-2 py-2 text-center" title={s.subjectName}>{S(s.code || s.subjectName).slice(0, 5)}</th>)}
                <th className="px-2 py-2 text-center">SBJ</th><th className="px-2 py-2 text-center">TOT</th>
                <th className="px-2 py-2 text-center">MN</th><th className="px-2 py-2 text-center">DEV</th><th className="px-2 py-2 text-center">GR</th>
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
                    {subjects.map((s) => {
                      const cell = scores[s.subjectId];
                      return <td key={s.subjectId} className="px-2 py-2 text-center">{cell ? (cell.missing ? '–' : cell.isAbsent ? 'ABS' : `${Math.round(N(cell.score))} ${S(cell.grade)}`) : ''}</td>;
                    })}
                    <td className="px-2 py-2 text-center">{N(r.subjectCount)}</td>
                    <td className="px-2 py-2 text-center font-bold">{N(r.total)}</td>
                    <td className="px-2 py-2 text-center">{N(r.mean)}</td>
                    <td className={`px-2 py-2 text-center ${N(dev) < 0 ? 'text-ks-rose' : 'text-ks-emerald'}`}>{N(dev) > 0 ? '+' : ''}{Math.round(N(dev) * 10) / 10}</td>
                    <td className="px-2 py-2 text-center"><Badge tone={statusTone('')}>{S(r.overallGrade)}</Badge></td>
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
  const section = (title: string, first: string, recs: any[]) => (
    <Card className="overflow-hidden">
      <div className="border-b border-ks-line bg-ks-paper px-4 py-2 text-sm font-bold text-ks-navy">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-left text-ks-muted"><tr>
            <th className="px-3 py-2">{first}</th>{gradeCodes.map((g) => <th key={g} className="px-2 py-2 text-center">{g}</th>)}
            <th className="px-2 py-2 text-center">Entries</th><th className="px-2 py-2 text-center">Mean</th><th className="px-2 py-2 text-center">Grade</th>
          </tr></thead>
          <tbody className="divide-y divide-ks-line">
            {recs.map((rec, i) => (
              <tr key={i}>
                <td className="px-3 py-2 font-semibold text-ks-navy">{S(rec.className ? `${rec.className} ${S(rec.stream)}`.trim() : rec.subjectName ?? rec.gender)}</td>
                {gradeCodes.map((g) => <td key={g} className="px-2 py-2 text-center">{N((rec.distribution ?? {})[g])}</td>)}
                <td className="px-2 py-2 text-center">{N(rec.entries)}</td><td className="px-2 py-2 text-center">{N(rec.meanMarks)}</td>
                <td className="px-2 py-2 text-center font-bold">{S(rec.grade ?? '')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {section('By Stream', 'Class', summaries.byStream ?? [])}
      {section('By Subject', 'Subject', summaries.bySubject ?? [])}
      {section('By Gender', 'Gender', summaries.byGender ?? [])}
    </div>
  );
}

function EditRequestsPanel({ windowId }: { windowId: string }) {
  const reqs = useEditRequests({ examWindowId: windowId });
  const decide = useDecideEditRequest();
  return (
    <div className="space-y-3">
      {reqs.isLoading && <Card className="p-6 text-center text-ks-muted">Loading…</Card>}
      {reqs.data && reqs.data.length === 0 && <EmptyState title="No edit requests" message="Teachers can request to edit locked results; approvals appear here." />}
      {(reqs.data ?? []).map((r) => (
        <Card key={S(r.id)} className="flex flex-wrap items-center gap-3 p-4">
          <Badge tone={statusTone(S(r.status))}>{S(r.status)}</Badge>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ks-navy">{S(r.reason)}</p>
            <p className="text-xs text-ks-muted">by {S(r.requestedByRole)} · {S(r.requestedById).slice(0, 8)}</p>
          </div>
          {S(r.status) === 'REQUESTED' && (
            <div className="flex gap-2">
              <Button variant="success" onClick={() => decide.mutate({ id: S(r.id), decision: 'grant' })} loading={decide.isPending}><Unlock className="h-4 w-4" /> Grant</Button>
              <Button variant="danger" onClick={() => decide.mutate({ id: S(r.id), decision: 'reject' })} loading={decide.isPending}><XCircle className="h-4 w-4" /> Reject</Button>
            </div>
          )}
        </Card>
      ))}
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

  const submit = async () => {
    if (!form.name || !form.code) return;
    await create.mutateAsync({ name: form.name, code: form.code, defaultWeight: N(form.defaultWeight, 100), educationStage: form.educationStage || undefined });
    setForm({ defaultWeight: 100 });
  };

  return (
    <div>
      <Link to="/exams" className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-ks-blue"><ArrowLeft className="h-4 w-4" /> Windows</Link>
      <WorkspaceHeader
        title="Exam Types"
        description="The catalogue of exam types (Weekly, Monthly, Midterm, Terminal…). The weight is used when composing report cards."
        action={<Button variant="secondary" onClick={async () => { const r: any = await migrate.mutateAsync(); setMsg(`Imported ${N(r?.created)} type(s) from legacy assessment types.`); }} loading={migrate.isPending}><RefreshCw className="h-4 w-4" /> Import legacy</Button>}
      />
      {msg && <div className="mb-4"><Banner tone="emerald">{msg}</Banner></div>}

      <Card className="mb-6 p-5">
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="Name"><input className={inputCls} value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} placeholder="Terminal Exam" /></Field>
          <Field label="Code"><input className={inputCls} value={form.code ?? ''} onChange={(e) => set('code', e.target.value)} placeholder="TERM" /></Field>
          <Field label="Weight %"><input className={inputCls} type="number" value={form.defaultWeight ?? 100} onChange={(e) => set('defaultWeight', e.target.value)} /></Field>
          <div className="flex items-end"><Button onClick={submit} loading={create.isPending} disabled={!form.name || !form.code}><Plus className="h-4 w-4" /> Add type</Button></div>
        </div>
        {create.isError && <div className="mt-3"><Banner tone="rose">{S((create.error as any)?.message)}</Banner></div>}
      </Card>

      {types.isLoading && <Card className="p-6 text-center text-ks-muted">Loading…</Card>}
      {types.data && types.data.length === 0 && <EmptyState title="No exam types" message="Add one above, or import from legacy assessment types." />}
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

  const toggle = (w: any) => setSelected((s) => { const n = { ...s }; if (n[w.id] != null) delete n[w.id]; else n[w.id] = N(w.weight, 100); return n; });
  const canCompose = year && term && Object.keys(selected).length > 0;

  const submit = async () => {
    setResult(null);
    const body = {
      academicYearId: year, termId: term, scopeLevel: scopeLevel ? Number(scopeLevel) : undefined, publish,
      windows: Object.entries(selected).map(([examWindowId, weight]) => ({ examWindowId, weight })),
    };
    const res = await compose.mutateAsync(body);
    setResult(res);
  };

  return (
    <div>
      <Link to="/exams" className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-ks-blue"><ArrowLeft className="h-4 w-4" /> Windows</Link>
      <WorkspaceHeader title="Compose Report Cards" description="Choose which exam windows make up the term report card and how much each weighs." />

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
        </Banner>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TEACHER: open windows
// ═══════════════════════════════════════════════════════════════════════════
export function TeacherExamWindowsPage() {
  const windows = useTeacherExamWindows();
  return (
    <div>
      <WorkspaceHeader title="Exam Windows" description="Open exams awaiting your marks. Download a template or enter marks on screen." />
      {windows.isLoading && <Card className="p-8 text-center text-ks-muted">Loading…</Card>}
      {windows.isError && <ErrorState title="Could not load" message={S((windows.error as any)?.message)} onRetry={() => windows.refetch()} />}
      {windows.data && windows.data.length === 0 && <EmptyState title="No open exam windows" message="When an exam window is opened for your class, it will appear here." />}
      <div className="grid gap-4 md:grid-cols-2">
        {(windows.data ?? []).map((w) => (
          <Card key={S(w.id)} className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <div><h3 className="font-display text-lg font-bold text-ks-navy">{S(w.name)}</h3><p className="text-xs text-ks-muted">{S((w.examType as any)?.name)}</p></div>
              <Badge tone={statusTone(S(w.status))}>{S(w.status)}</Badge>
            </div>
            <div className="space-y-2">
              {((w.mySubjects ?? []) as any[]).map((s) => (
                <Link key={S(s.assessmentId)} to={`/teacher/exams/marks/${S(s.assessmentId)}`}
                  className="flex items-center justify-between rounded-lg border border-ks-line p-3 hover:border-ks-blue hover:bg-ks-blue/5">
                  <div><span className="font-semibold text-ks-navy">{S(s.subjectName)}</span></div>
                  <div className="flex items-center gap-2 text-xs text-ks-muted">
                    <span>{N(s.marksEntered)} entered</span><Badge tone={S(s.status) === 'LOCKED' ? 'emerald' : S(s.status) === 'SUBMITTED' ? 'amber' : 'blue'}>{S(s.status)}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        ))}
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
  const upload = useUploadMarks();
  const submit = useSubmitAssessment();
  const editReq = useCreateEditRequest();
  const [rows, setRows] = useState<Record<string, { score: string; isAbsent: boolean }>>({});
  const [result, setResult] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [showReq, setShowReq] = useState(false);

  const data = tpl.data as any;
  const assessment = data?.assessment;
  const maxScore = N(assessment?.maxScore, 100);
  const status = S(assessment?.status);
  const locked = ['LOCKED', 'SUBMITTED', 'HOD_APPROVED', 'APPROVED'].includes(status);

  // Seed the grid ONCE per assessment when the template loads. Using a ref guard
  // (not the raw data reference) prevents React Query's re-fetches from wiping
  // the teacher's in-progress edits.
  const seededRef = useRef('');
  useEffect(() => {
    if (data?.rows && seededRef.current !== assessmentId) {
      seededRef.current = assessmentId;
      const seed: Record<string, { score: string; isAbsent: boolean }> = {};
      for (const r of data.rows as any[]) seed[S(r.registrationNumber)] = { score: r.score === '' || r.score == null ? '' : String(r.score), isAbsent: !!r.isAbsent };
      setRows(seed);
    }
  }, [data, assessmentId]);

  const save = async (autoSubmit = false) => {
    setResult(null);
    const payload = (data?.rows as any[]).map((r, i) => {
      const local = rows[S(r.registrationNumber)] ?? { score: '', isAbsent: false };
      return { registrationNumber: S(r.registrationNumber), score: local.isAbsent ? undefined : (local.score === '' ? '' : Number(local.score)), isAbsent: local.isAbsent, row: i + 2 };
    });
    const res = await upload.mutateAsync({ assessmentId, rows: payload, autoSubmit });
    setResult(res);
  };

  if (tpl.isLoading) return <Card className="p-8 text-center text-ks-muted">Loading marks sheet…</Card>;
  if (tpl.isError || !data) return <ErrorState title="Could not load" message={S((tpl.error as any)?.message)} onRetry={() => tpl.refetch()} />;

  return (
    <div>
      <Link to="/teacher/exams" className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-ks-blue"><ArrowLeft className="h-4 w-4" /> My exam windows</Link>
      <WorkspaceHeader
        title={`${S(assessment?.subjectName)} — Marks`}
        description={`${S(assessment?.examWindow?.name)} · out of ${maxScore}`}
        action={<Badge tone={statusTone(status === 'OPEN' ? 'OPEN' : status)}>{status}</Badge>}
      />

      <Card className="mb-4 flex flex-wrap items-center gap-2 p-4">
        <Button variant="secondary" onClick={() => downloadMarksTemplateCsv(assessmentId)}><Download className="h-4 w-4" /> Download template</Button>
        {!locked && <><Button onClick={() => save(false)} loading={upload.isPending}><Upload className="h-4 w-4" /> Save marks</Button>
          <Button variant="success" onClick={() => save(true)} loading={upload.isPending}><Send className="h-4 w-4" /> Save & submit</Button></>}
        {locked && <Button variant="secondary" onClick={() => setShowReq((v) => !v)}><Unlock className="h-4 w-4" /> Request edit</Button>}
        <span className="ml-auto text-xs text-ks-muted">{N(data.rosterSize)} students</span>
      </Card>

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
          <Banner tone={(result.errors?.length ?? 0) > 0 ? 'amber' : 'emerald'}>
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

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ks-paper text-left text-[11px] uppercase tracking-wider text-ks-muted">
              <tr><th className="px-4 py-3">ADMNO</th><th className="px-4 py-3">Student</th><th className="px-4 py-3 w-32">Score</th><th className="px-4 py-3">Absent</th></tr>
            </thead>
            <tbody className="divide-y divide-ks-line">
              {(data.rows as any[]).map((r) => {
                const reg = S(r.registrationNumber);
                const local = rows[reg] ?? { score: '', isAbsent: false };
                return (
                  <tr key={reg}>
                    <td className="px-4 py-2 text-ks-muted">{reg}</td>
                    <td className="px-4 py-2 font-semibold text-ks-navy">{S(r.studentName)}</td>
                    <td className="px-4 py-2">
                      <input type="number" min={0} max={maxScore} disabled={locked || local.isAbsent} value={local.score}
                        onChange={(e) => setRows((s) => ({ ...s, [reg]: { ...local, score: e.target.value } }))}
                        className="w-24 rounded border border-ks-line px-2 py-1 disabled:bg-ks-mist/20" />
                    </td>
                    <td className="px-4 py-2">
                      <input type="checkbox" disabled={locked} checked={local.isAbsent}
                        onChange={(e) => setRows((s) => ({ ...s, [reg]: { ...local, isAbsent: e.target.checked } }))} />
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
