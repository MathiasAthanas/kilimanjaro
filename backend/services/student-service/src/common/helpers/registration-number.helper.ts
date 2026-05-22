/**
 * Gap 9 — Stage-prefixed registration numbers
 *
 * Format:  KS-{PREFIX}-{YEAR}-{NNNNN}
 *   Primary   →  KS-P-2026-00001
 *   O-Level   →  KS-S-2026-00001   (Secondary)
 *   A-Level   →  KS-A-2026-00001
 *
 * The legacy format (KS-{YEAR}-{NNNNN}) is kept for backward
 * compatibility via `formatRegistrationNumber`.
 */

export type EducationStageCode = 'PRIMARY' | 'O_LEVEL' | 'A_LEVEL';

const STAGE_PREFIX: Record<EducationStageCode, string> = {
  PRIMARY: 'P',
  O_LEVEL: 'S',
  A_LEVEL: 'A',
};

/** New stage-aware format.  KS-P-2026-00001 */
export function formatRegistrationNumberWithStage(
  year: number,
  sequence: number,
  stage: EducationStageCode,
): string {
  const prefix = STAGE_PREFIX[stage] ?? 'S';
  return `KS-${prefix}-${year}-${String(sequence).padStart(5, '0')}`;
}

/** Legacy format kept for backward compatibility.  KS-2026-00001 */
export function formatRegistrationNumber(year: number, sequence: number): string {
  return `KS-${year}-${String(sequence).padStart(5, '0')}`;
}

/** Derive stage from a registration number string. */
export function stageFromRegistrationNumber(regNo: string): EducationStageCode | null {
  if (/^KS-P-/.test(regNo)) return 'PRIMARY';
  if (/^KS-A-/.test(regNo)) return 'A_LEVEL';
  if (/^KS-S-/.test(regNo)) return 'O_LEVEL';
  return null; // legacy format — treat as O_LEVEL
}
