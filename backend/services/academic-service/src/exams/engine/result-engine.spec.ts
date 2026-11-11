import {
  blendWindows,
  buildOutcome,
  competitionRanks,
  computeDivision,
  isSubjectExpected,
  resolveBand,
  scaleDirection,
  summarizeStudent,
  validateWeights,
  SubjectOutcome,
} from './result-engine';

// NECTA-style secondary scale: lower points are better, gaps between bands on purpose.
const oLevelScale = {
  grades: [
    { grade: 'A', minScore: 75, maxScore: 100, points: 1, remark: 'Excellent', isPassing: true },
    { grade: 'B', minScore: 65, maxScore: 74, points: 2, remark: 'Very good', isPassing: true },
    { grade: 'C', minScore: 45, maxScore: 64, points: 3, remark: 'Good', isPassing: true },
    { grade: 'D', minScore: 30, maxScore: 44, points: 4, remark: 'Satisfactory', isPassing: true },
    { grade: 'F', minScore: 0, maxScore: 29, points: 5, remark: 'Fail', isPassing: false },
  ],
};
const primaryScale = {
  grades: [
    { grade: 'A', minScore: 81, maxScore: 100, points: 5, remark: 'Excellent', isPassing: true },
    { grade: 'B', minScore: 61, maxScore: 80, points: 4, remark: 'Very good', isPassing: true },
    { grade: 'C', minScore: 41, maxScore: 60, points: 3, remark: 'Good', isPassing: true },
    { grade: 'D', minScore: 21, maxScore: 40, points: 2, remark: 'Satisfactory', isPassing: true },
    { grade: 'E', minScore: 0, maxScore: 20, points: 1, remark: 'Fail', isPassing: false },
  ],
};
const aLevelScale = {
  grades: [
    { grade: 'A', minScore: 80, maxScore: 100, points: 5, remark: 'Excellent', isPassing: true },
    { grade: 'B', minScore: 70, maxScore: 79, points: 4, remark: 'Very good', isPassing: true },
    { grade: 'C', minScore: 60, maxScore: 69, points: 3, remark: 'Good', isPassing: true },
    { grade: 'D', minScore: 50, maxScore: 59, points: 2, remark: 'Satisfactory', isPassing: true },
    { grade: 'E', minScore: 40, maxScore: 49, points: 1, remark: 'Pass', isPassing: true },
    { grade: 'S', minScore: 35, maxScore: 39, points: 0.5, remark: 'Subsidiary', isPassing: false },
    { grade: 'F', minScore: 0, maxScore: 34, points: 0, remark: 'Fail', isPassing: false },
  ],
};

const subj = (name: string, score: number | null, opts: { max?: number; absent?: boolean; notSat?: boolean; exempt?: boolean; scale?: any } = {}) =>
  buildOutcome({
    subjectId: name.toLowerCase().replace(/\s+/g, '-'),
    subjectName: name,
    code: name.slice(0, 3).toUpperCase(),
    maxScore: opts.max ?? 100,
    mark: score === null ? null : { score, isAbsent: !!opts.absent, notSat: !!opts.notSat },
    exemption: opts.exempt ? { id: 'ex1', reason: 'Medical' } : null,
    scale: opts.scale ?? primaryScale,
  });

const ashaSubjects = (agriculture: SubjectOutcome) => [
  subj('Mathematics', 80),
  subj('English', 75),
  subj('Kiswahili', 70),
  subj('Science', 65),
  subj('Social Studies', 60),
  subj('ICT', 55),
  agriculture,
];

describe('resolveBand (single grading engine)', () => {
  it('never falls into a boundary gap with fractional scores', () => {
    expect(resolveBand(primaryScale, 80.5).grade).toBe('B'); // between 80 and 81
    expect(resolveBand(primaryScale, 80.99).grade).toBe('B');
    expect(resolveBand(primaryScale, 81).grade).toBe('A');
    expect(resolveBand(oLevelScale, 74.6).grade).toBe('B');
    expect(resolveBand(oLevelScale, 29.9).grade).toBe('F');
  });
  it('grades zero as the lowest real band, not X', () => {
    const r = resolveBand(oLevelScale, 0);
    expect(r.grade).toBe('F');
    expect(r.points).toBe(5);
    expect(r.isPassing).toBe(false);
  });
});

