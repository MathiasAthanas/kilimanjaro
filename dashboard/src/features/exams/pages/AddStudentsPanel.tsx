import { useMemo, useState } from 'react';
import { Search, UserPlus, X } from 'lucide-react';
import { Button } from '../../../components/common/Button';
import { Card } from '../../../components/common/Card';

export interface AddableStudent {
  studentId: string;
  registrationNumber: string | null;
  name: string;
  reason: 'EXEMPT' | 'NOT_TAKING';
  canAdd: boolean;
  blockedBy: 'CLASS_EXEMPTION' | 'COMBINATION' | 'ADMIN_ONLY' | null;
  existing: { score: number | null; isAbsent: boolean; notSat: boolean } | null;
}

/** Plain-language reason a student is not in the marks list. */
export function addableReason(s: AddableStudent): string {
  if (s.reason === 'EXEMPT') {
    return s.existing?.notSat || s.existing?.isAbsent
      ? 'Recorded as Not sat and exempt. Adding a score counts the exam for them.'
      : 'Exempt from this exam. Adding a score counts the exam for them.';
  }
  return 'Not registered for this subject. Adding a score registers them.';
}

export function addableBlock(s: AddableStudent): string {
  switch (s.blockedBy) {
    case 'ADMIN_ONLY': return 'Ask an administrator to add this student.';
    case 'CLASS_EXEMPTION': return 'The whole class is exempt. Remove that on the Exemptions page first.';
    case 'COMBINATION': return "Belongs to another combination. Change the student's combination first.";
    default: return '';
  }
}

/**
 * Lists the class students who are not in the marks grid (exempt, or not registered for the subject).
 * The teacher ticks the ones to bring in; they then appear in the grid ready for a score.
 */
export function AddStudentsPanel({ students, onAdd, onClose }: {
  students: AddableStudent[];
  onAdd: (picked: AddableStudent[]) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? students.filter((s) => s.name.toLowerCase().includes(q) || (s.registrationNumber ?? '').toLowerCase().includes(q)) : students;
  }, [students, search]);
  const pickable = shown.filter((s) => s.canAdd);
  const allPicked = pickable.length > 0 && pickable.every((s) => picked.has(s.studentId));

  const toggle = (id: string) => setPicked((cur) => { const next = new Set(cur); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const toggleAll = () => setPicked((cur) => {
    const next = new Set(cur);
    for (const s of pickable) { if (allPicked) next.delete(s.studentId); else next.add(s.studentId); }
    return next;
  });

  return (
    <Card className="mb-4 p-4" role="region" aria-label="Add students">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-ks-navy">Add students to this subject</h2>
          <p className="text-xs text-ks-muted">These students are in the class but are not on the marks list. Tick the ones you have marks for, then click Add.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-ks-muted hover:bg-ks-paper"><X className="h-4 w-4" /></button>
      </div>

      {students.length > 6 && (
        <label className="relative mb-3 block">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-ks-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or ADMNO" aria-label="Search students"
            className="w-full rounded-lg border border-ks-line py-2 pl-9 pr-3 text-sm" />
        </label>
      )}

      {pickable.length > 1 && (
        <label className="mb-2 flex items-center gap-2 text-sm font-bold text-ks-navy">
          <input type="checkbox" checked={allPicked} onChange={toggleAll} /> Select all ({pickable.length})
        </label>
      )}

      <ul className="max-h-72 divide-y divide-ks-line overflow-y-auto rounded-lg border border-ks-line">
        {shown.map((s) => (
          <li key={s.studentId} className={`flex items-start gap-3 px-3 py-2 ${s.canAdd ? '' : 'bg-ks-paper opacity-70'}`}>
            <input type="checkbox" className="mt-1" disabled={!s.canAdd} checked={picked.has(s.studentId)} onChange={() => toggle(s.studentId)} aria-label={`Add ${s.name}`} />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-ks-navy">{s.name} <span className="font-normal text-ks-muted">{s.registrationNumber ?? ''}</span></div>
              <div className="text-xs text-ks-muted">{s.canAdd ? addableReason(s) : addableBlock(s)}</div>
            </div>
          </li>
        ))}
        {shown.length === 0 && <li className="px-3 py-4 text-center text-sm text-ks-muted">No student matches.</li>}
      </ul>

      <div className="mt-3 flex gap-2">
        <Button disabled={picked.size === 0} onClick={() => onAdd(students.filter((s) => picked.has(s.studentId)))}>
          <UserPlus className="h-4 w-4" /> Add {picked.size > 0 ? picked.size : ''} selected
        </Button>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </Card>
  );
}
