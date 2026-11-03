import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, EyeOff, PlusCircle, RotateCcw, Users } from 'lucide-react';
import { Button } from '../../../components/common/Button';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorState } from '../../../components/common/ErrorState';
import { errorMessage } from '../../../lib/api/errors';
import { useOmitSubject, useRemoveStandingRule, useRestoreSubject, useSyncSubjects, useWindowPlan } from '../api/examHooks';
import type { PlanSubject, WindowPlan } from '../api/examHooks';

const inputCls = 'rounded-lg border border-ks-line px-3 py-2 text-sm focus:border-ks-blue focus:outline-none';
type Entry = { required?: number; entered?: number };

function Stat({ label, value, tone = 'text-ks-navy' }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border border-ks-line bg-white p-4">
      <p className="text-[11px] font-black uppercase tracking-wider text-ks-muted">{label}</p>
      <p className={`mt-1 font-display text-3xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}

function EntryBar({ entry }: { entry?: Entry }) {
  const required = entry?.required ?? 0;
  const entered = entry?.entered ?? 0;
  if (!required) return <span className="text-xs text-ks-muted">—</span>;
  const pct = Math.min(100, Math.round((entered / required) * 100));
  return (
    <div className="min-w-[110px]">
      <div className="h-2 overflow-hidden rounded-full bg-ks-mist/60"><div className={`h-full ${entered >= required ? 'bg-ks-emerald' : 'bg-ks-blue'}`} style={{ width: `${pct}%` }} /></div>
      <div className="mt-1 text-[11px] font-semibold text-ks-muted">{entered}/{required} entered</div>
    </div>
  );
}

/** Dialog-style card: leave a subject out of the whole exam, or only some classes, and optionally school-wide. */
function OmitPanel({
  windowId, plan, subjectId, onClose, onDone,
}: { windowId: string; plan: WindowPlan; subjectId: string; onClose: () => void; onDone: (m: string) => void }) {
  const omit = useOmitSubject(windowId);
  const taughtIn = useMemo(
    () => plan.classes.map((c) => ({ classId: c.classId, label: c.label, subject: c.subjects.find((s) => s.subjectId === subjectId) })).filter((x) => x.subject && x.subject.state !== 'OMITTED'),
    [plan, subjectId],
  );
  const name = plan.subjects.find((s) => s.subjectId === subjectId)?.subjectName ?? 'Subject';
  const [scope, setScope] = useState<'ALL' | 'CHOSEN'>('ALL');
  const [chosen, setChosen] = useState<string[]>([]);
  const [reason, setReason] = useState('');
  const [everyWindow, setEveryWindow] = useState(false);
  const [error, setError] = useState('');
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const marks = taughtIn.reduce((t, x) => t + (x.subject?.marksEntered ?? 0), 0);

  const submit = async (discardMarks = false) => {
    setError('');
    try {
      const res = await omit.mutateAsync({ subjectId, classIds: scope === 'CHOSEN' ? chosen : [], reason, applyToAllWindows: everyWindow, discardMarks });
      onDone(`${name} left out of ${scope === 'ALL' ? 'every class in this exam' : `${chosen.length} class${chosen.length === 1 ? '' : 'es'}`}${res.sheetsRemoved ? ` · ${res.sheetsRemoved} marks sheet(s) removed${res.marksDiscarded ? `, ${res.marksDiscarded} mark(s) discarded` : ''}` : ''}${res.standingRule ? ' · saved as a school-wide rule' : ''}.`);
    } catch (e) {
      const msg = errorMessage(e, 'Could not omit the subject');
      setError(msg);
      setNeedsConfirm(/already been entered/i.test(msg));
    }
  };

  const valid = reason.trim().length >= 3 && (scope === 'ALL' || chosen.length > 0);
  return (
    <Card className="mb-5 border-ks-amber/40 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-ks-navy">Leave {name} out of this exam</h3>
          <p className="text-sm text-ks-muted">Teachers will not get a marks sheet for it, it will not be expected from students, and it will not appear in results or the merit list.</p>
        </div>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
      <div className="mt-4 space-y-3">
        <fieldset className="space-y-2">
          <legend className="text-sm font-bold text-ks-navy">Which classes?</legend>
          <label className="flex items-center gap-2 text-sm font-semibold text-ks-navy"><input type="radio" name="omit-scope" checked={scope === 'ALL'} onChange={() => setScope('ALL')} /> Every class in this exam ({taughtIn.length})</label>
          <label className="flex items-center gap-2 text-sm font-semibold text-ks-navy"><input type="radio" name="omit-scope" checked={scope === 'CHOSEN'} onChange={() => setScope('CHOSEN')} /> Only the classes I choose</label>
          {scope === 'CHOSEN' && (
            <div className="flex flex-wrap gap-2 pl-6">
              {taughtIn.map((x) => {
                const on = chosen.includes(x.classId);
                return (
                  <button key={x.classId} type="button" aria-pressed={on} onClick={() => setChosen((c) => (on ? c.filter((id) => id !== x.classId) : [...c, x.classId]))}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold ${on ? 'bg-ks-blue text-white' : 'bg-ks-mist/30 text-ks-navy hover:bg-ks-mist/60'}`}>{x.label}</button>
                );
              })}
            </div>
          )}
        </fieldset>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-bold text-ks-navy">Reason (kept in the audit trail)</span>
          <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Practical assessment only this term" />
        </label>
        <label className="flex items-start gap-2 text-sm font-semibold text-ks-navy">
          <input className="mt-1" type="checkbox" checked={everyWindow} onChange={(e) => setEveryWindow(e.target.checked)} />
          <span>Also leave it out of every exam window this school opens from now on<span className="block text-xs font-normal text-ks-muted">Saved as a school-wide rule. Exams that are already open are not changed, and you can remove the rule at any time.</span></span>
        </label>
        {marks > 0 && !needsConfirm && <p className="flex items-center gap-2 text-sm font-semibold text-[#7a5200]"><AlertTriangle className="h-4 w-4" /> {marks} mark(s) have already been entered for this subject. You will be asked to confirm before they are deleted.</p>}
        {error && <p className="rounded-lg border border-ks-rose/30 bg-ks-rose/5 px-3 py-2 text-sm font-semibold text-ks-rose" role="alert">{error}</p>}
        <div className="flex flex-wrap gap-2">
          {needsConfirm
            ? <Button variant="danger" loading={omit.isPending} onClick={() => submit(true)}>Yes, discard the marks and leave it out</Button>
            : <Button loading={omit.isPending} disabled={!valid} onClick={() => submit(false)}><EyeOff className="h-4 w-4" /> Leave it out</Button>}
        </div>
      </div>
    </Card>
  );
}