describe('Asha scenario (Class 6 A, 7 subjects)', () => {
  it('missing Agriculture is MISSING, never a silent zero', () => {
    const agri = subj('Agriculture', null);
    expect(agri.status).toBe('MISSING');
    expect(agri.percentage).toBeNull();
    expect(summarizeStudent('PRIMARY', ashaSubjects(agri)).missingCount).toBe(1);
  });

  it('Option 1: NOT_SAT → 0, included, average 57.86, failing grade', () => {
    const agri = subj('Agriculture', 0, { notSat: true });
    expect(agri.status).toBe('NOT_SAT');
    expect(agri.percentage).toBe(0);
    expect(agri.grade).toBe('E');
    expect(agri.points).toBe(1);
    expect(agri.isPassing).toBe(false);
    const s = summarizeStudent('PRIMARY', ashaSubjects(agri));
    expect(s.mean).toBe(57.86);
    expect(s.subjectsAssessed).toBe(7);
    expect(s.failingCount).toBe(1);
  });

  it('ABSENT behaves like NOT_SAT for calculations', () => {
    const agri = subj('Agriculture', 0, { absent: true });
    expect(agri.status).toBe('ABSENT');
    expect(summarizeStudent('PRIMARY', ashaSubjects(agri)).mean).toBe(57.86);
  });

  it('Option 2: EXEMPT → excluded, average 67.50 from 6 of 7', () => {
    const agri = subj('Agriculture', 40, { exempt: true }); // an existing mark is preserved but ignored
    expect(agri.status).toBe('EXEMPT');
    expect(agri.score).toBe(40);
    expect(agri.percentage).toBeNull();
    const s = summarizeStudent('PRIMARY', ashaSubjects(agri));
    expect(s.mean).toBe(67.5);
    expect(s.subjectsAssessed).toBe(6);
    expect(s.subjectsExpected).toBe(7);
    expect(s.exemptCount).toBe(1);
    expect(s.failingCount).toBe(0);
  });
});

describe('normalization across different maximum scores', () => {
  it('uses (score / max) × 100 for every subject', () => {
    const outcomes = [subj('Maths', 40, { max: 50 }), subj('English', 60, { max: 100 })];
    expect(outcomes[0].percentage).toBe(80);
    expect(summarizeStudent('PRIMARY', outcomes).mean).toBe(70);
  });
  it('ranks by normalized average, not raw totals', () => {
    // A: 45/50 + 60/100 → raw 105 (avg 75). B: 40/50 + 70/100 → raw 110 (avg 75). C: 30/50+80/100 → raw 110 (avg 70).
    const a = summarizeStudent('PRIMARY', [subj('M', 45, { max: 50 }), subj('E', 60)]);
    const b = summarizeStudent('PRIMARY', [subj('M', 40, { max: 50 }), subj('E', 70)]);
    const c = summarizeStudent('PRIMARY', [subj('M', 30, { max: 50 }), subj('E', 80)]);
    const ranks = competitionRanks(
      [{ id: 'a', s: a }, { id: 'b', s: b }, { id: 'c', s: c }],
      (r) => r.id,
      (r) => r.s.mean,
    );
    expect(ranks).toEqual({ a: 1, b: 1, c: 3 }); // raw totals would wrongly put A last
  });
});

describe('competitionRanks', () => {
  it('shares ranks on ties and skips the next', () => {
    const r = competitionRanks(
      [{ id: 'a', v: 90 }, { id: 'b', v: 80 }, { id: 'c', v: 80 }, { id: 'd', v: 70 }],
      (x) => x.id,
      (x) => x.v,
    );
    expect(r).toEqual({ a: 1, b: 2, c: 2, d: 4 });
  });
});

