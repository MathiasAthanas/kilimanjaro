/**
 * Which subjects does an exam window leave out?
 *
 *  - a WINDOW rule belongs to one exam window and always applies to it;
 *  - a STANDING rule (examWindowId null) is a school-wide default that only seeds a window that has
 *    not been opened yet. Once a window has been opened its own rules are the whole truth, so a rule
 *    added later never changes an exam that is already running.
 *  - a rule with classId null covers every class in the window's scope; otherwise just that class.
 */
export interface ExclusionLike {
  id: string;
  examWindowId: string | null;
  subjectId: string;
  classId: string | null;
}

export type ExclusionSource = 'WINDOW' | 'STANDING';

export function matchExclusion<T extends ExclusionLike>(
  rows: T[],
  subjectId: string,
  classId: string,
  opts: { windowOpened: boolean },
): { row: T; source: ExclusionSource } | null {
  const fits = (r: T) => r.subjectId === subjectId && (r.classId === null || r.classId === classId);
  const windowRow = rows.find((r) => r.examWindowId !== null && fits(r));
  if (windowRow) return { row: windowRow, source: 'WINDOW' };
  if (opts.windowOpened) return null;
  const standing = rows.find((r) => r.examWindowId === null && fits(r));
  return standing ? { row: standing, source: 'STANDING' } : null;
}
