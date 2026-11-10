/**
 * Pure result-calculation engine. No I/O, no Nest, no Prisma — everything the
 * merit list, term results, report cards, PDFs and analytics need to agree on
 * lives here so there is exactly ONE implementation of:
 *
 *  - grade-band resolution (gap-proof)
 *  - per-subject status handling (SCORED / ABSENT / NOT_SAT / MISSING / EXEMPT)
 *  - normalized averages ((score / maxScore) × 100)
 *  - competition ranking
 *  - national divisions (Primary / O-Level / A-Level) with exemption awareness
 *  - weighted window blending with exemption renormalization
 */

export type SubjectStatus = 'SCORED' | 'ABSENT' | 'NOT_SAT' | 'MISSING' | 'EXEMPT';

/** Statuses that take part in averages / ranking / divisions. */
export const COUNTED_STATUSES: SubjectStatus[] = ['SCORED', 'ABSENT', 'NOT_SAT'];

export interface GradeBand {
  grade: string;
  minScore: number;
  maxScore?: number;
  points: number;
  remark: string;
  isPassing: boolean;
}

export interface ResolvedGrade {
  grade: string;
  points: number;
  remark: string;
  isPassing: boolean;
}

export interface ScaleLike {
  grades?: GradeBand[];
}

export const round = (n: number, dp = 2): number => {
  const f = Math.pow(10, dp);
  return Math.round((n + Number.EPSILON) * f) / f;
};

/**
 * Map a 0–100 percentage onto a grade band: the band with the highest
 * minScore ≤ percentage. Fractional scores (79.6 between bands ending at 79 and
 * starting at 80) can never fall through a boundary gap. Below the lowest band
 * the lowest band applies (a zero is a real, failing grade — never "X / 0 pts").
 */
export function resolveBand(scale: ScaleLike | null | undefined, percentage: number): ResolvedGrade {
  const bands = (scale?.grades ?? []).slice().sort((a, b) => b.minScore - a.minScore);
  if (!bands.length) {
    return { grade: 'X', points: 0, remark: 'Not graded', isPassing: false };
  }
  const pct = Number.isFinite(percentage) ? percentage : 0;
  const band = bands.find((b) => pct >= b.minScore) ?? bands[bands.length - 1];
  return { grade: band.grade, points: band.points, remark: band.remark, isPassing: band.isPassing };
}

export const normalizePercentage = (score: number, maxScore: number): number =>
  maxScore > 0 ? round((score / maxScore) * 100) : 0;

/** Raw mark facts for one subject, before status/exemption is applied. */
export interface RawMark {
  score: number;
  isAbsent: boolean;
  notSat: boolean;
}

export interface SubjectOutcome {
  subjectId: string;
  subjectName: string;
  code: string;
  status: SubjectStatus;
  /** Raw score (kept even when exempt so the original mark is preserved). */
  score: number;
  maxScore: number;
  /** Normalized 0–100. null when the subject does not count (MISSING / EXEMPT). */
  percentage: number | null;
  grade: string;
  points: number;
  remark: string;
  isPassing: boolean;
  /** Back-compat flags consumed by exports / UI. */
  isAbsent: boolean;
  missing: boolean;
  exempt: boolean;
  exemptionId?: string | null;
  exemptReason?: string | null;
}

export interface BuildOutcomeInput {
  subjectId: string;
  subjectName: string;
  code: string;
  maxScore: number;
  mark?: RawMark | null;
  exemption?: { id: string; reason: string } | null;
  scale: ScaleLike;
}

/** Decide the single status of an expected subject and grade it. */
export function buildOutcome(input: BuildOutcomeInput): SubjectOutcome {
  const { mark, exemption, maxScore } = input;
  const base = {
    subjectId: input.subjectId,
    subjectName: input.subjectName,
    code: input.code,
    maxScore,
  };

  if (exemption) {
    return {
      ...base,
      status: 'EXEMPT',
      score: mark?.score ?? 0,
      percentage: null,
      grade: 'EXEMPT',
      points: 0,
      remark: 'Exempt',
      isPassing: true,
      isAbsent: false,
      missing: false,
      exempt: true,
      exemptionId: exemption.id,
      exemptReason: exemption.reason,
    };
  }

  if (!mark) {
    return {
      ...base,
      status: 'MISSING',
      score: 0,
      percentage: null,
      grade: '',
      points: 0,
      remark: 'No mark entered',
      isPassing: false,
      isAbsent: false,
      missing: true,
      exempt: false,
    };
  }

  const status: SubjectStatus = mark.notSat ? 'NOT_SAT' : mark.isAbsent ? 'ABSENT' : 'SCORED';
  const score = status === 'SCORED' ? mark.score : 0;
  const percentage = status === 'SCORED' ? normalizePercentage(score, maxScore) : 0;
  // A zero is graded as a zero (e.g. F / 5 pts), never X with 0 points, which
  // would improve O-Level division points.
  const resolved = resolveBand(input.scale, percentage);
  return {
    ...base,
    status,
    score,
    percentage,
    grade: resolved.grade,
    points: resolved.points,
    remark: status === 'SCORED' ? resolved.remark : status === 'ABSENT' ? 'Absent' : 'Not sat',
    isPassing: status === 'SCORED' ? resolved.isPassing : false,
    isAbsent: status !== 'SCORED',
    missing: false,
    exempt: false,
  };
}

