export function handlebarsIsValid(template: string) {
  const opens = template.match(/{{/g)?.length ?? 0;
  const closes = template.match(/}}/g)?.length ?? 0;
  if (opens !== closes) return false;
  return [...template.matchAll(/{{\s*([^}]+)\s*}}/g)].every((match) => /^[a-zA-Z0-9_.]+$/.test(match[1]));
}

export function gradeBoundariesAreValid(boundaries: Array<{ min: number; max: number; label: string }>) {
  if (boundaries.length === 0) return false;
  const sorted = [...boundaries].sort((a, b) => a.min - b.min);
  if (sorted[0].min !== 0 || sorted[sorted.length - 1].max !== 100) return false;
  if (new Set(sorted.map((item) => item.label)).size !== sorted.length) return false;
  return sorted.every((item, index) => item.min <= item.max && (index === 0 || sorted[index - 1].max + 1 === item.min));
}

export function assessmentWeightsTotal(weights: number[]) {
  return weights.reduce((sum, value) => sum + value, 0);
}

export function assessmentWeightsAreValid(weights: number[]) {
  return Math.abs(assessmentWeightsTotal(weights) - 100) < 0.001 && weights.every((value) => value > 0);
}

export function typedConfirmationIsValid(input: string, expected: string) {
  return input.trim() === expected;
}

export function roleRisk(role: string) {
  return ['ADMIN', 'SYSTEM_ADMIN', 'PRINCIPAL', 'FINANCE', 'AQA', 'ACADEMIC_QA'].includes(role) ? 'high' : 'standard';
}
