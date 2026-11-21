/**
 * Pure instalment maths for payment plans. Money is handled in whole cents so splits never drift by a fraction.
 * A plan splits the "covered" fees of an invoice (usually tuition); every other fee goes into one "other items" row.
 */

export type PlanInstallmentDef = {
  sequence: number;
  groupLabel?: string | null;
  label: string;
  percent?: number | null;
  fixedAmount?: number | null;
  isRemainder?: boolean | null;
  dueDate?: Date | null;
  dueDaysAfterIssue?: number | null;
};

export type PlanDef = {
  coveredCategoryIds: string[];
  otherItemsLabel?: string | null;
  otherItemsDueDays?: number | null;
  installments: PlanInstallmentDef[];
};

export type ScheduleLine = { feeCategoryId: string; name: string; amount: number };

export type ScheduleRow = {
  sequence: number;
  groupLabel: string | null;
  label: string;
  description: string | null;
  amount: number;
  dueDate: Date;
};

const cents = (value: number) => Math.round((Number(value) || 0) * 100);
const fromCents = (value: number) => Math.round(value) / 100;
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
const money = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 2 });

/** Problems that make a plan definition unusable; an empty list means it is fine to save. */
export function validatePlanDefinition(installments: PlanInstallmentDef[]): string[] {
  const errors: string[] = [];
  if (!installments.length) return ['Add at least one instalment'];
  if (installments.length > 24) errors.push('A plan can have at most 24 instalments');
  let remainders = 0;
  let percentTotal = 0;
  let onlyPercents = true;
  installments.forEach((item, index) => {
    const name = item.label?.trim() ? `"${item.label.trim()}"` : `Instalment ${index + 1}`;
    if (!item.label?.trim()) errors.push(`${name} needs a name`);
    const modes = [item.percent != null, item.fixedAmount != null, !!item.isRemainder].filter(Boolean).length;
    if (modes !== 1) errors.push(`${name}: choose one way to set the amount (percentage, fixed amount, or the rest)`);
    if (item.percent != null && !(item.percent > 0 && item.percent <= 100)) errors.push(`${name}: percentage must be above 0 and at most 100`);
    if (item.fixedAmount != null && !(item.fixedAmount > 0)) errors.push(`${name}: fixed amount must be above 0`);
    if (item.isRemainder) remainders++;
    if (item.percent != null) percentTotal += item.percent;
    else onlyPercents = false;
    if (!item.dueDate && (item.dueDaysAfterIssue == null || item.dueDaysAfterIssue < 0)) errors.push(`${name} needs a due date`);
  });
  if (remainders > 1) errors.push('Only one instalment can be "the rest"');
  if (onlyPercents && remainders === 0 && Math.abs(percentTotal - 100) > 0.01) {
    errors.push(`Percentages add up to ${Math.round(percentTotal * 100) / 100}%, they must add up to 100%`);
  }
  if (!onlyPercents && remainders === 0 && installments.every((i) => i.fixedAmount != null || i.percent != null) === false) {
    errors.push('Mixing fixed amounts and percentages needs one instalment set to "the rest"');
  }
  if (!onlyPercents && remainders === 0 && installments.some((i) => i.percent != null) && installments.some((i) => i.fixedAmount != null)) {
    errors.push('Mixing fixed amounts and percentages needs one instalment set to "the rest"');
  }
  return errors;
}

