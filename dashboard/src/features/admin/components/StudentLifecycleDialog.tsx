import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, ShieldAlert, Trash2, UsersRound, X } from 'lucide-react';
import { Button } from '../../../components/common/Button';
import { useAuthStore } from '../../../lib/auth/authStore';
import { toast } from '../../../lib/toast';
import {
  type StudentLifecycleAction,
  type StudentLifecyclePreview,
  useStudentLifecycleExecuteMutation,
  useStudentLifecyclePreviewMutation,
} from '../api/admin.hooks';

type StudentRow = { id: string; fullName: string; registrationNumber: string };
type TargetMode = 'SELECTED' | 'ALL_CURRENT';

const ACTIONS: Array<{ id: StudentLifecycleAction; title: string; detail: string; danger?: boolean }> = [
  { id: 'UNENROL_STUDENTS', title: 'Remove from this class', detail: 'Keeps student, guardian and login records. Only the current class enrolment is made inactive.' },
  { id: 'DELETE_STUDENTS', title: 'Permanently delete student records', detail: 'Available only for records without attendance, academic, finance, discipline or e-learning history.', danger: true },
  { id: 'DELETE_CLASS_AND_STUDENTS', title: 'Delete class and its student records', detail: 'Checks every historical class member. Any protected record blocks the whole operation.', danger: true },
  { id: 'DELETE_EMPTY_CLASS', title: 'Delete empty class only', detail: 'Only available when the class has no student history or protected academic/finance setup.', danger: true },
];

