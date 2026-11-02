import { PrismaService } from '../../prisma/prisma.service';
import { isSubjectExpected } from './result-engine';

export interface ExpectedAssessmentRef {
  classId: string;
  subjectId: string;
  termId: string;
  academicYearId: string;
  educationStage: string;
  examWindowId?: string | null;
  classSubject: { combinationId: string | null; subject: { isCompulsory: boolean } };
}

/**
 * Which of a class's students must have a mark for this assessment?
 *  - expected: students who actually take the subject (compulsory class subject,
 *    active optional enrolment, or A-Level combination subject)
 *  - exempt:   expected students with an approved exemption (no mark required)
 *  - required: expected minus exempt
 * Inactive/unassigned subjects are simply not expected.
 */
export async function resolveExpectedStudents(
  prisma: PrismaService,
  a: ExpectedAssessmentRef,
  classStudentIds: string[],
): Promise<{ expected: Set<string>; exempt: Set<string>; required: Set<string> }> {
  if (!classStudentIds.length) return { expected: new Set(), exempt: new Set(), required: new Set() };

  const enrolments = await prisma.studentSubjectEnrollment.findMany({
    where: {
      studentId: { in: classStudentIds },
      academicYearId: a.academicYearId,
      isActive: true,
      OR: [{ termId: null }, { termId: a.termId }],
    },
    select: { studentId: true, subjectId: true, combinationId: true },
  });
  const byStudent = new Map<string, { subjectIds: Set<string>; combinationId: string | null }>();
  for (const e of enrolments) {
    const cur = byStudent.get(e.studentId) ?? { subjectIds: new Set<string>(), combinationId: null };
    cur.subjectIds.add(e.subjectId);
    if (e.combinationId) cur.combinationId = e.combinationId;
    byStudent.set(e.studentId, cur);
  }
  // Single-combination cohort: students with no enrolment record inherit the class's combination.
  const classCombos = await prisma.classSubject.findMany({
    where: { classId: a.classId, academicYearId: a.academicYearId, isActive: true, combinationId: { not: null } },
    distinct: ['combinationId'],
    select: { combinationId: true },
  });
  const classCombo = classCombos.length === 1 ? classCombos[0].combinationId : null;
  const comboIds = [
    ...new Set([
      ...([...byStudent.values()].map((v) => v.combinationId).filter(Boolean) as string[]),
      ...(classCombo ? [classCombo] : []),
    ]),
  ];
  const comboSubjects = new Map<string, Set<string>>();
  if (comboIds.length) {
    const rows = await prisma.subjectCombinationSubject.findMany({
      where: { combinationId: { in: comboIds } },
      select: { combinationId: true, subjectId: true },
    });
    for (const r of rows) {
      if (!comboSubjects.has(r.combinationId)) comboSubjects.set(r.combinationId, new Set());
      comboSubjects.get(r.combinationId)!.add(r.subjectId);
    }
  }

  const expected = new Set<string>();
  for (const id of classStudentIds) {
    const own = byStudent.get(id) ?? { subjectIds: new Set<string>(), combinationId: null };
    const en = { subjectIds: own.subjectIds, combinationId: own.combinationId ?? classCombo };
    if (
      isSubjectExpected({
        stage: a.educationStage,
        classSubject: { subjectId: a.subjectId, combinationId: a.classSubject.combinationId, isCompulsory: a.classSubject.subject.isCompulsory },
        enrolledSubjectIds: en.subjectIds,
        studentCombinationId: en.combinationId,
        combinationSubjectIds: en.combinationId ? comboSubjects.get(en.combinationId) : undefined,
      })
    ) {
      expected.add(id);
    }
  }

  const exemptions = await prisma.resultCalculationExemption.findMany({
    where: {
      status: 'APPROVED',
      classId: a.classId,
      subjectId: a.subjectId,
      termId: a.termId,
      OR: a.examWindowId ? [{ examWindowId: null }, { examWindowId: a.examWindowId }] : [{ examWindowId: null }],
    },
    select: { studentId: true },
  });
  const exempt = new Set<string>();
  for (const ex of exemptions) {
    if (ex.studentId === null) expected.forEach((id) => exempt.add(id));
    else if (expected.has(ex.studentId)) exempt.add(ex.studentId);
  }
  const required = new Set([...expected].filter((id) => !exempt.has(id)));
  return { expected, exempt, required };
}