export function buildSchedule(plan: PlanDef, lines: ScheduleLine[], issuedAt: Date): ScheduleRow[] {
  const coveredIds = plan.coveredCategoryIds ?? [];
  const covered = coveredIds.length ? lines.filter((l) => coveredIds.includes(l.feeCategoryId)) : lines;
  const other = coveredIds.length ? lines.filter((l) => !coveredIds.includes(l.feeCategoryId)) : [];
  const coveredCents = covered.reduce((sum, l) => sum + cents(l.amount), 0);
  const otherCents = other.reduce((sum, l) => sum + cents(l.amount), 0);

  const ordered = [...plan.installments].sort((a, b) => a.sequence - b.sequence);
  const amounts = ordered.map((i) => (i.percent != null ? Math.round((coveredCents * i.percent) / 100) : i.fixedAmount != null ? cents(i.fixedAmount) : 0));

  if (ordered.length && coveredCents > 0) {
    const restIndex = ordered.findIndex((i) => i.isRemainder);
    const withoutRest = amounts.reduce((sum, a, idx) => (idx === restIndex ? sum : sum + a), 0);
    if (restIndex >= 0) {
      amounts[restIndex] = Math.max(0, coveredCents - withoutRest);
    }
    // Whatever rounding or changed fees leave over goes to the last instalment, so the plan always adds up to the fees it covers.
    let diff = coveredCents - amounts.reduce((sum, a) => sum + a, 0);
    if (diff !== 0) {
      const last = amounts.length - 1;
      if (amounts[last] + diff >= 0) {
        amounts[last] += diff;
      } else {
        const total = amounts.reduce((sum, a) => sum + a, 0) || 1;
        let used = 0;
        amounts.forEach((a, idx) => {
          amounts[idx] = idx === last ? coveredCents - used : Math.round((a * coveredCents) / total);
          used += idx === last ? 0 : amounts[idx];
        });
        diff = 0;
      }
    }
  }

  const names = [...new Set(covered.map((l) => l.name))];
  const coveredText = names.length ? names.join(', ') : null;
  const rows: ScheduleRow[] = [];
  if (coveredCents > 0) {
    ordered.forEach((item, idx) => {
      const due = item.dueDate ? new Date(item.dueDate) : addDays(issuedAt, item.dueDaysAfterIssue ?? 0);
      rows.push({ sequence: rows.length + 1, groupLabel: item.groupLabel ?? null, label: item.label, description: coveredText, amount: fromCents(amounts[idx]), dueDate: due });
    });
  }
  if (otherCents > 0) {
    rows.push({
      sequence: rows.length + 1,
      groupLabel: null,
      label: plan.otherItemsLabel?.trim() || 'Other items',
      description: other.map((l) => `${l.name} (${money(l.amount)})`).join(', '),
      amount: fromCents(otherCents),
      dueDate: addDays(issuedAt, plan.otherItemsDueDays ?? 0),
    });
  }
  return rows;
}

/** How much of what has been paid counts against each instalment: earliest due date first. */
export function allocatePaid<T extends { amount: number; dueDate: Date; sequence: number }>(rows: T[], paid: number): Array<T & { paid: number; balance: number }> {
  let remaining = cents(paid);
  const order = [...rows].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime() || a.sequence - b.sequence);
  const paidBySequence = new Map<number, number>();
  for (const row of order) {
    const take = Math.min(remaining, cents(row.amount));
    paidBySequence.set(row.sequence, take);
    remaining -= take;
  }
  return rows.map((row) => {
    const p = paidBySequence.get(row.sequence) ?? 0;
    return { ...row, paid: fromCents(p), balance: fromCents(cents(row.amount) - p) };
  });
}

/** Re-split an existing schedule to a new invoice total (a discount, or a fee recalculation), keeping the proportions. */
export function rescaleAmounts(amounts: number[], newTotal: number): number[] {
  const target = cents(newTotal);
  const current = amounts.reduce((sum, a) => sum + cents(a), 0);
  if (!amounts.length) return [];
  if (current === target) return amounts;
  if (current === 0) return amounts.map((_, idx) => (idx === amounts.length - 1 ? fromCents(target) : 0));
  let used = 0;
  return amounts.map((a, idx) => {
    if (idx === amounts.length - 1) return fromCents(target - used);
    const part = Math.round((cents(a) * target) / current);
    used += part;
    return fromCents(part);
  });
}