export function StudentLifecycleDialog({
  classId, className, students, selectedIds, onClose, onCompleted,
}: {
  classId: string;
  className: string;
  students: StudentRow[];
  selectedIds: string[];
  onClose: () => void;
  onCompleted: (result: unknown) => void;
}) {
  const [action, setAction] = useState<StudentLifecycleAction>('UNENROL_STUDENTS');
  const [targetMode, setTargetMode] = useState<TargetMode>(selectedIds.length ? 'SELECTED' : 'ALL_CURRENT');
  const [preview, setPreview] = useState<StudentLifecyclePreview | null>(null);
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [deleteLinkedAccounts, setDeleteLinkedAccounts] = useState(true);
  const role = useAuthStore((state) => state.session?.user.role);
  const canPermanentlyDelete = role === 'SUPER_ADMIN' || role === 'ADMIN';
  const previewMutation = useStudentLifecyclePreviewMutation();
  const executeMutation = useStudentLifecycleExecuteMutation();

  const requiresTarget = action === 'UNENROL_STUDENTS' || action === 'DELETE_STUDENTS';
  const isClassOperation = action === 'DELETE_CLASS_AND_STUDENTS' || action === 'DELETE_EMPTY_CLASS';
  const request = useMemo(() => ({
    classId,
    action,
    ...(requiresTarget && targetMode === 'SELECTED' ? { studentIds: selectedIds } : {}),
    ...(requiresTarget && targetMode === 'ALL_CURRENT' ? { allClassStudents: true } : {}),
  }), [action, classId, requiresTarget, selectedIds, targetMode]);

  useEffect(() => {
    setPreview(null);
    setConfirmation('');
  }, [action, targetMode, selectedIds.join(',')]);

  const previewAction = () => {
    if (requiresTarget && targetMode === 'SELECTED' && !selectedIds.length) {
      toast('Select one or more students first, or choose the whole current roster.', 'warning');
      return;
    }
    previewMutation.mutate(request, {
      onSuccess: setPreview,
      onError: (error: any) => toast(error?.response?.data?.message ?? 'Could not calculate the impact.', 'error'),
    });
  };

  const execute = () => {
    if (!preview) return;
    if (!reason.trim()) { toast('State why this action is required for the audit record.', 'warning'); return; }
    executeMutation.mutate({ ...request, reason: reason.trim(), confirmation, fingerprint: preview.fingerprint, deleteLinkedAccounts }, {
      onSuccess: (result: any) => {
        const failedAccounts = Array.isArray(result?.accountCleanup) ? result.accountCleanup.filter((item: any) => !item.deleted).length : 0;
        toast(failedAccounts ? `Data removed. ${failedAccounts} account cleanup task(s) need review.` : 'Lifecycle action completed.', failedAccounts ? 'warning' : 'success');
        onClose();
        onCompleted(result);
      },
      onError: (error: any) => toast(error?.response?.data?.message ?? 'The action could not be completed. No partial student data was removed.', 'error'),
    });
  };

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-label="Student and class cleanup">
      <div className="mx-auto my-6 w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 bg-slate-950 px-6 py-5 text-white">
          <div className="flex gap-3">
            <div className="mt-0.5 rounded-xl bg-amber-400/20 p-2"><ShieldAlert className="h-5 w-5 text-amber-300" /></div>
            <div><p className="text-xs font-black uppercase tracking-[0.16em] text-amber-300">Controlled lifecycle action</p><h2 className="mt-1 text-lg font-black">Clean up {className}</h2><p className="mt-1 text-sm text-slate-300">Preview every dependency before committing a class or student change.</p></div>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid gap-0 lg:grid-cols-[310px_1fr]">
          <aside className="border-b border-slate-200 bg-slate-50 p-5 lg:border-b-0 lg:border-r">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">1. Choose action</p>
            <div className="mt-3 space-y-2">
              {ACTIONS.filter((item) => canPermanentlyDelete || !item.danger).map((item) => (
                <button key={item.id} onClick={() => setAction(item.id)} className={`w-full rounded-xl border p-3 text-left transition ${action === item.id ? item.danger ? 'border-rose-400 bg-rose-50 shadow-sm' : 'border-indigo-400 bg-indigo-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                  <span className={`block text-sm font-black ${item.danger ? 'text-rose-700' : 'text-slate-900'}`}>{item.title}</span>
                  <span className="mt-1 block text-[11px] font-medium leading-4 text-slate-500">{item.detail}</span>
                </button>
              ))}
            </div>
          </aside>

          <section className="min-w-0 p-5 sm:p-6">
            {requiresTarget && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">2. Choose students</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button onClick={() => setTargetMode('SELECTED')} className={`rounded-xl border p-3 text-left ${targetMode === 'SELECTED' ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200'}`}>
                    <p className="font-black text-slate-900">Selected students</p><p className="mt-1 text-xs text-slate-500">{selectedIds.length} selected on the roster.</p>
                  </button>
                  <button onClick={() => setTargetMode('ALL_CURRENT')} className={`rounded-xl border p-3 text-left ${targetMode === 'ALL_CURRENT' ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200'}`}>
                    <p className="font-black text-slate-900">Whole current roster</p><p className="mt-1 text-xs text-slate-500">The server resolves every active enrolment, not just this page.</p>
                  </button>
                </div>
              </div>
            )}

            {isClassOperation && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle className="mr-2 inline h-4 w-4" />This checks the full class history, including students who are no longer in its active roster.</div>}

            <div className="mt-5 flex items-center gap-3 border-y border-slate-100 py-4">
              <UsersRound className="h-5 w-5 text-indigo-600" />
              <div className="flex-1"><p className="font-black text-slate-900">Impact preview is required</p><p className="text-xs text-slate-500">The operation will be recalculated again immediately before execution.</p></div>
              <Button onClick={previewAction} loading={previewMutation.isPending} className="rounded-xl px-4 py-2 text-xs">Review impact <ChevronRight className="h-4 w-4" /></Button>
            </div>

            {preview && <ImpactReview preview={preview} action={action} reason={reason} confirmation={confirmation} deleteLinkedAccounts={deleteLinkedAccounts} onReason={setReason} onConfirmation={setConfirmation} onAccounts={setDeleteLinkedAccounts} onExecute={execute} executing={executeMutation.isPending} />}
          </section>
        </div>
      </div>
    </div>
  );
}

function ImpactReview({ preview, action, reason, confirmation, deleteLinkedAccounts, onReason, onConfirmation, onAccounts, onExecute, executing }: {
  preview: StudentLifecyclePreview; action: StudentLifecycleAction; reason: string; confirmation: string; deleteLinkedAccounts: boolean;
  onReason: (value: string) => void; onConfirmation: (value: string) => void; onAccounts: (value: boolean) => void; onExecute: () => void; executing: boolean;
}) {
  const hardDelete = action !== 'UNENROL_STUDENTS';
  const totalDependencyRecords = Object.values(preview.localCounts).reduce((sum, value) => sum + value, 0)
    + preview.dependencyUsage.reduce((sum, item) => sum + Object.values(item.counts).reduce((inner, value) => inner + value, 0), 0);
  return (
    <div className="mt-5 space-y-4">
      <div className={`rounded-xl border p-4 ${preview.canExecute ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
        <div className="flex gap-3"><CheckCircle2 className={`mt-0.5 h-5 w-5 ${preview.canExecute ? 'text-emerald-600' : 'text-rose-600'}`} /><div><p className={`font-black ${preview.canExecute ? 'text-emerald-900' : 'text-rose-900'}`}>{preview.canExecute ? 'This action is eligible to continue' : 'This action is blocked to protect system records'}</p><p className="mt-1 text-sm text-slate-700">{preview.candidateStudents.length} student record(s) in scope. {totalDependencyRecords} linked record(s) were checked across student, academic, finance and e-learning services.</p></div></div>
      </div>

      {(preview.blockedStudents.length > 0 || preview.classBlockers.length > 0) && <div className="rounded-xl border border-rose-200 bg-white p-4"><p className="font-black text-rose-800">What prevents permanent deletion</p><ul className="mt-2 space-y-1 text-sm text-slate-700">{preview.blockedStudents.map((student) => <li key={student.id}><span className="font-bold">{student.name}:</span> {student.reasons.join(', ')}</li>)}{preview.classBlockers.map((reason) => <li key={reason}>{reason}</li>)}</ul><p className="mt-3 text-xs font-semibold text-slate-500">Use “Remove from this class” to preserve these records while cleaning the roster.</p></div>}

      {hardDelete && preview.canExecute && <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><input type="checkbox" className="mt-1 h-4 w-4" checked={deleteLinkedAccounts} onChange={(event) => onAccounts(event.target.checked)} /><span><b>Delete linked login accounts where eligible.</b><br /><span className="text-xs">Student accounts and guardians with no children anywhere in the group will also be removed. Leave unchecked to retain accounts for manual review.</span></span></label>}

      {preview.canExecute && <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Final confirmation</p><label className="mt-3 block text-xs font-bold text-slate-700">Reason for this action<textarea value={reason} onChange={(event) => onReason(event.target.value)} maxLength={500} className="mt-1 h-20 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm font-medium outline-none focus:border-indigo-400" placeholder="Example: Incorrect test import for Form 1 A" /></label><label className="mt-3 block text-xs font-bold text-slate-700">Type <code className="rounded bg-slate-200 px-1 py-0.5 text-slate-900">{preview.confirmationText}</code> to confirm<input value={confirmation} onChange={(event) => onConfirmation(event.target.value.toUpperCase())} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-sm font-bold outline-none focus:border-rose-400" /></label><Button variant={hardDelete ? 'danger' : 'primary'} className="mt-4 w-full rounded-xl" loading={executing} disabled={confirmation !== preview.confirmationText || !reason.trim()} onClick={onExecute}>{hardDelete ? <Trash2 className="h-4 w-4" /> : null}{hardDelete ? 'Permanently apply reviewed cleanup' : 'Remove students from this class'}</Button></div>}
    </div>
  );
}