export function WindowPlanPanel({ windowId, status, entry }: { windowId: string; status: string; entry: Record<string, Entry & { status?: string }> }) {
  const planQ = useWindowPlan(windowId);
  const restore = useRestoreSubject(windowId);
  const removeRule = useRemoveStandingRule(windowId);
  const sync = useSyncSubjects(windowId);
  const [view, setView] = useState<'class' | 'subject'>('class');
  const [omitFor, setOmitFor] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  if (planQ.isLoading) return <Card className="p-8 text-center text-ks-muted">Loading the subjects and teachers…</Card>;
  if (planQ.isError || !planQ.data) return <ErrorState title="Could not load the preview" message={errorMessage(planQ.error, 'Try again')} onRetry={() => planQ.refetch()} />;
  const plan = planQ.data;
  if (!plan.classes.length) return <EmptyState title="No classes in scope" message="This exam's scope matches no classes. Edit the scope while the exam is still a draft." />;

  const act = async (fn: () => Promise<unknown>, ok: (r: any) => string) => {
    setErr(''); setMsg('');
    try { setMsg(ok(await fn())); } catch (e) { setErr(errorMessage(e, 'That did not work')); }
  };
  const stateBadge = (s: PlanSubject) => s.state === 'OMITTED'
    ? <Badge tone="slate">{s.exclusion?.source === 'STANDING' ? 'Left out · school rule' : 'Left out'}</Badge>
    : s.state === 'NOT_ADDED' ? <Badge tone="amber">Not added yet</Badge>
    : <Badge tone={plan.window.opened ? 'blue' : 'emerald'}>{plan.window.opened ? 'On the exam' : 'Will be included'}</Badge>;

  const rowActions = (s: PlanSubject) => {
    if (s.state === 'OMITTED' && s.exclusion) {
      if (!plan.editable) return null;
      return s.exclusion.source === 'STANDING'
        ? <button type="button" className="text-xs font-bold text-ks-blue hover:underline" onClick={() => act(() => removeRule.mutateAsync(s.exclusion!.id), () => 'School rule removed. Windows opened from now on will include it.')}>Remove school rule</button>
        : <button type="button" className="inline-flex items-center gap-1 text-xs font-bold text-ks-blue hover:underline" onClick={() => act(() => restore.mutateAsync(s.exclusion!.id), (r) => `Put back on the exam${r.sheetsAdded ? ` · ${r.sheetsAdded} marks sheet recreated` : ''}.`)}><RotateCcw className="h-3 w-3" /> Put back</button>;
    }
    if (!plan.editable) return null;
    return <button type="button" className="inline-flex items-center gap-1 text-xs font-bold text-ks-rose hover:underline" onClick={() => { setOmitFor(s.subjectId); setMsg(''); setErr(''); }}><EyeOff className="h-3 w-3" /> Leave out…</button>;
  };

  const s = plan.summary;
  return (
    <div className="space-y-4">
      <p className="text-sm text-ks-muted">
        {plan.window.opened
          ? 'This is what teachers are working on. Subjects you leave out disappear from their lists.'
          : 'This is what the exam will contain once you open it. Review the subjects and the teachers responsible, and leave out anything that should not be examined.'}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Classes" value={s.classes} />
        <Stat label="Subjects" value={s.subjects} />
        <Stat label="Marks sheets" value={s.marksSheets} tone="text-ks-blue" />
        <Stat label="Teachers" value={s.teachers} />
        <Stat label="Left out" value={s.omitted} tone={s.omitted ? 'text-ks-amber' : 'text-ks-navy'} />
      </div>
      {plan.warnings.length > 0 && (
        <div className="rounded-lg border border-ks-amber/40 bg-ks-amber/5 px-4 py-3 text-sm font-semibold text-[#7a5200]" role="status">
          {plan.warnings.map((w) => <p key={w} className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" /> {w}</p>)}
        </div>
      )}
      {s.withoutTeacher > 0 && <div className="rounded-lg border border-ks-rose/30 bg-ks-rose/5 px-4 py-3 text-sm font-semibold text-ks-rose">{s.withoutTeacher} marks sheet(s) have no teacher on record. Assign a teacher in Academic Setup before opening.</div>}
      {!plan.editable && <div className="rounded-lg border border-ks-line bg-ks-paper px-4 py-3 text-sm font-semibold text-ks-navy">Results for this exam are already calculated ({status}). To change its subjects, reopen it for corrections first.</div>}
      {msg && <div className="rounded-lg border border-ks-emerald/30 bg-ks-emerald/10 px-4 py-3 text-sm font-semibold text-ks-emerald" role="status">{msg}</div>}
      {err && <div className="rounded-lg border border-ks-rose/30 bg-ks-rose/5 px-4 py-3 text-sm font-semibold text-ks-rose" role="alert">{err}</div>}

      {omitFor && <OmitPanel key={omitFor} windowId={windowId} plan={plan} subjectId={omitFor} onClose={() => setOmitFor(null)} onDone={(m) => { setOmitFor(null); setMsg(m); }} />}

      <div className="flex flex-wrap items-center gap-2">
        {(['class', 'subject'] as const).map((v) => (
          <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${view === v ? 'bg-ks-blue text-white' : 'bg-ks-mist/30 text-ks-navy'}`}>{v === 'class' ? 'By class' : 'By subject'}</button>
        ))}
        {s.notAdded > 0 && plan.editable && (
          <Button variant="secondary" className="ml-auto" loading={sync.isPending} onClick={() => act(() => sync.mutateAsync(), (r) => `${r.assessmentsCreated} marks sheet(s) added for subjects assigned after the exam opened.`)}>
            <PlusCircle className="h-4 w-4" /> Add {s.notAdded} new subject{s.notAdded === 1 ? '' : 's'} to the exam
          </Button>
        )}
      </div>

      {view === 'class' && plan.classes.map((c) => {
        const out = c.subjects.filter((x) => x.state === 'OMITTED').length;
        return (
          <Card key={c.classId} className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b border-ks-line bg-ks-paper px-4 py-3">
              <h3 className="font-display text-base font-bold text-ks-navy">{c.label}</h3>
              <span className="flex items-center gap-1 text-xs text-ks-muted"><Users className="h-3.5 w-3.5" /> {c.studentCount} students</span>
              <span className="text-xs text-ks-muted">{c.subjects.length - out} on the exam{out ? ` · ${out} left out` : ''}</span>
            </div>
            {c.subjects.length === 0 ? <p className="px-4 py-3 text-sm text-ks-muted">No subjects are assigned to this class.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-[11px] uppercase tracking-wider text-ks-muted"><tr><th className="px-4 py-2">Subject</th><th className="px-4 py-2">Teacher</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Marks</th><th className="px-4 py-2" /></tr></thead>
                  <tbody className="divide-y divide-ks-line">
                    {c.subjects.map((sub) => (
                      <tr key={sub.classSubjectId} className={sub.state === 'OMITTED' ? 'bg-ks-mist/20 text-ks-muted' : ''}>
                        <td className="px-4 py-2 font-semibold text-ks-navy">{sub.subjectName}{sub.isOptional ? <span className="ml-1 text-[10px] font-bold uppercase text-ks-muted">optional</span> : null}{sub.combination ? <span className="ml-1 text-[10px] font-bold uppercase text-ks-muted">{sub.combination}</span> : null}</td>
                        <td className="px-4 py-2">{sub.teacherName ?? <span className="font-semibold text-ks-rose">No teacher</span>}</td>
                        <td className="px-4 py-2">{stateBadge(sub)}{sub.exclusion && <span className="mt-1 block max-w-[16rem] truncate text-[11px] text-ks-muted" title={sub.exclusion.reason}>{sub.exclusion.reason}{sub.exclusion.createdByName ? ` · ${sub.exclusion.createdByName}` : ''}</span>}</td>
                        <td className="px-4 py-2">{sub.assessmentId ? <EntryBar entry={entry[sub.assessmentId]} /> : <span className="text-xs text-ks-muted">—</span>}</td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex items-center justify-end gap-3">
                            {sub.assessmentId && (status === 'OPEN' || status === 'REOPENED') && ['OPEN', 'DRAFT', 'REJECTED', 'SUBMITTED'].includes(entry[sub.assessmentId]?.status ?? sub.assessmentStatus ?? '') && <Link to={`/exams/marks/${sub.assessmentId}`} className="text-xs font-bold text-ks-blue hover:underline">Enter marks →</Link>}
                            {rowActions(sub)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        );
      })}

      {view === 'subject' && (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-ks-paper text-left text-[11px] uppercase tracking-wider text-ks-muted"><tr><th className="px-4 py-3">Subject</th><th className="px-4 py-3">Classes</th><th className="px-4 py-3">Where it is</th><th className="px-4 py-3" /></tr></thead>
            <tbody className="divide-y divide-ks-line">
              {plan.subjects.map((sj) => {
                const where = plan.classes.map((c) => ({ c, s: c.subjects.find((x) => x.subjectId === sj.subjectId) })).filter((x) => x.s);
                return (
                  <tr key={sj.subjectId}>
                    <td className="px-4 py-3 font-semibold text-ks-navy">{sj.subjectName}</td>
                    <td className="px-4 py-3 text-ks-muted">{sj.included + sj.notAdded} of {sj.classes} on the exam{sj.omitted ? ` · ${sj.omitted} left out` : ''}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {where.map(({ c, s: x }) => (
                          <span key={c.classId} title={x!.teacherName ?? 'No teacher'} className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${x!.state === 'OMITTED' ? 'bg-ks-mist/50 text-ks-muted line-through' : 'bg-ks-blue/10 text-ks-blue'}`}>{c.label}{x!.teacherName ? ` · ${x!.teacherName}` : ''}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">{plan.editable && sj.included + sj.notAdded > 0 && <button type="button" className="inline-flex items-center gap-1 text-xs font-bold text-ks-rose hover:underline" onClick={() => { setOmitFor(sj.subjectId); setMsg(''); setErr(''); }}><EyeOff className="h-3 w-3" /> Leave out…</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {plan.standingRules.length > 0 && (
        <Card className="p-4">
          <h3 className="font-display text-base font-bold text-ks-navy">School-wide rules</h3>
          <p className="mb-2 text-xs text-ks-muted">Every new exam window starts without these subjects. Exams that are already open are not affected.</p>
          <ul className="divide-y divide-ks-line">
            {plan.standingRules.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className="font-semibold text-ks-navy">{r.subjectName ?? 'Subject'}</span>
                <span className="text-xs text-ks-muted">{r.className ?? 'every class'} · {r.reason}</span>
                <button type="button" className="ml-auto text-xs font-bold text-ks-blue hover:underline" onClick={() => act(() => removeRule.mutateAsync(r.id), () => 'School rule removed.')}>Remove rule</button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
