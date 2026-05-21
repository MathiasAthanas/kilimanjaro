export function validateScore(score: number | '', maxScore: number, absent: boolean) {
  if (absent) return { valid: true, tone: 'slate' as const, message: 'Absent' };
  if (score === '') return { valid: false, tone: 'rose' as const, message: 'Required unless absent' };
  if (!Number.isInteger(score)) return { valid: false, tone: 'rose' as const, message: 'Whole numbers only' };
  if (score < 0) return { valid: false, tone: 'rose' as const, message: 'Cannot be negative' };
  if (score > maxScore) return { valid: false, tone: 'rose' as const, message: `Cannot exceed ${maxScore}` };
  if (score === 0) return { valid: true, tone: 'amber' as const, message: 'Zero entered; confirm not absent' };
  return { valid: true, tone: 'emerald' as const, message: 'Valid' };
}

export function canSubmitMarks(rows: Array<{ score: number | ''; absent: boolean; state: string }>, maxScore: number) {
  return rows.every((row) => row.state !== 'dirty' && validateScore(row.score, maxScore, row.absent).valid);
}

export function validateSyllabusProgress(coveredTopics: number, totalTopics: number) {
  if (!Number.isInteger(coveredTopics) || !Number.isInteger(totalTopics)) return false;
  if (coveredTopics < 0 || totalTopics <= 0) return false;
  return coveredTopics <= totalTopics;
}
