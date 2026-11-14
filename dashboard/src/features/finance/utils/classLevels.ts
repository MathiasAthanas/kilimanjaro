/**
 * Fees do not depend on the stream: Class 1 A and Class 1 B are both "Class 1". Finance screens therefore pick a
 * class LEVEL (every stream together) rather than each stream on its own.
 */

export type ClassLike = {
  id: string;
  name: string;
  level: number;
  stream?: string;
  educationStage: string;
  schoolId?: string | null;
};

export type ClassLevelGroup = {
  /** Stable key: school + stage + level + the class name without its stream. */
  key: string;
  /** What people read: "Class 1", "Form 5". */
  label: string;
  educationStage: string;
  level: number;
  schoolId: string | null;
  classIds: string[];
  streams: string[];
  /** Two differently named classes share this school, stage and level (e.g. Nursery and Pre-Unit), so a stage + level price would hit both. */
  ambiguous: boolean;
};

function clean(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim().replace(/\s+/g, ' ');
}

/** "Class 1 A" with stream "A" -> "Class 1"; "Form 5" with stream "PCM" -> "Form 5"; "Class 1A" with stream "A" -> "Class 1". */
export function baseClassLabel(nameValue: unknown, streamValue: unknown): string {
  const name = clean(nameValue);
  const stream = clean(streamValue);
  if (!name || !stream) return name;
  const lower = name.toLocaleLowerCase();
  const tail = stream.toLocaleLowerCase();
  for (const joiner of [' ', '-', '–', '—', '· ']) {
    if (lower.endsWith(`${joiner}${tail}`)) return name.slice(0, name.length - tail.length - joiner.length).trim();
  }
  if (/^[a-z]$/i.test(stream) && new RegExp(`\\d${stream}$`, 'i').test(name)) return name.slice(0, -1).trim();
  return name;
}

export function groupClassesByLevel(classes: ClassLike[]): ClassLevelGroup[] {
  const groups = new Map<string, ClassLevelGroup>();
  for (const c of classes) {
    const label = baseClassLabel(c.name, c.stream) || `Level ${c.level}`;
    const schoolId = c.schoolId ?? null;
    const key = `${schoolId ?? ''}|${c.educationStage}|${c.level}|${label.toLocaleLowerCase()}`;
    const found = groups.get(key);
    if (found) {
      found.classIds.push(c.id);
      const stream = clean(c.stream);
      if (stream && !found.streams.includes(stream)) found.streams.push(stream);
    } else {
      const stream = clean(c.stream);
      groups.set(key, { key, label, educationStage: c.educationStage, level: c.level, schoolId, classIds: [c.id], streams: stream ? [stream] : [], ambiguous: false });
    }
  }
  const list = [...groups.values()];
  const names = new Map<string, Set<string>>();
  for (const g of list) {
    const k = `${g.schoolId ?? ''}|${g.educationStage}|${g.level}`;
    (names.get(k) ?? names.set(k, new Set()).get(k)!).add(g.label.toLocaleLowerCase());
  }
  for (const g of list) g.ambiguous = (names.get(`${g.schoolId ?? ''}|${g.educationStage}|${g.level}`)?.size ?? 0) > 1;
  return list.sort((a, b) => a.level - b.level || a.label.localeCompare(b.label, undefined, { numeric: true }));
}

/**
 * How a price for this group is stored. With a chosen school and no look-alike class, one stage + level price covers
 * every stream (and any stream added later). Otherwise it is written to each class of the group, which is still a
 * single price in the screen.
 */
export function priceTarget(group: ClassLevelGroup, activeSchoolId: string | null | undefined): { mode: 'level'; educationStage: string; classLevel: number } | { mode: 'classes'; classIds: string[] } {
  if (activeSchoolId && group.schoolId === activeSchoolId && !group.ambiguous) {
    return { mode: 'level', educationStage: group.educationStage, classLevel: group.level };
  }
  return { mode: 'classes', classIds: group.classIds };
}

type StructureLike = { id: string; category?: string; classId?: string | null; educationStage?: string | null; rawClassLevel?: number | null; schoolId?: string | null; termId?: string | null; active?: boolean };

/** Every live structure that prices this fee for this group in this term, whichever way it was stored. */
export function structuresFor<T extends StructureLike>(structures: T[], category: string, group: Pick<ClassLevelGroup, 'classIds' | 'educationStage' | 'level' | 'schoolId' | 'ambiguous'>, termId: string): T[] {
  return structures.filter((s) => {
    if (s.active === false || s.category !== category) return false;
    if (termId ? s.termId !== termId : Boolean(s.termId)) return false;
    if (s.classId) return group.classIds.includes(s.classId);
    if (group.ambiguous) return false;
    return s.educationStage === group.educationStage && s.rawClassLevel === group.level && (!s.schoolId || !group.schoolId || s.schoolId === group.schoolId);
  });
}
