import { useMemo } from 'react';
import { School as SchoolIcon } from 'lucide-react';
import { useAuthStore } from '../../../lib/auth/authStore';
import { useSchoolStore } from '../../../lib/school/schoolStore';
import { useSchools } from '../../manager/api/manager.hooks';

/**
 * A teacher can belong to several schools. This resolves the names of those
 * schools, says whether the teacher is multi-school at all, and lets every
 * page filter its rows to the school selected in the context bar.
 */
export function useTeacherSchools() {
  const session = useAuthStore((s) => s.session);
  const activeSchool = useSchoolStore((s) => s.activeSchool);
  const { data: schools } = useSchools();
  const memberIds = session?.user.schoolIds ?? [];
  const memberKey = memberIds.join(',');
  const activeId = activeSchool?.id ?? null;
  return useMemo(() => {
    const names = new Map<string, { name: string; code: string }>();
    for (const s of schools ?? []) names.set(String(s.id), { name: String(s.name), code: String(s.code ?? '') });
    const mine = memberKey.split(',').filter((id) => id && id !== '*');
    const multi = mine.length > 1;
    return {
      multi,
      ids: mine,
      activeSchoolId: activeId,
      nameOf: (id?: string | null) => (id ? names.get(id)?.name ?? '' : ''),
      codeOf: (id?: string | null) => (id ? names.get(id)?.code ?? '' : ''),
      /** Rows visible under the school selected in the context bar (all of them when "all my schools"). */
      visible: <T extends { schoolId?: string | null }>(rows: T[]): T[] =>
        activeId ? rows.filter((r) => !r.schoolId || r.schoolId === activeId) : rows,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schools, memberKey, activeId]);
}

/** Small pill naming the school a row belongs to. Renders nothing for single-school teachers. */
export function SchoolBadge({ schoolId, className = '' }: { schoolId?: string | null; className?: string }) {
  const { multi, nameOf, codeOf } = useTeacherSchools();
  if (!multi || !schoolId) return null;
  const label = codeOf(schoolId) || nameOf(schoolId);
  if (!label) return null;
  return (
    <span title={nameOf(schoolId)} className={`inline-flex items-center gap-1 rounded-full border border-[#d59a1b]/40 bg-[#fffbeb] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#7a5200] ${className}`}>
      <SchoolIcon className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  );
}

/** "Full name of the school" heading used above grouped lists. */
export function SchoolHeading({ schoolId }: { schoolId?: string | null }) {
  const { multi, nameOf } = useTeacherSchools();
  if (!multi) return null;
  return (
    <h3 className="mb-2 mt-1 flex items-center gap-2 text-sm font-black text-ks-navy">
      <SchoolIcon className="h-4 w-4 text-[#7a5200]" aria-hidden="true" />
      {nameOf(schoolId) || 'School'}
    </h3>
  );
}

/** Splits rows into per-school groups, in the teacher's own school order. */
export function groupBySchool<T extends { schoolId?: string | null }>(rows: T[]): Array<{ schoolId: string; rows: T[] }> {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const key = r.schoolId ?? '';
    map.set(key, [...(map.get(key) ?? []), r]);
  }
  return [...map.entries()].map(([schoolId, list]) => ({ schoolId, rows: list }));
}