export const isCounted = (o: { status: SubjectStatus }): boolean => COUNTED_STATUSES.includes(o.status);

// ─── Divisions ────────────────────────────────────────────────────────────────

export interface DivisionRow {
  subjectId: string;
  grade: string;
  gradePoints: number;
  isPassing: boolean;
}

/**
 * Which way grade points run. NECTA ACSEE awards A=1 ... F=7 (lower is better);
 * some school scales use A=5 ... F=0 (higher is better). Detected from the scale
 * so divisions are never computed backwards.
 */
export type PointsDirection = 'LOWER_BETTER' | 'HIGHER_BETTER';

export function scaleDirection(scale: ScaleLike | null | undefined): PointsDirection | null {
  const bands = (scale?.grades ?? []).slice().sort((a, b) => b.minScore - a.minScore);
  if (bands.length < 2) return null;
  const best = bands[0].points;
  const worst = bands[bands.length - 1].points;
  if (best === worst) return null;
  return best < worst ? 'LOWER_BETTER' : 'HIGHER_BETTER';
}

export interface DivisionResult {
  mode: 'PRIMARY' | 'O_LEVEL' | 'A_LEVEL';
  division: string | null;
  descriptor: string;
  totalPoints: number;
  eligible: boolean;
  /** Present when the division could not be awarded. */
  note?: string;
  failingSubjects?: number;
  principalPasses?: number;
  eligibleSubjects: number;
}

/**
 * Tanzania NECTA divisions over the ELIGIBLE (non-exempt) subjects only.
 * An exemption changes the general average but must never fabricate a national
 * division: too few eligible subjects → "Ungraded".
 *
 *  O-Level: best 7 by grade-point (lower better). 7–17 I | 18–21 II | 22–25 III | 26–33 IV | ≥34 0
 *  A-Level: best 3 PRINCIPAL (higher better). 13–15 I | 10–12 II | 7–9 III | 4–6 IV | ≤3 0
 *  Primary: "Promotable" when the overall average reaches the configured pass mark.
 */
