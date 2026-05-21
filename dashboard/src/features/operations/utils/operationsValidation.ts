export function markIsValid(value: number | null, max: number, allowMissing = false) {
  if (value === null) return allowMissing;
  return Number.isFinite(value) && value >= 0 && value <= max;
}

export function parseMarksPaste(text: string) {
  return text
    .trim()
    .split(/\r?\n/)
    .map((row) => row.split(/\t|,/).map((cell) => cell.trim()));
}

export function exportReasonIsValid(reason: string, sensitive = true) {
  return !sensitive || reason.trim().length >= 10;
}

export function timetableHasConflict(entries: Array<{ teacher: string; className: string; day: string; start: string; end: string }>) {
  return entries.some((entry, index) =>
    entries.slice(index + 1).some((other) =>
      entry.day === other.day &&
      entry.start < other.end &&
      other.start < entry.end &&
      (entry.teacher === other.teacher || entry.className === other.className),
    ),
  );
}

export function reportBuilderIsValid(config: { domain?: string; type?: string; scope?: string; format?: string }) {
  return Boolean(config.domain && config.type && config.scope && config.format);
}
