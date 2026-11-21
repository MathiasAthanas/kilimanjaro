export type ResidenceTarget = 'BOARDING' | 'DAY_SCHOLAR' | null | undefined;

export type FeeMatchContext = {
  schoolId?: string | null;
  classId?: string | null;
  educationStage?: string | null;
  classLevel?: number | null;
  studentGroupCodes: string[];
  residenceType?: ResidenceTarget;
  academicYearId: string;
  termId: string;
};

export type MatchableFeeStructure = {
  id: string;
  schoolId?: string | null;
  feeCategoryId: string;
  classId?: string | null;
  educationStage?: string | null;
  classLevel?: number | null;
  studentGroup?: string | null;
  residenceType?: ResidenceTarget;
  academicYearId: string;
  termId?: string | null;
  isActive: boolean;
  createdAt?: Date | null;
  feeCategory: { isOptional: boolean };
};

export function feeStructureMatches(structure: MatchableFeeStructure, context: FeeMatchContext): boolean {
  if (!structure.isActive || structure.academicYearId !== context.academicYearId) return false;
  if (structure.schoolId && structure.schoolId !== context.schoolId) return false;
  if (structure.termId && structure.termId !== context.termId) return false;
  if (structure.classId && structure.classId !== context.classId) return false;
  if (structure.educationStage && structure.educationStage !== context.educationStage) return false;
  if (structure.classLevel != null && structure.classLevel !== context.classLevel) return false;
  if (structure.studentGroup && !context.studentGroupCodes.includes(structure.studentGroup)) return false;
  if (structure.residenceType && structure.residenceType !== context.residenceType) return false;
  return true;
}

export function feeStructureSpecificity(structure: MatchableFeeStructure, context: FeeMatchContext): number {
  return (structure.schoolId === context.schoolId ? 64 : 0)
    + (structure.termId === context.termId ? 32 : 0)
    + (structure.classId === context.classId && !!structure.classId ? 16 : 0)
    + (structure.residenceType === context.residenceType && !!structure.residenceType ? 8 : 0)
    + (structure.educationStage === context.educationStage && structure.classLevel === context.classLevel && structure.classLevel != null ? 4 : 0)
    + (structure.educationStage === context.educationStage && !!structure.educationStage ? 2 : 0)
    + (structure.studentGroup && context.studentGroupCodes.includes(structure.studentGroup) ? 1 : 0);
}

export function selectApplicableStructures<T extends MatchableFeeStructure>(
  structures: T[],
  context: FeeMatchContext,
  explicitlyAssignedOptionalCategories: Set<string>,
): T[] {
  const selected = new Map<string, T>();
  for (const structure of structures) {
    if (!feeStructureMatches(structure, context)) continue;
    if (structure.feeCategory.isOptional && !explicitlyAssignedOptionalCategories.has(structure.feeCategoryId)) continue;
    const current = selected.get(structure.feeCategoryId);
    const score = feeStructureSpecificity(structure, context);
    const currentScore = current ? feeStructureSpecificity(current, context) : -1;
    if (!current || score > currentScore || (score === currentScore && isNewer(structure, current))) {
      selected.set(structure.feeCategoryId, structure);
    }
  }
  return [...selected.values()];
}

// Two prices that match equally (an old one and a corrected one): the newest wins; without dates, the id decides.
function isNewer(a: MatchableFeeStructure, b: MatchableFeeStructure): boolean {
  const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  if (at !== bt) return at > bt;
  return a.id.localeCompare(b.id) < 0;
}
