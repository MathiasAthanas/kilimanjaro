import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Eye, ShieldCheck, Undo2 } from 'lucide-react';
import { Button } from '../../../components/common/Button';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorState } from '../../../components/common/ErrorState';
import {
  useCreateExemption, useExemptions, usePreviewExemption, useRevokeExemption, useWindowReadiness,
} from '../api/readinessHooks';

const S = (v: unknown, d = '') => (v === null || v === undefined ? d : String(v));
const N = (v: unknown, d = 0) => (v === null || v === undefined || v === '' ? d : Number(v));
const inputCls = 'rounded-lg border border-ks-line px-3 py-2 text-sm focus:border-ks-blue focus:outline-none';

export const STATUS_STYLE: Record<string, { label: string; cell: string }> = {
  SCORED: { label: 'Scored', cell: 'bg-white text-ks-navy' },
  ABSENT: { label: 'Absent', cell: 'bg-ks-amber/15 text-[#7a5200]' },
  NOT_SAT: { label: 'Not sat', cell: 'bg-ks-amber/25 text-[#7a5200]' },
  MISSING: { label: 'Missing', cell: 'bg-ks-rose/15 text-ks-rose' },
  EXEMPT: { label: 'Exempt', cell: 'bg-ks-blue/10 text-ks-blue' },
};

function Chip({ status, count }: { status: string; count: number }) {
  const s = STATUS_STYLE[status];
  return (
    <div className={`rounded-lg border border-ks-line px-3 py-2 text-center ${s.cell}`}>
      <div className="text-lg font-extrabold">{count}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider">{s.label}</div>
    </div>
  );
}

function cellText(c: any): string {
  if (!c) return '';
  if (c.status === 'MISSING') return 'Missing';
  if (c.status === 'EXEMPT') return 'EXEMPT';
  if (c.status === 'NOT_SAT') return 'NOT SAT';
  if (c.status === 'ABSENT') return 'ABSENT';
  return `${Math.round(N(c.score) * 100) / 100}${c.maxScore && c.maxScore !== 100 ? `/${c.maxScore}` : ''} ${S(c.grade)}`.trim();
}