describe('divisions', () => {
  const o = (n: number, score: number) =>
    Array.from({ length: n }, (_, i) => subj(`Subject ${i + 1}`, score, { scale: oLevelScale }));

  it('O-Level: 7 strong subjects → Division I', () => {
    const s = summarizeStudent('O_LEVEL', o(7, 80));
    expect(s.division.division).toBe('Division I');
    expect(s.division.totalPoints).toBe(7);
  });

  it('O-Level: NOT_SAT cannot improve points (F=5 not X=0)', () => {
    const outcomes = [...o(6, 80), subj('Bio', 0, { notSat: true, scale: oLevelScale })];
    const s = summarizeStudent('O_LEVEL', outcomes);
    expect(s.division.totalPoints).toBe(6 + 5);
    expect(s.division.division).toBe('Division I'); // 11 pts, but the F is counted
  });

  it('O-Level: exemption leaving <7 subjects → Ungraded, average still calculated', () => {
    const outcomes = [...o(6, 80), subj('Bio', 10, { exempt: true, scale: oLevelScale })];
    const s = summarizeStudent('O_LEVEL', outcomes);
    expect(s.mean).toBe(80);
    expect(s.division.eligible).toBe(false);
    expect(s.division.division).toBe('Ungraded');
    expect(s.division.note).toBe('Ungraded — fewer than 7 eligible subjects');
  });

  it('O-Level: 8 subjects, one exempt → still graded from 7', () => {
    const outcomes = [...o(7, 80), subj('Bio', 10, { exempt: true, scale: oLevelScale })];
    expect(summarizeStudent('O_LEVEL', outcomes).division.division).toBe('Division I');
  });

  it('A-Level: only eligible principal subjects count', () => {
    const principals = new Set(['phy', 'chem', 'math']);
    const mk = (id: string, score: number) =>
      buildOutcome({ subjectId: id, subjectName: id, code: id, maxScore: 100, mark: { score, isAbsent: false, notSat: false }, scale: aLevelScale });
    const full = summarizeStudent('A_LEVEL', [mk('phy', 85), mk('chem', 82), mk('math', 90), mk('gs', 30)], principals);
    expect(full.division.division).toBe('Division I');
    expect(full.division.totalPoints).toBe(3);

    const exempt = buildOutcome({ subjectId: 'math', subjectName: 'math', code: 'm', maxScore: 100, mark: null, exemption: { id: 'e', reason: 'x' }, scale: aLevelScale });
    const few = summarizeStudent('A_LEVEL', [mk('phy', 85), mk('chem', 82), exempt, mk('gs', 30)], principals);
    expect(few.division.eligible).toBe(false);
    expect(few.division.division).toBe('Ungraded');
    expect(few.division.note).toMatch(/fewer than 3 eligible principal/);
  });

  it.each([
    [['A', 'A', 'A'], 3, 'Division I'],
    [['A', 'A', 'F'], 9, 'Division I'],
    [['A', 'B', 'F'], 10, 'Division II'],
    [['A', 'D', 'F'], 12, 'Division II'],
    [['A', 'E', 'F'], 13, 'Division III'],
    [['E', 'E', 'F'], 17, 'Division III'],
    [['D', 'F', 'F'], 18, 'Division IV'],
    [['S', 'S', 'F'], 19, 'Division IV'],
    [['S', 'F', 'F'], 20, 'Division 0'],
    [['F', 'F', 'F'], 21, 'Division 0'],
  ])('A-Level: %j gives %i points and %s', (grades, points, division) => {
    const rows = grades.map((grade, index) => ({
      subjectId: `principal-${index}`,
      grade,
      gradePoints: 0,
      isPassing: false,
    }));
    const result = computeDivision(
      'A_LEVEL',
      [...rows, { subjectId: 'general-studies', grade: 'A', gradePoints: 99, isPassing: true }],
      new Set(rows.map((row) => row.subjectId)),
      'HIGHER_BETTER',
    );
    expect(result.totalPoints).toBe(points);
    expect(result.division).toBe(division);
    expect(result.eligibleSubjects).toBe(3);
  });

  it('A-Level: no assigned principal combination is ungraded instead of counting every subject', () => {
    const result = computeDivision('A_LEVEL', [
      { subjectId: 'general-studies', grade: 'A', gradePoints: 1, isPassing: true },
      { subjectId: 'basic-math', grade: 'A', gradePoints: 1, isPassing: true },
      { subjectId: 'ict', grade: 'A', gradePoints: 1, isPassing: true },
    ]);
    expect(result.eligible).toBe(false);
    expect(result.division).toBe('Ungraded');
    expect(result.note).toMatch(/no A-Level principal combination/i);
  });

  it('Primary: overall pass mark determines the promotion verdict', () => {
    const rows = [
      { subjectId: 'a', grade: 'A', gradePoints: 5, isPassing: true },
      { subjectId: 'b', grade: 'E', gradePoints: 1, isPassing: false },
    ];

    expect(computeDivision('PRIMARY', rows, undefined, 'HIGHER_BETTER', { overallAverage: 87.6, primaryPassMark: 50 }).descriptor)
      .toBe('Promotable');
    expect(computeDivision('PRIMARY', rows, undefined, 'HIGHER_BETTER', { overallAverage: 49.9, primaryPassMark: 50 }).descriptor)
      .toBe('Needs intervention');
  });
});