export function computeDivision(
  stage: string | null | undefined,
  rows: DivisionRow[],
  principalSubjectIds?: Set<string>,
  direction: PointsDirection = 'HIGHER_BETTER',
  options: { overallAverage?: number; primaryPassMark?: number } = {},
): DivisionResult {
  if (stage === 'PRIMARY') {
    const totalPoints = rows.reduce((sum, r) => sum + r.gradePoints, 0);
    const primaryPassMark = options.primaryPassMark ?? 50;
    const promotable = rows.length > 0 && (options.overallAverage ?? 0) >= primaryPassMark;
    return {
      mode: 'PRIMARY',
      division: null,
      descriptor: rows.length === 0 ? 'No assessed subjects' : promotable ? 'Promotable' : 'Needs intervention',
      totalPoints,
      eligible: rows.length > 0,
      eligibleSubjects: rows.length,
      failingSubjects: rows.filter((r) => !r.isPassing).length,
    };
  }

  if (stage === 'A_LEVEL') {
    const principals = principalSubjectIds ? rows.filter((r) => principalSubjectIds.has(r.subjectId)) : rows;
    if (principals.length < 3) {
      const note = `Ungraded — fewer than 3 eligible principal subjects (${principals.length})`;
      return {
        mode: 'A_LEVEL',
        division: 'Ungraded',
        descriptor: note,
        totalPoints: 0,
        eligible: false,
        note,
        principalPasses: principals.filter((r) => r.gradePoints >= 1).length,
        eligibleSubjects: principals.length,
      };
    }
    const lower = direction === 'LOWER_BETTER';
    const principalPasses = principals.filter((r) => (lower ? r.isPassing : r.gradePoints >= 1)).length;
    const best3 = [...principals].sort((a, b) => (lower ? a.gradePoints - b.gradePoints : b.gradePoints - a.gradePoints)).slice(0, 3);
    const divPoints = best3.reduce((sum, r) => sum + r.gradePoints, 0);
    let division: string;
    if (lower) {
      // NECTA ACSEE: best 3 principal subjects, A=1 ... F=7. I 3-9 | II 10-12 | III 13-17 | IV 18-19 | 0 >=20
      if (principalPasses < 2) division = 'Division 0';
      else if (divPoints <= 9) division = 'Division I';
      else if (divPoints <= 12) division = 'Division II';
      else if (divPoints <= 17) division = 'Division III';
      else if (divPoints <= 19) division = 'Division IV';
      else division = 'Division 0';
    } else if (principalPasses < 2 || divPoints <= 3) division = 'Division 0';
    else if (divPoints >= 13) division = 'Division I';
    else if (divPoints >= 10) division = 'Division II';
    else if (divPoints >= 7) division = 'Division III';
    else if (divPoints >= 4) division = 'Division IV';
    else division = 'Division 0';
    return {
      mode: 'A_LEVEL',
      division,
      descriptor:
        principalPasses >= 2
          ? `${division} · ${principalPasses} principal pass(es) · ${divPoints} pts`
          : `Division 0 — only ${principalPasses} principal pass(es)`,
      totalPoints: divPoints,
      eligible: true,
      principalPasses,
      eligibleSubjects: principals.length,
    };
  }

  // O-Level
  if (rows.length < 7) {
    const note = 'Ungraded — fewer than 7 eligible subjects';
    return {
      mode: 'O_LEVEL',
      division: 'Ungraded',
      descriptor: note,
      totalPoints: 0,
      eligible: false,
      note,
      failingSubjects: rows.filter((r) => !r.isPassing).length,
      eligibleSubjects: rows.length,
    };
  }
  const best7 = [...rows].sort((a, b) => a.gradePoints - b.gradePoints).slice(0, 7);
  const divPoints = best7.reduce((sum, r) => sum + r.gradePoints, 0);
  const failing = rows.filter((r) => !r.isPassing).length;
  let division: string;
  if (divPoints <= 17) division = 'Division I';
  else if (divPoints <= 21) division = 'Division II';
  else if (divPoints <= 25) division = 'Division III';
  else if (divPoints <= 33) division = 'Division IV';
  else division = 'Division 0';
  return {
    mode: 'O_LEVEL',
    division,
    descriptor: `${division} · ${divPoints} pts · ${failing} failing subject(s)`,
    totalPoints: divPoints,
    eligible: true,
    failingSubjects: failing,
    eligibleSubjects: rows.length,
  };
}

// ─── Student summary ──────────────────────────────────────────────────────────

export interface StudentSummary {
  subjectsExpected: number;
  subjectsAssessed: number;
  exemptCount: number;
  missingCount: number;
  total: number;
  mean: number;
  meanPoints: number;
  failingCount: number;
  division: DivisionResult;
}

/** Roll a student's per-subject outcomes into the figures every report shares. */
export function summarizeStudent(
  stage: string | null | undefined,
  outcomes: SubjectOutcome[],
  principalSubjectIds?: Set<string>,
  direction: PointsDirection = 'HIGHER_BETTER',
  primaryPassMark = 50,
): StudentSummary {
  const counted = outcomes.filter(isCounted);
  const total = counted.reduce((s, o) => s + o.score, 0);
  const mean = counted.length ? round(counted.reduce((s, o) => s + (o.percentage ?? 0), 0) / counted.length) : 0;
  const meanPoints = counted.length ? round(counted.reduce((s, o) => s + o.points, 0) / counted.length) : 0;
  const division = computeDivision(
    stage,
    counted.map((o) => ({ subjectId: o.subjectId, grade: o.grade, gradePoints: o.points, isPassing: o.isPassing })),
    principalSubjectIds,
    direction,
    { overallAverage: mean, primaryPassMark },
  );
  return {
    subjectsExpected: outcomes.length,
    subjectsAssessed: counted.length,
    exemptCount: outcomes.filter((o) => o.status === 'EXEMPT').length,
    missingCount: outcomes.filter((o) => o.status === 'MISSING').length,
    total: round(total),
    mean,
    meanPoints,
    failingCount: counted.filter((o) => !o.isPassing).length,
    division,
  };
}

// ─── Ranking ──────────────────────────────────────────────────────────────────

/**
 * Competition ranking (1,2,2,4…): equal scores share a rank and the next rank
 * skips. Scores are compared at 2 decimals so the ranking agrees with what the
 * printed average says.
 */
export function competitionRanks<T>(rows: T[], key: (r: T) => string, score: (r: T) => number): Record<string, number> {
  const sorted = [...rows].sort((a, b) => round(score(b)) - round(score(a)));
  const ranks: Record<string, number> = {};
  let prevScore: number | null = null;
  let prevRank = 0;
  sorted.forEach((row, index) => {
    const s = round(score(row));
    const r = prevScore !== null && s === prevScore ? prevRank : index + 1;
    ranks[key(row)] = r;
    prevRank = r;
    prevScore = s;
  });
  return ranks;
}

