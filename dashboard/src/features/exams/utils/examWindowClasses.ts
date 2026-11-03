export type ExamClassRecord = Record<string, unknown> & {
  id?: unknown;
  academicYearId?: unknown;
  educationStage?: unknown;
  level?: unknown;
};

export type ExamWindowScope = Record<string, unknown> & {
  academicYearId?: unknown;
  educationStage?: unknown;
  scopeType?: unknown;
  scopeLevels?: unknown;
  scopeClassIds?: unknown;
};

const text = (value: unknown) => value === null || value === undefined ? '' : String(value);

export function eligibleExamClasses(classes: ExamClassRecord[], window: ExamWindowScope): ExamClassRecord[] {
  const yearId = text(window.academicYearId);
  const stage = text(window.educationStage);
  return classes.filter((item) =>
    (!yearId || text(item.academicYearId) === yearId)
    && (!stage || text(item.educationStage) === stage),
  );
}

export function includedExamClassIds(classes: ExamClassRecord[], window: ExamWindowScope): Set<string> {
  const scopeType = text(window.scopeType);
  if (scopeType === 'STREAMS') {
    return new Set(Array.isArray(window.scopeClassIds) ? window.scopeClassIds.map(text).filter(Boolean) : []);
  }
  if (scopeType === 'STANDARDS') {
    const levels = new Set(Array.isArray(window.scopeLevels) ? window.scopeLevels.map(Number) : []);
    return new Set(classes.filter((item) => levels.has(Number(item.level))).map((item) => text(item.id)).filter(Boolean));
  }
  return new Set(classes.map((item) => text(item.id)).filter(Boolean));
}