describe('window blending & exemption renormalization', () => {
  const contrib = (id: string, weight: number, o: SubjectOutcome) => ({ examWindowId: id, name: id, weight, outcome: o });

  it('weights blend normally', () => {
    const r = blendWindows([contrib('monthly', 30, subj('English', 60)), contrib('annual', 70, subj('English', 80))]);
    expect(r.status).toBe('SCORED');
    expect(r.percentage).toBe(74);
  });

  it('exempt only from the monthly test → result is the annual percentage, not annual × 70%', () => {
    const r = blendWindows([contrib('monthly', 30, subj('English', 60, { exempt: true })), contrib('annual', 70, subj('English', 80))]);
    expect(r.percentage).toBe(80);
    expect(r.contributions.find((c) => c.examWindowId === 'annual')!.effectiveWeight).toBe(100);
  });

  it('exempt from every window → EXEMPT for the term', () => {
    const r = blendWindows([contrib('m', 30, subj('English', 60, { exempt: true })), contrib('a', 70, subj('English', 80, { exempt: true }))]);
    expect(r.status).toBe('EXEMPT');
    expect(r.percentage).toBeNull();
  });

  it('a missing window blocks the blend', () => {
    expect(blendWindows([contrib('m', 30, subj('English', null)), contrib('a', 70, subj('English', 80))]).status).toBe('MISSING');
  });

  it('absent in one window counts as 0 in the blend', () => {
    const r = blendWindows([contrib('m', 30, subj('English', 0, { absent: true })), contrib('a', 70, subj('English', 100))]);
    expect(r.percentage).toBe(70);
  });
});

describe('validateWeights', () => {
  it('requires positive weights totalling exactly 100', () => {
    expect(validateWeights([30, 70]).ok).toBe(true);
    expect(validateWeights([100]).ok).toBe(true);
    expect(validateWeights([30, 60]).ok).toBe(false);
    expect(validateWeights([0, 100]).ok).toBe(false);
    expect(validateWeights([-10, 110]).ok).toBe(false);
    expect(validateWeights([]).ok).toBe(false);
    expect(validateWeights([33.33, 33.33, 33.34]).ok).toBe(true);
  });
});

