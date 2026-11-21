import { AlertTriangle, BedDouble, CheckCircle2, Home, Search, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { SkeletonTable } from '../../../components/common/SkeletonTable';
import { DataError } from '../../../components/feedback/DataError';
import { EmptyState } from '../../../components/feedback/EmptyState';
import { errorMessage } from '../../../lib/api/errors';
import { useAuthStore } from '../../../lib/auth/authStore';
import { toast } from '../../../lib/toast';
import { ChangeResidenceDialog } from '../components/ResidenceCard';
import { useBulkClassify, useResidenceStudents, useResidenceSummary, type ResidenceStudentRow, type ResidenceType } from '../api/residence.hooks';

const phrase = (type: ResidenceType) => (type === 'BOARDING' ? 'in campus (boarding)' : 'off campus (day scholar)');

const tabs = [
  { key: 'UNCLASSIFIED', label: 'Not classified' },
  { key: 'BOARDING', label: 'In campus' },
  { key: 'DAY_SCHOLAR', label: 'Off campus' },
  { key: 'ALL', label: 'Everyone' },
] as const;

function Tile({ label, value, tone, hint }: { label: string; value: number; tone: 'navy' | 'green' | 'blue' | 'amber'; hint?: string }) {
  const color = { navy: 'text-[#00334f]', green: 'text-emerald-700', blue: 'text-sky-700', amber: 'text-amber-700' }[tone];
  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-sm ${tone === 'amber' && value > 0 ? 'border-amber-300 bg-amber-50' : 'border-slate-200'}`}>
      <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`mt-1 font-display text-3xl font-black ${color}`}>{value.toLocaleString()}</p>
      {hint && <p className="mt-0.5 text-xs font-semibold text-slate-500">{hint}</p>}
    </div>
  );
}

/** One screen to see who is in campus, who is off campus and who still needs to be classified. */
export function ResidencePage() {
  const role = useAuthStore((s) => s.session?.user.role);
  const canChange = ['ADMIN', 'ADMISSIONS', 'PRINCIPAL', 'HEAD_OF_SCHOOL', 'MANAGER', 'SUPER_ADMIN'].includes(String(role));
  const { data: summary, isLoading, isError, refetch } = useResidenceSummary();
  const [tab, setTab] = useState<(typeof tabs)[number]['key']>('UNCLASSIFIED');
  const [classId, setClassId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<{ type: ResidenceType; classId?: string; className?: string; count: number; ids?: string[] } | null>(null);
  const [changing, setChanging] = useState<ResidenceStudentRow | null>(null);
  const list = useResidenceStudents({ classId: classId || undefined, status: tab, search: search.trim() || undefined, page });
  const bulk = useBulkClassify();

  const rows = list.data?.items ?? [];
  const totals = summary?.totals;
  const unclassifiedRows = rows.filter((r) => !r.residenceType);
  const allPicked = unclassifiedRows.length > 0 && unclassifiedRows.every((r) => picked.has(r.id));
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.limit)) : 1;
  const classOptions = useMemo(() => summary?.classes.filter((c) => c.classId) ?? [], [summary]);

  const runBulk = () => {
    if (!confirm) return;
    bulk.mutate(
      { residenceType: confirm.type, classId: confirm.ids ? undefined : confirm.classId, studentIds: confirm.ids },
      {
        onSuccess: (result) => {
          toast(`${result.updated} student${result.updated === 1 ? '' : 's'} marked ${phrase(confirm.type)}${result.skipped ? ` (${result.skipped} already set, left unchanged)` : ''}`, 'success');
          setConfirm(null);
          setPicked(new Set());
        },
        onError: (error) => toast(errorMessage(error, 'Could not classify the students'), 'error'),
      },
    );
  };

  return (
    <div className="space-y-gutter">
      <header className="rounded-2xl border border-[#00334f]/10 bg-white p-5 shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#d59a1b]">Students</p>
        <h1 className="mt-1 font-display text-2xl font-black text-[#00334f]">In campus and off campus</h1>
        <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-500">
          Every student should be marked as in campus (boarding) or off campus (day scholar). Fees for boarders and day scholars are charged only once a student is classified.
        </p>
      </header>

      {isLoading ? <SkeletonTable cols={5} /> : isError || !summary ? (
        <DataError message="Could not load the classification." onRetry={refetch} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Tile label="Active students" value={totals!.total} tone="navy" />
            <Tile label="In campus" value={totals!.boarding} tone="green" />
            <Tile label="Off campus" value={totals!.dayScholar} tone="blue" />
            <Tile label="Not classified" value={totals!.unclassified} tone="amber" hint={totals!.unclassified ? 'Classify these before generating invoices' : 'All students classified'} />
            <Tile label="Changes waiting" value={totals!.scheduled} tone="navy" hint="Start with the next term" />
          </div>

          {totals!.unclassified > 0 && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <p>{totals!.unclassified} student{totals!.unclassified === 1 ? ' is' : 's are'} not classified yet. Where fees differ for boarders and day scholars, these students will not receive the residence fee until they are classified.</p>
            </div>
          )}

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-3"><h2 className="font-black text-[#00334f]">By class</h2></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-widest text-slate-500">
                  <tr><th className="px-4 py-2 text-left">Class</th><th className="px-4 py-2 text-right">Students</th><th className="px-4 py-2 text-right">In campus</th><th className="px-4 py-2 text-right">Off campus</th><th className="px-4 py-2 text-right">Not classified</th>{canChange && <th className="px-4 py-2 text-right">Classify the rest as</th>}</tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {summary.classes.map((c) => (
                    <tr key={c.classId || 'none'} className={`hover:bg-slate-50 ${classId === c.classId ? 'bg-[#eef5f8]' : ''}`}>
                      <td className="px-4 py-2.5"><button className="font-bold text-[#00334f] hover:underline" onClick={() => { setClassId(c.classId === classId ? '' : c.classId); setTab(c.unclassified ? 'UNCLASSIFIED' : 'ALL'); setPage(1); }}>{c.name}</button></td>
                      <td className="px-4 py-2.5 text-right font-semibold">{c.total}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-emerald-700">{c.boarding}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-sky-700">{c.dayScholar}</td>
                      <td className="px-4 py-2.5 text-right">{c.unclassified ? <Badge tone="amber">{c.unclassified}</Badge> : <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-600" aria-label="All classified" />}</td>
                      {canChange && (
                        <td className="px-4 py-2.5 text-right">
                          {c.unclassified > 0 && c.classId ? (
                            <span className="inline-flex gap-2">
                              <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => setConfirm({ type: 'BOARDING', classId: c.classId, className: c.name, count: c.unclassified })}><BedDouble className="h-3.5 w-3.5" /> In campus</Button>
                              <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => setConfirm({ type: 'DAY_SCHOLAR', classId: c.classId, className: c.name, count: c.unclassified })}><Home className="h-3.5 w-3.5" /> Off campus</Button>
                            </span>
                          ) : <span className="text-xs font-semibold text-slate-400">Nothing to do</span>}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3">
              <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filter students">
                {tabs.map((t) => (
                  <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => { setTab(t.key); setPage(1); }} className={`rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-wider ${tab === t.key ? 'bg-[#00334f] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{t.label}</button>
                ))}
              </div>
              <select aria-label="Class" value={classId} onChange={(e) => { setClassId(e.target.value); setPage(1); }} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm font-semibold">
                <option value="">All classes</option>
                {classOptions.map((c) => <option key={c.classId} value={c.classId}>{c.name}</option>)}
              </select>
              <label className="relative ml-auto">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name or reg. number" aria-label="Search students" className="h-9 w-64 rounded-lg border border-slate-200 pl-8 pr-3 text-sm font-semibold outline-none focus:border-[#00334f]" />
              </label>
            </div>

            {canChange && picked.size > 0 && (
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-[#eef5f8] px-5 py-2.5 text-sm font-semibold text-[#00334f]">
                {picked.size} selected
                <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => setConfirm({ type: 'BOARDING', count: picked.size, ids: [...picked] })}><BedDouble className="h-3.5 w-3.5" /> Mark in campus</Button>
                <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => setConfirm({ type: 'DAY_SCHOLAR', count: picked.size, ids: [...picked] })}><Home className="h-3.5 w-3.5" /> Mark off campus</Button>
                <button className="text-xs font-black uppercase underline" onClick={() => setPicked(new Set())}>Clear</button>
              </div>
            )}

            {list.isLoading ? <div className="p-4"><SkeletonTable cols={4} /></div> : rows.length === 0 ? (
              <div className="p-6"><EmptyState title={tab === 'UNCLASSIFIED' ? 'Everyone here is classified' : 'No students found'} description="Try another tab, class or search." /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-widest text-slate-500">
                    <tr>
                      {canChange && <th className="w-10 px-4 py-2"><input type="checkbox" aria-label="Select all not classified on this page" checked={allPicked} onChange={() => setPicked(allPicked ? new Set() : new Set(unclassifiedRows.map((r) => r.id)))} className="accent-[#00334f]" /></th>}
                      <th className="px-4 py-2 text-left">Student</th><th className="px-4 py-2 text-left">Class</th><th className="px-4 py-2 text-left">Stays</th>{canChange && <th className="px-4 py-2 text-right">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        {canChange && <td className="px-4 py-2.5">{!r.residenceType && <input type="checkbox" aria-label={`Select ${r.firstName} ${r.lastName}`} checked={picked.has(r.id)} onChange={() => setPicked((p) => { const n = new Set(p); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })} className="accent-[#00334f]" />}</td>}
                        <td className="px-4 py-2.5"><span className="font-bold text-slate-800">{r.firstName} {r.lastName}</span><span className="block font-mono text-xs text-slate-500">{r.registrationNumber}</span></td>
                        <td className="px-4 py-2.5 font-semibold text-slate-600">{r.className ?? '-'}</td>
                        <td className="px-4 py-2.5">{r.residenceType ? <Badge tone={r.residenceType === 'BOARDING' ? 'emerald' : 'blue'}>{r.residenceType === 'BOARDING' ? 'In campus' : 'Off campus'}</Badge> : <Badge tone="amber">Not classified</Badge>}</td>
                        {canChange && <td className="px-4 py-2.5 text-right"><Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => setChanging(r)}>{r.residenceType ? 'Change' : 'Set'}</Button></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs font-semibold text-slate-500">
              <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {list.data?.total ?? 0} students</span>
              <span className="inline-flex items-center gap-2">
                <Button variant="secondary" className="!px-3 !py-1 text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                Page {page} of {pages}
                <Button variant="secondary" className="!px-3 !py-1 text-xs" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </span>
            </div>
          </section>
        </>
      )}

      {confirm && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Confirm classification">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h2 className="font-display text-xl font-black text-[#00334f]">Mark {confirm.count} student{confirm.count === 1 ? '' : 's'} as {phrase(confirm.type)}?</h2>
            <p className="mt-2 text-sm font-semibold text-slate-500">
              {confirm.className ? `Every student in ${confirm.className} who is not classified yet.` : 'The selected students.'} Students who already have a classification are left unchanged.
              {confirm.type === 'BOARDING' && ' They will appear in the matron and patron queue for a dormitory.'}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
              <Button className="bg-[#00334f]" loading={bulk.isPending} onClick={runBulk}>Yes, classify</Button>
            </div>
          </div>
        </div>
      )}
      {changing && <ChangeResidenceDialog studentId={changing.id} current={changing.residenceType} onClose={() => setChanging(null)} />}
    </div>
  );
}
