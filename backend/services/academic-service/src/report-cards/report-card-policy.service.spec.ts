import { ReportCardPolicyService } from './report-card-policy.service';

describe('ReportCardPolicyService alternative subjects', () => {
  const service = new ReportCardPolicyService({} as any);

  it('exempts unscored CRE when IRE has a score', () => {
    expect(service.alternativeDecision([
      { subjectId: 'ire', subjectName: 'Islamic Religious Education', resultStatus: 'SCORED' },
      { subjectId: 'cre', subjectName: 'Christian Religious Education', resultStatus: 'NOT_SAT' },
    ])).toEqual({ exemptSubjectIds: ['cre'], conflicts: [] });
  });

  it('exempts unscored IRE when CRE has a score', () => {
    expect(service.alternativeDecision([
      { subjectId: 'ire', subjectName: 'IRE', resultStatus: 'ABSENT' },
      { subjectId: 'cre', subjectName: 'CRE', resultStatus: 'SCORED' },
    ])).toEqual({ exemptSubjectIds: ['ire'], conflicts: [] });
  });

  it('blocks a student with scored results in both alternatives', () => {
    const decision = service.alternativeDecision([
      { subjectId: 'ire', subjectName: 'IRE', resultStatus: 'SCORED' },
      { subjectId: 'cre', subjectName: 'CRE', resultStatus: 'SCORED' },
    ]);

    expect(decision.exemptSubjectIds).toEqual([]);
    expect(decision.conflicts).toHaveLength(1);
  });

  it('does not infer a choice when neither alternative has a score', () => {
    expect(service.alternativeDecision([
      { subjectId: 'ire', subjectName: 'IRE', resultStatus: 'NOT_SAT' },
      { subjectId: 'cre', subjectName: 'CRE', resultStatus: 'ABSENT' },
    ])).toEqual({ exemptSubjectIds: [], conflicts: [] });
  });
});
