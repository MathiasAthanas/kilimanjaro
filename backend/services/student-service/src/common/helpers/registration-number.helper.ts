/**
 * Registration number format:  KEMS-{STAGE}-{YY}{NNN}
 *
 *   Nursery   →  KEMS-N-26001
 *   Pre-Unit  →  KEMS-PU-26001
 *   Primary   →  KEMS-P-26001
 *   O-Level   →  KEMS-O-26001
 *   A-Level   →  KEMS-A-26001
 *
 * Where YY = last 2 digits of academic year, NNN = 3-digit zero-padded sequence.
 * Legacy format (KS-…) is still parseable by stageFromRegistrationNumber.
 */

export type EducationStageCode = 'NURSERY' | 'PRE_UNIT' | 'PRIMARY' | 'O_LEVEL' | 'A_LEVEL';

const SCHOOL_PREFIX = 'KEMS';

const STAGE_PREFIX: Record<EducationStageCode, string> = {
  NURSERY:  'N',
  PRE_UNIT: 'PU',
  PRIMARY:  'P',
  O_LEVEL:  'O',
  A_LEVEL:  'A',
};

/** Generate a registration number.  KEMS-P-26001 */
export function formatRegistrationNumberWithStage(
  year: number,
  sequence: number,
  stage: EducationStageCode,
): string {
  const stageCode = STAGE_PREFIX[stage] ?? 'O';
  const yy = String(year).slice(-2);
  const seq = String(sequence).padStart(3, '0');
  return `${SCHOOL_PREFIX}-${stageCode}-${yy}${seq}`;
}

/** Legacy shim — produces KEMS-{YY}{NNN} when stage is unknown. */
export function formatRegistrationNumber(year: number, sequence: number): string {
  const yy = String(year).slice(-2);
  const seq = String(sequence).padStart(3, '0');
  return `${SCHOOL_PREFIX}-${yy}${seq}`;
}

/** Derive stage from a registration number string (handles both old KS- and new KEMS- formats). */
export function stageFromRegistrationNumber(regNo: string): EducationStageCode | null {
  if (/^KEMS-N-/.test(regNo))  return 'NURSERY';
  if (/^KEMS-PU-/.test(regNo)) return 'PRE_UNIT';
  if (/^KEMS-P-/.test(regNo))  return 'PRIMARY';
  if (/^KEMS-O-/.test(regNo))  return 'O_LEVEL';
  if (/^KEMS-A-/.test(regNo))  return 'A_LEVEL';
  // legacy KS- formats
  if (/^KS-N-/.test(regNo))    return 'NURSERY';
  if (/^KS-U-/.test(regNo))    return 'PRE_UNIT';
  if (/^KS-P-/.test(regNo))    return 'PRIMARY';
  if (/^KS-A-/.test(regNo))    return 'A_LEVEL';
  if (/^KS-S-/.test(regNo))    return 'O_LEVEL';
  return null;
}
