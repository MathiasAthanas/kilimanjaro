export function formatRegistrationNumber(year: number, sequence: number): string {
  return `KS-${year}-${String(sequence).padStart(5, '0')}`;
}