describe('expected subjects', () => {
  const base = { enrolledSubjectIds: new Set<string>() };
  it('compulsory class subjects apply to the whole class', () => {
    expect(isSubjectExpected({ ...base, stage: 'PRIMARY', classSubject: { subjectId: 'm', combinationId: null, isCompulsory: true } })).toBe(true);
  });
  it('optional subjects need an active enrolment', () => {
    const cs = { subjectId: 'fr', combinationId: null, isCompulsory: false };
    expect(isSubjectExpected({ ...base, stage: 'O_LEVEL', classSubject: cs })).toBe(false);
    expect(isSubjectExpected({ stage: 'O_LEVEL', classSubject: cs, enrolledSubjectIds: new Set(['fr']) })).toBe(true);
  });
  it('A-Level subjects come from the student combination', () => {
    const cs = { subjectId: 'phy', combinationId: 'PCM', isCompulsory: true };
    expect(isSubjectExpected({ ...base, stage: 'A_LEVEL', classSubject: cs, studentCombinationId: 'PCM' })).toBe(true);
    expect(isSubjectExpected({ ...base, stage: 'A_LEVEL', classSubject: cs, studentCombinationId: 'HGL' })).toBe(false);
    expect(isSubjectExpected({ ...base, stage: 'A_LEVEL', classSubject: cs })).toBe(false);
  });
  it('does not include unrelated A-Level subjects merely because legacy data marks them compulsory', () => {
    expect(isSubjectExpected({
      stage: 'A_LEVEL',
      classSubject: { subjectId: 'biology', combinationId: null, isCompulsory: true },
      enrolledSubjectIds: new Set(),
      studentCombinationId: 'HGL',
      combinationSubjectIds: new Set(['history', 'geography', 'english']),
    })).toBe(false);
    expect(isSubjectExpected({
      stage: 'A_LEVEL',
      classSubject: { subjectId: 'english', combinationId: null, isCompulsory: true },
      enrolledSubjectIds: new Set(),
      studentCombinationId: 'HGL',
      combinationSubjectIds: new Set(['history', 'geography', 'english']),
    })).toBe(true);
  });
});

describe('A-Level points direction (ACSEE A=1 ... F=7 vs A=5 ... F=0)', () => {
  const necta = {
    grades: [
      { grade: 'A', minScore: 80, points: 1, remark: '', isPassing: true },
      { grade: 'B', minScore: 70, points: 2, remark: '', isPassing: true },
      { grade: 'C', minScore: 60, points: 3, remark: '', isPassing: true },
      { grade: 'D', minScore: 50, points: 4, remark: '', isPassing: true },
      { grade: 'E', minScore: 40, points: 5, remark: '', isPassing: true },
      { grade: 'S', minScore: 35, points: 6, remark: '', isPassing: false },
      { grade: 'F', minScore: 0, points: 7, remark: '', isPassing: false },
    ],
  };
  it('detects direction from the scale', () => {
    expect(scaleDirection(necta)).toBe('LOWER_BETTER');
    expect(scaleDirection(aLevelScale)).toBe('HIGHER_BETTER');
  });
  it('awards divisions from the best 3 principal subjects with lower-is-better points', () => {
    const mk = (id: string, score: number) =>
      buildOutcome({ subjectId: id, subjectName: id, code: id, maxScore: 100, mark: { score, isAbsent: false, notSat: false }, scale: necta });
    const principals = new Set(['a', 'b', 'c']);
    const s = summarizeStudent('A_LEVEL', [mk('a', 85), mk('b', 75), mk('c', 65), mk('gs', 10)], principals, 'LOWER_BETTER');
    expect(s.division.totalPoints).toBe(1 + 2 + 3);
    expect(s.division.division).toBe('Division I');
    const weak = summarizeStudent('A_LEVEL', [mk('a', 45), mk('b', 45), mk('c', 10)], principals, 'LOWER_BETTER');
    expect(weak.division.totalPoints).toBe(5 + 5 + 7);
    expect(weak.division.division).toBe('Division III');
  });
});
