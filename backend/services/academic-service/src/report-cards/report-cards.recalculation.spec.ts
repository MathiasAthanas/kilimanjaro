import { ReportCardPolicyService } from './report-card-policy.service';
import { ReportCardsService } from './report-cards.service';

describe('ReportCardsService policy recalculation', () => {
  it('exempts only the unscored alternative and preserves published cards', async () => {
    const prisma = {
      reportCard: {
        findMany: jest.fn().mockResolvedValue([
          { classId: 'class-1', studentId: 'student-1', isPublished: true },
          { classId: 'class-1', studentId: 'student-2', isPublished: true },
        ]),
      },
      termResult: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'ire-result', studentId: 'student-1', subjectId: 'ire', subjectName: 'IRE', resultStatus: 'SCORED' },
          { id: 'cre-result', studentId: 'student-1', subjectId: 'cre', subjectName: 'CRE', resultStatus: 'NOT_SAT' },
          { id: 'math-result', studentId: 'student-1', subjectId: 'math', subjectName: 'Mathematics', resultStatus: 'SCORED' },
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const redis = { delByPattern: jest.fn().mockResolvedValue(undefined) };
    const rabbitMq = { publish: jest.fn().mockResolvedValue(undefined) };
    const policyService = new ReportCardPolicyService({} as any);
    jest.spyOn(policyService, 'getForSchool').mockResolvedValue({
      schoolId: 'school-1',
      primaryPassMark: 50,
      oLevelPassMark: 40,
      aLevelPassMark: 25,
      showSubjectSupport: true,
      hideExemptSubjects: true,
      autoAlternativeSubjectExemptions: true,
    });
    const service = new ReportCardsService(
      prisma as any,
      redis as any,
      {} as any,
      rabbitMq as any,
      {} as any,
      {} as any,
      {} as any,
      policyService,
    );
    jest.spyOn(service, 'generateForClassTerm').mockResolvedValue({ generated: 2, classId: 'class-1', termId: 'term-1' });

    await expect(service.recalculateExisting('term-1', {
      id: 'admin-1',
      role: 'SYSTEM_ADMIN',
      scope: 'GROUP',
      schoolIds: ['*'],
      activeSchoolId: 'school-1',
    } as any)).resolves.toMatchObject({
      reportCardsRegenerated: 2,
      alternativeRowsExempted: 1,
      publishedCardsPreserved: 2,
    });

    expect(prisma.termResult.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['cre-result'] } },
      data: {
        resultStatus: 'EXEMPT',
        weightedTotal: 0,
        grade: 'EXEMPT',
        gradePoints: 0,
        remark: 'Exempt',
        isPassing: true,
      },
    });
    expect(service.generateForClassTerm).toHaveBeenCalledWith('class-1', 'term-1', 'admin-1');
  });
});
