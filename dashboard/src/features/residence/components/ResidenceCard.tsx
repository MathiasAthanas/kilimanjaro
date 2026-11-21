import { ArrowRight, BedDouble, CalendarClock, History, Home, X } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '../../../components/common/Badge';
import { Button } from '../../../components/common/Button';
import { errorMessage } from '../../../lib/api/errors';
import { toast } from '../../../lib/toast';
import {
  residenceLabel,
  useCancelScheduledResidence,
  useChangeResidence,
  useResidenceHistory,
  useResidencePolicy,
  type ResidenceType,
} from '../api/residence.hooks';
import { ResidenceChoice } from './ResidenceChoice';

const dateText = (value?: string | null) => (value ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

/** The student's current residence, any change waiting for next term, the history, and the one guided way to change it. */
export function ResidenceCard({ studentId, current, canChange = true }: { studentId: string; current?: ResidenceType | null; canChange?: boolean }) {
  const { data: history } = useResidenceHistory(studentId);
  const [open, setOpen] = useState(false);
  const cancel = useCancelScheduledResidence();
  const type = history?.current ?? current ?? null;
  const scheduled = history?.changes.find((c) => c.status === 'SCHEDULED');
  const applied = (history?.changes ?? []).filter((c) => c.status !== 'SCHEDULED');
  const Icon = type === 'BOARDING' ? BedDouble : Home;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="residence-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`grid h-11 w-11 place-items-center rounded-xl ${type ? 'bg-[#00334f] text-white' : 'bg-amber-100 text-amber-700'}`}><Icon className="h-5 w-5" /></span>
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Where the student stays</p>
            <h2 id="residence-heading" className="font-display text-lg font-black text-[#00334f]">
              {type === 'BOARDING' ? 'In campus (Boarding)' : type === 'DAY_SCHOLAR' ? 'Off campus (Day Scholar)' : 'Not classified yet'}
            </h2>
          </div>
        </div>
        {canChange && <Button className="rounded-xl bg-[#00334f]" onClick={() => setOpen(true)}>{type ? 'Change' : 'Set now'}</Button>}
      </div>

      {scheduled && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          <span className="flex items-center gap-2"><CalendarClock className="h-4 w-4" /> Changes to <b>{residenceLabel(scheduled.toType)}</b> when {scheduled.effectiveTermName ?? 'the next term'} starts{scheduled.effectiveFrom ? ` (${dateText(scheduled.effectiveFrom)})` : ''}.</span>
          {canChange && (
            <button
              className="inline-flex items-center gap-1 text-xs font-black uppercase text-amber-900 underline"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate(scheduled.id, { onSuccess: () => toast('Scheduled change cancelled', 'success'), onError: (e) => toast(errorMessage(e, 'Could not cancel'), 'error') })}
            >
              <X className="h-3 w-3" /> Cancel change
            </button>
          )}
        </div>
      )}

      {applied.length > 0 && (
        <details className="mt-4 group">
          <summary className="flex cursor-pointer items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500"><History className="h-4 w-4" /> History ({applied.length})</summary>
          <ol className="mt-3 space-y-2 border-l-2 border-slate-100 pl-4">
            {applied.map((c) => (
              <li key={c.id} className="text-sm">
                <span className="flex flex-wrap items-center gap-2 font-bold text-slate-800">
                  {c.fromType ? residenceLabel(c.fromType) : 'Not classified'} <ArrowRight className="h-3 w-3 text-slate-400" /> {residenceLabel(c.toType)}
                  {c.status === 'CANCELLED' && <Badge tone="slate">Cancelled</Badge>}
                </span>
                <span className="block text-xs font-semibold text-slate-500">
                  {dateText(c.appliedAt ?? c.createdAt)} · {c.source === 'ADMISSION' ? 'At admission' : c.source === 'BULK' ? 'Classified in bulk' : c.source === 'SCHEDULE' ? 'Scheduled change' : 'Changed'}
                  {c.reason ? ` · ${c.reason}` : ''}
                  {c.releasedDormitoryName ? ` · left ${c.releasedDormitoryName}` : ''}
                </span>
              </li>
            ))}
          </ol>
        </details>
      )}

      {open && <ChangeResidenceDialog studentId={studentId} current={type} onClose={() => setOpen(false)} />}
    </section>
  );
}