// ═══════════════════════════════════════════════════════════════════════════
// Readiness matrix: student × subject, one status per expected subject
// ═══════════════════════════════════════════════════════════════════════════
export function ReadinessPanel({
  windowId, status, onExempt,
}: {
  windowId: string;
  status: string;
  onExempt: (seed: { classId: string; subjectId: string; studentId: string }) => void;
}) {
  const q = useWindowReadiness(windowId);
  const [classId, setClassId] = useState('');
  const d = q.data;
  const classes = (d?.classes ?? []) as any[];
  const activeClass = classes.find((c) => c.classId === classId) ?? classes[0];
  const subjects = useMemo(() => {
    const ids = new Set<string>();
    (activeClass?.students ?? []).forEach((s: any) => Object.keys(s.cells ?? {}).forEach((k) => ids.add(k)));
    return ((d?.subjects ?? []) as any[]).filter((s) => ids.has(s.subjectId));
  }, [activeClass, d]);

  if (q.isLoading) return <Card className="p-8 text-center text-ks-muted">Checking every student and subject…</Card>;
  if (q.isError) return <ErrorState title="Could not load readiness" message={S((q.error as any)?.message)} onRetry={() => q.refetch()} />;
  if (!d) return null;
  const canExempt = status !== 'PUBLISHED' && status !== 'DRAFT';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Chip status="SCORED" count={N(d.counts.scored)} />
        <Chip status="ABSENT" count={N(d.counts.absent)} />
        <Chip status="NOT_SAT" count={N(d.counts.notSat)} />
        <Chip status="MISSING" count={N(d.counts.missing)} />
        <Chip status="EXEMPT" count={N(d.counts.exempt)} />
      </div>

      {d.blockers.length > 0 ? (
        <div className="rounded-lg border border-ks-rose/30 bg-ks-rose/5 p-4" role="alert">
          <div className="mb-1 flex items-center gap-2 text-sm font-extrabold text-ks-rose"><AlertTriangle className="h-4 w-4" /> Results cannot be calculated or closed yet</div>
          {d.blockers.map((b: any, i: number) => <p key={i} className="whitespace-pre-line text-sm text-ks-navy">{b.message}</p>)}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-ks-emerald/30 bg-ks-emerald/5 p-4 text-sm font-bold text-ks-emerald">
          <CheckCircle2 className="h-4 w-4" /> Every expected subject has a result. {status === 'OPEN' || status === 'REOPENED' ? 'This window is ready to close.' : ''}
        </div>
      )}
      {(d.warnings ?? []).map((w: string, i: number) => <p key={i} className="rounded-lg border border-ks-amber/30 bg-ks-amber/5 px-3 py-2 text-xs font-semibold text-[#7a5200]">{w}</p>)}

      {classes.length > 1 && (
        <select className={inputCls} value={activeClass?.classId ?? ''} onChange={(e) => setClassId(e.target.value)} aria-label="Class">
          {classes.map((c) => <option key={c.classId} value={c.classId}>{c.className}</option>)}
        </select>
      )}

      {!activeClass ? <EmptyState title="No students" message="No students are on the roster for this window." /> : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-ks-paper text-left text-[11px] uppercase tracking-wider text-ks-muted">
                <tr>
                  <th className="sticky left-0 bg-ks-paper px-3 py-2">Student</th>
                  {subjects.map((s) => <th key={s.subjectId} className="px-2 py-2 text-center" title={s.subjectName}>{S(s.code || s.subjectName).slice(0, 8)}</th>)}
                  <th className="px-2 py-2 text-center">Assessed</th><th className="px-2 py-2 text-center">Average</th><th className="px-2 py-2 text-center">Division</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ks-line">
                {(activeClass.students as any[]).map((st) => (
                  <tr key={st.studentId}>
                    <td className="sticky left-0 bg-white px-3 py-2"><div className="font-semibold text-ks-navy">{S(st.studentName)}</div><div className="text-[10px] text-ks-muted">{S(st.registrationNumber)}</div></td>
                    {subjects.map((s) => {
                      const c = st.cells?.[s.subjectId];
                      if (!c) return <td key={s.subjectId} className="px-2 py-2 text-center text-ks-muted" title="Not expected: the student does not take this subject">·</td>;
                      const style = STATUS_STYLE[c.status] ?? STATUS_STYLE.SCORED;
                      const displayOnly = c.countsTowardAggregate === false;
                      return (
                        <td key={s.subjectId} className={`px-2 py-2 text-center font-semibold ${displayOnly ? 'bg-ks-paper text-ks-muted' : style.cell}`} title={c.exemptReason ? `Exempt: ${c.exemptReason}` : displayOnly ? 'Shown for reference; excluded from total, average, rank and division' : style.label}>
                          {cellText(c)}{displayOnly ? '*' : ''}
                          {c.status === 'MISSING' && canExempt && (
                            <button type="button" className="mt-1 block w-full text-[10px] font-bold underline" onClick={() => onExempt({ classId: activeClass.classId, subjectId: s.subjectId, studentId: st.studentId })}>Exempt…</button>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 text-center">{N(st.subjectsAssessed)}/{N(st.subjectsExpected)}</td>
                    <td className="px-2 py-2 text-center font-bold">{N(st.mean)}</td>
                    <td className="px-2 py-2 text-center">{st.divisionEligible === false ? <Badge tone="amber">Ungraded</Badge> : `${S(st.division)}${st.divisionPoints !== null && st.divisionPoints !== undefined ? ` - ${N(st.divisionPoints)} pts` : ''}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <p className="text-xs text-ks-muted">A dot (·) means the student does not take that subject, so no mark or exemption is needed. A mark can be a score, <b>Absent</b> or <b>Not sat</b> (both count as 0%), or the subject can be <b>exempt</b> (excluded from the average). An asterisk (*) marks a displayed A-Level supporting subject that does not affect totals, averages, ranks or divisions.</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Exemption panel: create (with impact preview), list, revoke
// ═══════════════════════════════════════════════════════════════════════════
export function ExemptionsPanel({
  windowId, window: win, seed, onChanged,
}: {
  windowId: string;
  window: Record<string, any>;
  seed: { classId: string; subjectId: string; studentId: string } | null;
  onChanged: (msg: string) => void;
}) {
  const readiness = useWindowReadiness(windowId);
  const list = useExemptions({ termId: S(win.termId), academicYearId: S(win.academicYearId) });
  const preview = usePreviewExemption();
  const create = useCreateExemption();
  const revoke = useRevokeExemption();

  const classes = (readiness.data?.classes ?? []) as any[];
  const subjects = (readiness.data?.subjects ?? []) as any[];
  const published = S(win.status) === 'PUBLISHED';
  const applyHint = ['OPEN', 'DRAFT'].includes(S(win.status)) ? 'It takes effect when the window is closed.' : 'Recalculate the window to apply it.';

  const [classId, setClassId] = useState(seed?.classId ?? '');
  const [subjectId, setSubjectId] = useState(seed?.subjectId ?? '');
  const [scope, setScope] = useState<'STUDENT' | 'CLASS'>('STUDENT');
  const [duration, setDuration] = useState<'WINDOW' | 'TERM'>('WINDOW');
  const [studentIds, setStudentIds] = useState<string[]>(seed ? [seed.studentId] : []);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const [pv, setPv] = useState<any>(null);

  const activeClass = classes.find((c) => c.classId === (classId || classes[0]?.classId));
  const effectiveClassId = activeClass?.classId ?? '';
  const classSubjects = subjects.filter((s) => (activeClass?.students ?? []).some((st: any) => st.cells?.[s.subjectId]));

  const body = () => ({
    academicYearId: S(win.academicYearId),
    termId: S(win.termId),
    examWindowId: duration === 'WINDOW' ? windowId : undefined,
    classId: effectiveClassId,
    subjectId,
    scope,
    studentIds: scope === 'STUDENT' ? studentIds : undefined,
    reason: reason.trim() || undefined,
  });
  const ready = !!effectiveClassId && !!subjectId && (scope === 'CLASS' || studentIds.length > 0);

  const doPreview = async () => {
    setErr(''); setPv(null);
    try { setPv(await preview.mutateAsync(body())); } catch (e: any) { setErr(S(e?.message, 'Preview failed')); }
  };
  const doApply = async () => {
    setErr('');
    try {
      const res = await create.mutateAsync(body());
      setPv(null); setReason(''); setStudentIds([]);
      onChanged(`Exemption approved for ${N(res?.created)} ${scope === 'CLASS' ? 'class' : 'student(s)'}. ${applyHint}`);
    } catch (e: any) { setErr(S(e?.message, 'Could not create the exemption')); }
  };

  const allRows: any[] = (pv?.windows ?? []).flatMap((w: any) => w.students.map((s: any) => ({ ...s, windowName: w.windowName })));
  const subjectName = (id: string) => S(subjects.find((s) => s.subjectId === id)?.subjectName, id.slice(0, 8));
  const className = (id: string) => S(classes.find((c) => c.classId === id)?.className, id.slice(0, 8));
  const studentName = (id: string | null) => {
    if (!id) return 'Whole class';
    for (const c of classes) { const st = (c.students as any[]).find((s) => s.studentId === id); if (st) return S(st.studentName); }
    return id.slice(0, 8);
  };

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-ks-blue" /><h3 className="font-display text-lg font-bold text-ks-navy">Approve an exemption</h3></div>
        {published && <p className="mb-3 rounded-lg border border-ks-amber/30 bg-ks-amber/5 p-3 text-sm font-semibold text-[#7a5200]">This window is published. Unpublish it (or have an edit request approved) before changing exemptions.</p>}
        <p className="mb-4 text-sm text-ks-muted">An exempt subject is shown as EXEMPT and excluded from the average, ranking and points. Existing marks are kept but ignored. Use <b>Absent / Not sat</b> instead when the student should score 0.</p>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm"><span className="font-bold text-ks-navy">Class</span>
            <select className={inputCls} value={effectiveClassId} onChange={(e) => { setClassId(e.target.value); setStudentIds([]); setPv(null); }}>
              {classes.map((c) => <option key={c.classId} value={c.classId}>{c.className}</option>)}
            </select></label>
          <label className="flex flex-col gap-1 text-sm"><span className="font-bold text-ks-navy">Subject</span>
            <select className={inputCls} value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setPv(null); }}>
              <option value="">Select…</option>
              {classSubjects.map((s) => <option key={s.subjectId} value={s.subjectId}>{s.subjectName}</option>)}
            </select></label>
          <label className="flex flex-col gap-1 text-sm"><span className="font-bold text-ks-navy">Applies to</span>
            <select className={inputCls} value={scope} onChange={(e) => { setScope(e.target.value as 'STUDENT' | 'CLASS'); setPv(null); }}>
              <option value="STUDENT">Selected student(s)</option>
              <option value="CLASS">Entire class</option>
            </select></label>
          <label className="flex flex-col gap-1 text-sm"><span className="font-bold text-ks-navy">Duration</span>
            <select className={inputCls} value={duration} onChange={(e) => { setDuration(e.target.value as 'WINDOW' | 'TERM'); setPv(null); }}>
              <option value="WINDOW">This exam window only</option>
              <option value="TERM">Entire term (every window)</option>
            </select></label>
          <label className="flex flex-col gap-1 text-sm md:col-span-2"><span className="font-bold text-ks-navy">Reason (required, kept in the audit trail)</span>
            <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Medical certificate on file / subject not taught this term" /></label>
        </div>

        {scope === 'STUDENT' && (
          <div className="mt-4">
            <span className="text-sm font-bold text-ks-navy">Students ({studentIds.length} selected)</span>
            <div className="mt-2 grid max-h-48 gap-1 overflow-y-auto rounded-lg border border-ks-line p-2 sm:grid-cols-2 lg:grid-cols-3">
              {(activeClass?.students ?? []).filter((st: any) => !subjectId || st.cells?.[subjectId]).map((st: any) => (
                <label key={st.studentId} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={studentIds.includes(st.studentId)} onChange={(e) => { setPv(null); setStudentIds((cur) => e.target.checked ? [...cur, st.studentId] : cur.filter((x) => x !== st.studentId)); }} />
                  <span>{S(st.studentName)} <span className="text-[10px] text-ks-muted">{S(st.registrationNumber)}</span></span>
                </label>
              ))}
            </div>
          </div>
        )}

        {err && <p className="mt-3 rounded-lg border border-ks-rose/30 bg-ks-rose/10 px-3 py-2 text-sm font-semibold text-ks-rose" role="alert">{err}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={doPreview} disabled={!ready || published} loading={preview.isPending}><Eye className="h-4 w-4" /> Preview impact</Button>
          <Button onClick={doApply} disabled={!ready || published || !pv || reason.trim().length < 5} loading={create.isPending}><ShieldCheck className="h-4 w-4" /> Approve exemption</Button>
          {pv && reason.trim().length < 5 && <span className="self-center text-xs font-semibold text-ks-rose">Add a reason to approve.</span>}
          {!pv && ready && <span className="self-center text-xs text-ks-muted">Preview the impact first, then approve.</span>}
        </div>

        {pv && (
          <div className="mt-4 rounded-lg border border-ks-line bg-ks-paper/50 p-4">
            <p className="text-sm font-bold text-ks-navy">
              {N(pv.studentsAffected)} student{N(pv.studentsAffected) === 1 ? '' : 's'} affected · {subjectName(subjectId)} · {pv.term === 'ENTIRE_TERM' ? 'entire term' : 'this window'}
              {N(pv.ungradedAfter) > 0 && <span className="ml-2 text-ks-amber">· {N(pv.ungradedAfter)} would become Ungraded (too few eligible subjects)</span>}
            </p>
            {pv.publishedWarning && <p className="mt-1 text-xs font-semibold text-ks-rose">{pv.publishedWarning}</p>}
            <div className="mt-2 max-h-64 overflow-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-ks-muted"><tr><th className="py-1 pr-3">Student</th><th className="pr-3">Currently</th><th className="pr-3">Average</th><th className="pr-3">Subjects</th><th>Division</th></tr></thead>
                <tbody className="divide-y divide-ks-line">
                  {allRows.map((r, i) => (
                    <tr key={i}>
                      <td className="py-1 pr-3 font-semibold text-ks-navy">{S(r.studentName)}</td>
                      <td className="pr-3">{S(r.subjectStatusBefore, '—')}{r.preservedScore != null && r.subjectStatusBefore !== 'EXEMPT' ? ` (${r.preservedScore} kept)` : ''}</td>
                      <td className="pr-3">{N(r.averageBefore)}% → <b>{N(r.averageAfter)}%</b></td>
                      <td className="pr-3">{N(r.subjectsAssessedBefore)} → <b>{N(r.subjectsAssessedAfter)}</b></td>
                      <td>{S(r.divisionBefore)}{r.divisionPointsBefore != null ? ` - ${N(r.divisionPointsBefore)} pts` : ''} → <b className={r.becomesUngraded ? 'text-ks-amber' : ''}>{S(r.divisionAfter)}{r.divisionPointsAfter != null ? ` - ${N(r.divisionPointsAfter)} pts` : ''}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-ks-line bg-ks-paper px-4 py-2 text-sm font-bold text-ks-navy">Exemptions in this term</div>
        {list.isLoading && <p className="p-4 text-sm text-ks-muted">Loading…</p>}
        {list.data && list.data.length === 0 && <p className="p-4 text-sm text-ks-muted">No exemptions have been approved for this term.</p>}
        {(list.data ?? []).length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-ks-muted"><tr><th className="px-3 py-2">Who</th><th className="px-3">Class</th><th className="px-3">Subject</th><th className="px-3">Duration</th><th className="px-3">Reason</th><th className="px-3">Status</th><th className="px-3">Approved</th><th /></tr></thead>
              <tbody className="divide-y divide-ks-line">
                {(list.data ?? []).map((e) => (
                  <tr key={S(e.id)}>
                    <td className="px-3 py-2 font-semibold text-ks-navy">{studentName(e.studentId)}</td>
                    <td className="px-3">{className(e.classId)}</td>
                    <td className="px-3">{subjectName(e.subjectId)}</td>
                    <td className="px-3">{e.examWindowId ? (e.examWindowId === windowId ? 'This window' : 'Another window') : 'Entire term'}</td>
                    <td className="px-3">{S(e.reason)}</td>
                    <td className="px-3"><Badge tone={e.status === 'APPROVED' ? 'emerald' : 'slate'}>{S(e.status)}</Badge></td>
                    <td className="px-3 text-ks-muted">{e.approvedAt ? new Date(e.approvedAt).toLocaleDateString() : '—'}</td>
                    <td className="px-3 py-2 text-right">
                      {e.status === 'APPROVED' && !published && (
                        <Button variant="ghost" onClick={async () => { try { await revoke.mutateAsync({ id: S(e.id), reason: 'Revoked from exam window' }); onChanged(`Exemption revoked. ${applyHint}`); } catch (x: any) { setErr(S(x?.message)); } }} loading={revoke.isPending}><Undo2 className="h-3.5 w-3.5" /> Revoke</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
