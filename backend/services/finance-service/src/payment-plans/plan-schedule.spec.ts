import { allocatePaid, buildSchedule, rescaleAmounts, validatePlanDefinition } from './plan-schedule';

const issued = new Date('2026-10-26T00:00:00Z');
const lines = [
  { feeCategoryId: 'tuition', name: 'Tuition Fee', amount: 4740000 },
  { feeCategoryId: 'adm', name: 'Admission form', amount: 200000 },
  { feeCategoryId: 'book', name: 'Text book', amount: 600000 },
];

describe('payment plan schedule', () => {
  it('splits tuition by percentage and puts the other fees in one row due at issue', () => {
    const rows = buildSchedule(
      {
        coveredCategoryIds: ['tuition'],
        installments: [
          { sequence: 1, groupLabel: 'Term I', label: 'First installment', percent: 25, dueDate: new Date('2026-12-15') },
          { sequence: 2, groupLabel: 'Term I', label: 'Second installment', percent: 10, dueDate: new Date('2027-01-04') },
          { sequence: 3, groupLabel: 'Term I', label: 'Third installment', percent: 15, dueDate: new Date('2027-03-29') },
          { sequence: 4, groupLabel: 'Term II', label: 'First installment', percent: 35, dueDate: new Date('2027-07-05') },
          { sequence: 5, groupLabel: 'Term II', label: 'Second installment', percent: 15, dueDate: new Date('2027-09-13') },
        ],
      },
      lines,
      issued,
    );
    expect(rows.map((r) => r.amount)).toEqual([1185000, 474000, 711000, 1659000, 711000, 800000]);
    expect(rows.reduce((s, r) => s + r.amount, 0)).toBe(5540000);
    expect(rows[5].label).toBe('Other items');
    expect(rows[5].description).toContain('Admission form (200,000)');
    expect(rows[5].dueDate.toISOString().slice(0, 10)).toBe('2026-10-26');
  });

  it('lets one instalment take whatever is left', () => {
    const rows = buildSchedule(
      {
        coveredCategoryIds: [],
        installments: [
          { sequence: 1, label: 'Deposit', fixedAmount: 1000000, dueDaysAfterIssue: 0 },
          { sequence: 2, label: 'Balance', isRemainder: true, dueDaysAfterIssue: 60 },
        ],
      },
      lines,
      issued,
    );
    expect(rows.map((r) => r.amount)).toEqual([1000000, 4540000]);
  });

  it('keeps the plan adding up to the fees when rounding leaves a cent over', () => {
    const rows = buildSchedule(
      { coveredCategoryIds: [], installments: [1, 2, 3].map((n) => ({ sequence: n, label: `Part ${n}`, percent: 33.3333, dueDaysAfterIssue: n })).concat([{ sequence: 4, label: 'Last', percent: 0.0001, dueDaysAfterIssue: 4 }]) },
      [{ feeCategoryId: 'a', name: 'A', amount: 100 }],
      issued,
    );
    expect(Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100)).toBe(10000);
  });

  it('rejects plans that cannot work', () => {
    expect(validatePlanDefinition([])).toHaveLength(1);
    expect(validatePlanDefinition([{ sequence: 1, label: 'A', percent: 60, dueDaysAfterIssue: 0 }, { sequence: 2, label: 'B', percent: 30, dueDaysAfterIssue: 5 }]).join(' ')).toContain('100%');
    expect(validatePlanDefinition([{ sequence: 1, label: 'A', percent: 50, fixedAmount: 10, dueDaysAfterIssue: 0 }]).join(' ')).toContain('one way');
    expect(validatePlanDefinition([{ sequence: 1, label: 'A', percent: 100 }]).join(' ')).toContain('due date');
    expect(validatePlanDefinition([{ sequence: 1, label: 'A', percent: 50, dueDaysAfterIssue: 0 }, { sequence: 2, label: 'B', percent: 50, dueDaysAfterIssue: 30 }])).toEqual([]);
  });

  it('counts payments against the earliest due instalment first', () => {
    const rows = [
      { sequence: 1, amount: 100, dueDate: new Date('2026-03-01') },
      { sequence: 2, amount: 100, dueDate: new Date('2026-01-01') },
      { sequence: 3, amount: 100, dueDate: new Date('2026-06-01') },
    ];
    const result = allocatePaid(rows, 150);
    expect(result.map((r) => [r.sequence, r.paid, r.balance])).toEqual([[1, 50, 50], [2, 100, 0], [3, 0, 100]]);
  });

  it('rescales a schedule to a new total without losing a cent', () => {
    const scaled = rescaleAmounts([300, 300, 400], 900);
    expect(scaled).toEqual([270, 270, 360]);
    expect(Math.round(rescaleAmounts([1, 1, 1], 10).reduce((s, a) => s + a, 0) * 100)).toBe(1000);
  });
});