export function ChangeResidenceDialog({ studentId, current, onClose }: { studentId: string; current: ResidenceType | null; onClose: () => void }) {
  const change = useChangeResidence();
  const { data: policy } = useResidencePolicy();
  const [next, setNext] = useState<ResidenceType | ''>('');
  const [when, setWhen] = useState<'NOW' | 'NEXT_TERM' | ''>('');
  const [reason, setReason] = useState('');

  // The school decides the default in its finance settings; with "ask" nothing is preselected.
  const effectiveWhen: 'NOW' | 'NEXT_TERM' | '' = when || (policy === 'NEXT_TERM' ? 'NEXT_TERM' : policy === 'THIS_TERM' ? 'NOW' : '');
  const first = current === null;
  const leaving = current === 'BOARDING' && next === 'DAY_SCHOLAR';
  const joining = next === 'BOARDING';
  const canSubmit = !!next && next !== current && (first ? true : !!effectiveWhen);

  const submit = () => {
    if (!next) return;
    change.mutate(
      { studentId, residenceType: next, effective: first ? 'NOW' : (effectiveWhen as 'NOW' | 'NEXT_TERM'), reason: reason.trim() || undefined },
      {
        onSuccess: (result) => {
          toast(
            result.applied
              ? joining
                ? 'Saved. The student now appears in the matron and patron queue for a dormitory.'
                : result.releasedDormitoryId ? 'Saved. The dormitory bed was released.' : 'Saved.'
              : `Scheduled for ${result.effectiveTerm?.name ?? 'next term'}.`,
            'success',
          );
          onClose();
        },
        onError: (error) => toast(errorMessage(error, 'Could not change residence'), 'error'),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Change residence">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <h2 className="font-display text-xl font-black text-[#00334f]">{first ? 'Where will the student stay?' : 'Change where the student stays'}</h2>
        <p className="mt-1 text-sm font-semibold text-slate-500">Currently: {residenceLabel(current)}</p>

        <div className="mt-4"><ResidenceChoice value={next} onChange={(v) => setNext(v as ResidenceType | '')} /></div>
        {next && next === current && <p className="mt-2 text-sm font-semibold text-amber-700">The student is already {residenceLabel(current).toLowerCase()}. Pick the other option.</p>}

        {!first && next && next !== current && (
          <fieldset className="mt-5">
            <legend className="text-[11px] font-black uppercase tracking-widest text-slate-500">When does it take effect?</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {([['NOW', 'Now', 'Applies immediately. Open invoices are marked for finance review.'], ['NEXT_TERM', 'Next term', 'Switches when the next term starts. This term stays as it is.']] as const).map(([v, title, hint]) => (
                <button key={v} type="button" onClick={() => setWhen(v)} className={`rounded-xl border-2 p-3 text-left ${effectiveWhen === v ? 'border-[#00334f] bg-[#eef5f8]' : 'border-slate-200 hover:border-[#00334f]/50'}`}>
                  <span className="block text-sm font-black text-[#00334f]">{title}{policy && ((policy === 'NEXT_TERM' && v === 'NEXT_TERM') || (policy === 'THIS_TERM' && v === 'NOW')) ? ' · school default' : ''}</span>
                  <span className="mt-0.5 block text-xs font-semibold text-slate-500">{hint}</span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {next && next !== current && (
          <ul className="mt-4 space-y-1.5 rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-600">
            {joining && <li>{effectiveWhen === 'NEXT_TERM' ? 'When the next term starts, the student joins the matron and patron list to be given a dormitory and bed.' : 'The student joins the matron and patron list to be given a dormitory and bed.'}</li>}
            {leaving && <li>{effectiveWhen === 'NEXT_TERM' ? 'They keep their bed until the next term starts, then it is released automatically.' : 'Their dormitory bed is released straight away. If they are currently away on leave, record their return first.'}</li>}
            {!first && <li>Invoices are never changed automatically. Finance previews and confirms any fee difference.</li>}
            {first && <li>This is the first classification. Fees are only charged where a fee structure is set for it.</li>}
          </ul>
        )}

        {!first && (
          <label className="mt-4 block">
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Reason (optional)</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="For example: family moved closer to school" className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-[#00334f]" />
          </label>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button className="bg-[#00334f]" loading={change.isPending} disabled={!canSubmit} onClick={submit}>{first ? 'Save' : effectiveWhen === 'NEXT_TERM' ? 'Schedule change' : 'Change now'}</Button>
        </div>
      </div>
    </div>
  );
}
