import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, FileSpreadsheet, FileText, Users } from 'lucide-react';
import { Button } from '../../../components/common/Button';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';
import { EmptyState } from '../../../components/common/EmptyState';
import { ErrorState } from '../../../components/common/ErrorState';
import { WorkspaceHeader } from '../../../components/layout/WorkspaceHeader';
import { formatClassLabel } from '../../../lib/classLabel';
import { useEditRequests, useExamReference, useExamWindows } from '../api/examHooks';
import { downloadPerformanceExport, usePerformancePreview } from '../api/readinessHooks';
import { EditRequestCard, ExamTaskNavigation } from './ExamPages';

const S = (v: unknown, d = '') => (v === null || v === undefined ? d : String(v));
const N = (v: unknown, d = 0) => (v === null || v === undefined || v === '' ? d : Number(v));
const inputCls = 'rounded-lg border border-ks-line px-3 py-2 text-sm focus:border-ks-blue focus:outline-none';

// ═══════════════════════════════════════════════════════════════════════════
// Edit-request inbox (Head of Department + administrators)
// ═══════════════════════════════════════════════════════════════════════════
export function ExamEditRequestsPage() {
  const [status, setStatus] = useState('REQUESTED');
  const reqs = useEditRequests({ status: status || undefined });
  const pending = (reqs.data ?? []).length;
  return (
    <div>
      <WorkspaceHeader
        title="Edit requests"
        description="Marks are locked when a window closes and when results are published. A teacher asks for permission here, and a Head of Department or administrator approves it."
      />
      <ExamTaskNavigation active="requests" />
      <ol className="mb-4 grid gap-2 text-xs font-semibold text-ks-navy sm:grid-cols-4">
        {['1. Teacher asks, with a reason', '2. You approve: results are unpublished and the subject unlocks', '3. Teacher corrects the marks and clicks Finish editing', '4. Admin uses Close & republish on the exam window'].map((t) => (
          <li key={t} className="rounded-lg border border-ks-line bg-ks-paper/40 px-3 py-2">{t}</li>
        ))}
      </ol>
      <div className="mb-4 flex flex-wrap gap-2">
        {[['REQUESTED', 'Waiting'], ['GRANTED', 'Approved (editing)'], ['COMPLETED', 'Edited, awaiting republish'], ['REPUBLISHED', 'Republished'], ['REJECTED', 'Declined'], ['', 'All']].map(([v, l]) => (
          <button key={v} onClick={() => setStatus(v)} className={`rounded-lg px-3 py-1.5 text-sm font-bold ${status === v ? 'bg-ks-blue text-white' : 'bg-ks-mist/30 text-ks-navy hover:bg-ks-mist/60'}`}>{l}</button>
        ))}
      </div>
      {reqs.isLoading && <Card className="p-6 text-center text-ks-muted">Loading…</Card>}
      {reqs.isError && <ErrorState title="Could not load requests" message={S((reqs.error as any)?.message)} onRetry={() => reqs.refetch()} />}
      {reqs.data && pending === 0 && <EmptyState title="Nothing here" message={status === 'REQUESTED' ? 'No teacher is waiting for permission.' : 'No requests with this status.'} />}
      <div className="space-y-3">
        {(reqs.data ?? []).map((r) => (
          <div key={S(r.id)}>
            <EditRequestCard r={r} showWindow />
            {(S(r.status) === 'COMPLETED' || S(r.status) === 'GRANTED') && (
              <p className="mt-1 text-xs text-ks-muted">Next step: open <Link className="font-bold text-ks-blue" to={`/exams/${S(r.examWindowId)}`}>the exam window</Link> and use <b>Close &amp; republish</b> once all corrections are in.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Student lists & performance export
// ═══════════════════════════════════════════════════════════════════════════
type Source = 'WINDOW' | 'TERM' | 'ROSTER';

export function ExamPerformancePage() {
  const ref = useExamReference();
  const [year, setYear] = useState('');
  const [term, setTerm] = useState('');
  const [source, setSource] = useState<Source>('WINDOW');
  const [windowId, setWindowId] = useState('');
  const [standard, setStandard] = useState('');
  const [classId, setClassId] = useState('');
  const [dl, setDl] = useState('');
  const [dlErr, setDlErr] = useState('');
  const [tab, setTab] = useState<Record<string, string>>({});

  const windows = useExamWindows({ academicYearId: year || undefined, termId: term || undefined });
  const usable = (windows.data ?? []).filter((w) => ['CLOSED', 'PUBLISHED', 'REOPENED'].includes(S(w.status)));
  const terms = (ref.data?.terms ?? []).filter((t: any) => !year || t.academicYearId === year);

  // Standards = unique (stage, level); streams = classes inside the chosen standard.
  const classes = (ref.data?.classes ?? []).filter((c: any) => !year || c.academicYearId === year) as any[];
  const standards = useMemo(() => {
    const map = new Map<string, { key: string; label: string; stage: string; level: number }>();
    classes.forEach((c) => { if (c.level != null) map.set(`${c.educationStage}:${c.level}`, { key: `${c.educationStage}:${c.level}`, label: S(c.name).replace(/\s+[A-Z]$/, ''), stage: c.educationStage, level: c.level }); });
    return [...map.values()].sort((a, b) => a.stage.localeCompare(b.stage) || a.level - b.level);
  }, [classes]);
  const streams = classes.filter((c) => standard && `${c.educationStage}:${c.level}` === standard);

  const params = {
    academicYearId: year || undefined,
    termId: source === 'TERM' ? term || undefined : undefined,
    examWindowId: source === 'WINDOW' ? windowId || undefined : undefined,
    level: standard ? standard.split(':')[1] : undefined,
    educationStage: standard ? standard.split(':')[0] : undefined,
    classId: classId || undefined,
  };
  const ready = source === 'WINDOW' ? !!windowId : source === 'TERM' ? !!term : !!year;
  const preview = usePerformancePreview(params, ready);
  const report = preview.data as any;

  const doDownload = async (fmt: 'xlsx' | 'pdf' | 'csv') => {
    setDl(fmt); setDlErr('');
    try { await downloadPerformanceExport(fmt, params); } catch (e: any) { setDlErr(S(e?.message, 'Download failed')); } finally { setDl(''); }
  };

  return (
    <div>
      <WorkspaceHeader title="Student lists & performance" description="Download class and stream lists with each student's performance, ranked from highest to lowest. Pick what to rank, then choose a format." />
      <ExamTaskNavigation active="performance" />

      <Card className="mb-5 p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm"><span className="font-bold text-ks-navy">Academic year</span>
            <select className={inputCls} value={year} onChange={(e) => { setYear(e.target.value); setTerm(''); setWindowId(''); setStandard(''); setClassId(''); }}>
              <option value="">Select…</option>
              {(ref.data?.years ?? []).map((y: any) => <option key={S(y.id)} value={S(y.id)}>{S(y.name)}</option>)}
            </select></label>
          <label className="flex flex-col gap-1 text-sm"><span className="font-bold text-ks-navy">What to show</span>
            <select className={inputCls} value={source} onChange={(e) => setSource(e.target.value as Source)}>
              <option value="WINDOW">One exam window (merit list)</option>
              <option value="TERM">Term report cards (final term result)</option>
              <option value="ROSTER">Student list only (no marks)</option>
            </select></label>
          {source !== 'ROSTER' && (
            <label className="flex flex-col gap-1 text-sm"><span className="font-bold text-ks-navy">Term</span>
              <select className={inputCls} value={term} onChange={(e) => { setTerm(e.target.value); setWindowId(''); }}>
                <option value="">Select…</option>
                {terms.map((t: any) => <option key={S(t.id)} value={S(t.id)}>{S(t.name)}</option>)}
              </select></label>
          )}
          {source === 'WINDOW' && (
            <label className="flex flex-col gap-1 text-sm"><span className="font-bold text-ks-navy">Exam window</span>
              <select className={inputCls} value={windowId} onChange={(e) => setWindowId(e.target.value)} disabled={!term}>
                <option value="">{term ? (usable.length ? 'Select…' : 'No closed windows in this term') : 'Choose a term first'}</option>
                {usable.map((w) => <option key={S(w.id)} value={S(w.id)}>{S(w.name)} ({S(w.status)})</option>)}
              </select></label>
          )}
          <label className="flex flex-col gap-1 text-sm"><span className="font-bold text-ks-navy">Class / standard</span>
            <select className={inputCls} value={standard} onChange={(e) => { setStandard(e.target.value); setClassId(''); }}>
              <option value="">All classes</option>
              {standards.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select></label>
          <label className="flex flex-col gap-1 text-sm"><span className="font-bold text-ks-navy">Stream</span>
            <select className={inputCls} value={classId} onChange={(e) => setClassId(e.target.value)} disabled={!standard}>
              <option value="">All streams</option>
              {streams.map((c: any) => <option key={S(c.id)} value={S(c.id)}>{formatClassLabel(S(c.name), c.stream, ' · ')}</option>)}
            </select></label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={() => doDownload('xlsx')} loading={dl === 'xlsx'} disabled={!ready || preview.isError}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
          <Button variant="secondary" onClick={() => doDownload('pdf')} loading={dl === 'pdf'} disabled={!ready || preview.isError}><FileText className="h-4 w-4" /> PDF</Button>
          <Button variant="secondary" onClick={() => doDownload('csv')} loading={dl === 'csv'} disabled={!ready || preview.isError}><Download className="h-4 w-4" /> CSV</Button>
          {report && <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-ks-muted"><Users className="h-4 w-4" /> {N(report.totalStudents)} students in {report.standards?.length} standard(s)</span>}
        </div>
        {dlErr && <p className="mt-2 text-sm font-semibold text-ks-rose" role="alert">{dlErr}</p>}
        <p className="mt-3 text-xs text-ks-muted">The Excel file has one sheet per stream plus an "all streams" sheet per standard. Each list runs from the highest average to the lowest, with the stream position (STR) and the standard position (OVR).</p>
      </Card>

      {!ready && <EmptyState title="Choose what to export" message="Select the academic year and the exam window or term to see the ranked lists." />}
      {ready && preview.isLoading && <Card className="p-8 text-center text-ks-muted">Building the lists…</Card>}
      {ready && preview.isError && <ErrorState title="Nothing to show yet" message={S((preview.error as any)?.message)} onRetry={() => preview.refetch()} />}

      {report && (report.standards as any[]).map((st) => {
        const active = tab[st.key] ?? 'ALL';
        const rows: any[] = active === 'ALL' ? st.overall : (st.streams.find((x: any) => x.classId === active)?.rows ?? []);
        const roster = report.source === 'ROSTER';
        return (
          <Card key={st.key} className="mb-5 overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-ks-line bg-ks-paper px-4 py-3">
              <h3 className="font-display text-lg font-bold text-ks-navy">{S(st.label)}</h3>
              <Badge tone="slate">{S(st.stage).replace('_', '-')}</Badge>
              <div className="ml-auto flex flex-wrap gap-1">
                {st.streams.length > 1 && <button onClick={() => setTab((t) => ({ ...t, [st.key]: 'ALL' }))} className={`rounded px-3 py-1 text-xs font-bold ${active === 'ALL' ? 'bg-ks-blue text-white' : 'bg-white text-ks-navy'}`}>All streams</button>}
                {st.streams.map((x: any) => <button key={x.classId} onClick={() => setTab((t) => ({ ...t, [st.key]: x.classId }))} className={`rounded px-3 py-1 text-xs font-bold ${(active === x.classId || st.streams.length === 1) ? 'bg-ks-blue text-white' : 'bg-white text-ks-navy'}`}>{S(x.label)}</button>)}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-ks-navy text-left text-white">
                  <tr>
                    {roster ? <th className="px-3 py-2">#</th> : <><th className="px-3 py-2">STR</th><th className="px-3 py-2">OVR</th></>}
                    <th className="px-3 py-2">ADMNO</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Sex</th><th className="px-3 py-2">Class</th>
                    {!roster && (report.subjects as any[]).map((s) => <th key={s.key} className="px-2 py-2 text-center" title={s.label}>{S(s.label).slice(0, 6)}</th>)}
                    {!roster && <><th className="px-2 py-2 text-center">SBJ</th><th className="px-2 py-2 text-center">AVG %</th><th className="px-2 py-2 text-center">GR</th><th className="px-2 py-2">Division</th></>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ks-line">
                  {rows.map((r, i) => (
                    <tr key={S(r.studentId)} className="hover:bg-ks-paper/50">
                      {roster ? <td className="px-3 py-2 text-ks-muted">{i + 1}</td> : <><td className="px-3 py-2 font-bold text-ks-navy">{N(r.streamRank)}</td><td className="px-3 py-2 text-ks-muted">{N(r.standardRank)}</td></>}
                      <td className="px-3 py-2">{S(r.registrationNumber)}</td>
                      <td className="px-3 py-2 font-semibold text-ks-navy">{S(r.name)}</td>
                      <td className="px-3 py-2">{S(r.gender)}</td>
                      <td className="px-3 py-2">{formatClassLabel(S(r.className), r.stream)}</td>
                      {!roster && (report.subjects as any[]).map((s) => {
                        const c = r.subjects?.[s.key];
                        const text = !c ? '·' : c.status === 'EXEMPT' ? 'EXEMPT' : c.status === 'NOT_SAT' ? 'NS' : c.status === 'ABSENT' ? 'ABS' : `${Math.round(N(c.percentage))} ${S(c.grade)}`;
                        return <td key={s.key} className={`px-2 py-2 text-center ${c?.status === 'EXEMPT' ? 'text-ks-blue' : c?.status === 'NOT_SAT' || c?.status === 'ABSENT' ? 'text-[#7a5200]' : ''}`}>{text}</td>;
                      })}
                      {!roster && <>
                        <td className="px-2 py-2 text-center">{r.subjectsExpected && r.subjectsAssessed !== r.subjectsExpected ? `${N(r.subjectsAssessed)}/${N(r.subjectsExpected)}` : N(r.subjectsAssessed)}</td>
                        <td className="px-2 py-2 text-center font-bold">{r.average === null ? '' : N(r.average).toFixed(1)}</td>
                        <td className="px-2 py-2 text-center">{S(r.grade)}</td>
                        <td className="px-2 py-2">{S(r.division).replace('Division ', 'Div ')}</td>
                      </>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