// ─── Weights & window blending ────────────────────────────────────────────────

export function validateWeights(weights: number[]): { ok: boolean; total: number; message?: string } {
  if (!weights.length) return { ok: false, total: 0, message: 'Select at least one exam window.' };
  if (weights.some((w) => !Number.isFinite(w) || w <= 0)) {
    return { ok: false, total: weights.reduce((s, w) => s + (Number.isFinite(w) ? w : 0), 0), message: 'Every window weight must be a positive number.' };
  }
  const total = round(weights.reduce((s, w) => s + w, 0), 4);
  if (Math.abs(total - 100) > 0.01) {
    return { ok: false, total, message: `Window weights must total exactly 100% (currently ${total}%).` };
  }
  return { ok: true, total };
}

export interface WindowContribution {
  examWindowId: string;
  name: string;
  weight: number;
  outcome: SubjectOutcome;
}

export interface BlendResult {
  status: SubjectStatus;
  percentage: number | null;
  /** Sum of the weights that actually contributed (100 unless a window was exempt). */
  effectiveWeight: number;
  contributions: Array<{ examWindowId: string; name: string; weight: number; effectiveWeight: number; status: SubjectStatus; percentage: number | null }>;
}

/**
 * Blend one subject's per-window outcomes into a term percentage.
 * Windows where the subject is EXEMPT drop out and the remaining weights are
 * renormalized (Annual 70% alone → the Annual percentage, not Annual × 0.7).
 * If every window is exempt the subject is EXEMPT for the term. A MISSING window
 * makes the blend MISSING — calculation must be blocked, never guessed.
 */
export function blendWindows(contribs: WindowContribution[]): BlendResult {
  if (contribs.some((c) => c.outcome.status === 'MISSING')) {
    return { status: 'MISSING', percentage: null, effectiveWeight: 0, contributions: [] };
  }
  const active = contribs.filter((c) => c.outcome.status !== 'EXEMPT');
  const effectiveTotal = active.reduce((s, c) => s + c.weight, 0);

  const contributions = contribs.map((c) => ({
    examWindowId: c.examWindowId,
    name: c.name,
    weight: c.weight,
    effectiveWeight: c.outcome.status === 'EXEMPT' || effectiveTotal === 0 ? 0 : round((c.weight / effectiveTotal) * 100, 4),
    status: c.outcome.status,
    percentage: c.outcome.percentage,
  }));

  if (!active.length) {
    return { status: 'EXEMPT', percentage: null, effectiveWeight: 0, contributions };
  }
  const percentage = round(active.reduce((s, c) => s + (c.outcome.percentage ?? 0) * c.weight, 0) / effectiveTotal);
  const allAbsent = active.every((c) => c.outcome.status !== 'SCORED');
  const status: SubjectStatus = allAbsent
    ? active.some((c) => c.outcome.status === 'NOT_SAT')
      ? 'NOT_SAT'
      : 'ABSENT'
    : 'SCORED';
  return { status, percentage, effectiveWeight: effectiveTotal, contributions };
}

// ─── Expected subjects ────────────────────────────────────────────────────────

export interface ExpectedSubjectInput {
  stage: string | null | undefined;
  classSubject: { subjectId: string; combinationId: string | null; isCompulsory: boolean };
  /** Active enrolments for this student keyed by subjectId (optional subjects). */
  enrolledSubjectIds: Set<string>;
  /** The student's A-Level combination, when known. */
  studentCombinationId?: string | null;
  /** Subject ids belonging to the student's combination. */
  combinationSubjectIds?: Set<string>;
}

/**
 * Is this class-subject one the student is expected to take?
 *  - A-Level: combination subjects come from the student's combination;
 *    shared compulsory subjects (e.g. General Studies) apply to everyone.
 *  - Otherwise compulsory subjects apply to the whole class; optional subjects
 *    only to students with an active enrolment.
 */
export function isSubjectExpected(input: ExpectedSubjectInput): boolean {
  const { classSubject: cs } = input;
  if (cs.combinationId) {
    return !!input.studentCombinationId && input.studentCombinationId === cs.combinationId;
  }
  if (input.stage === 'A_LEVEL') {
    if (cs.isCompulsory) return true;
    return !!input.combinationSubjectIds?.has(cs.subjectId) || input.enrolledSubjectIds.has(cs.subjectId);
  }
  if (cs.isCompulsory) return true;
  return input.enrolledSubjectIds.has(cs.subjectId);
}
