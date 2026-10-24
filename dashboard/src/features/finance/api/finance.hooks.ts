import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';
import { arrayFromApi, payloadOf } from '../../../lib/api/response';

// ─── Query key factory ────────────────────────────────────────────────────────

/** Server payloads are read defensively field by field; this is the one place that opts out of strict typing. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = Record<string, any>;

export const financeKeys = {
  all: ['finance'] as const,
  dashboard: () => [...financeKeys.all, 'dashboard'] as const,
  overview: () => [...financeKeys.all, 'overview'] as const,
  invoices: (params?: Record<string, unknown>) => [...financeKeys.all, 'invoices', params ?? {}] as const,
  invoice: (id: string) => [...financeKeys.all, 'invoices', id] as const,
  studentInvoices: (studentId: string) => [...financeKeys.all, 'invoices', 'student', studentId] as const,
  payments: () => [...financeKeys.all, 'payments'] as const,
  pendingPaymentApprovals: () => [...financeKeys.all, 'payments', 'pending-approval'] as const,
  receipts: () => [...financeKeys.all, 'receipts'] as const,
  receipt: (id: string) => [...financeKeys.all, 'receipts', id] as const,
  feeCategories: () => [...financeKeys.all, 'fee-categories'] as const,
  feeStructures: () => [...financeKeys.all, 'fee-structures'] as const,
  feeMatrix: () => [...financeKeys.all, 'fee-structures', 'matrix'] as const,
  studentGroups: () => [...financeKeys.all, 'fee-structures', 'student-groups'] as const,
  feeAssignments: () => [...financeKeys.all, 'fee-assignments'] as const,
  assets: () => [...financeKeys.all, 'assets'] as const,
  assetSummary: () => [...financeKeys.all, 'assets', 'summary'] as const,
  asset: (id: string) => [...financeKeys.all, 'assets', id] as const,
  auditLogs: () => [...financeKeys.all, 'audit-logs'] as const,
  collectionSummary: () => [...financeKeys.all, 'reports', 'collection-summary'] as const,
  outstandingBalances: () => [...financeKeys.all, 'reports', 'outstanding-balances'] as const,
  dailyCollections: () => [...financeKeys.all, 'reports', 'daily-collections'] as const,
  feeDefaulters: () => [...financeKeys.all, 'reports', 'fee-defaulters'] as const,
  studentStatement: (studentId: string) => [...financeKeys.all, 'reports', 'student-statement', studentId] as const,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useFinanceDashboard() {
  return useQuery({
    queryKey: financeKeys.dashboard(),
    queryFn: () => api.get('/finance/dashboard').then(payloadOf),
    staleTime: 60_000,
  });
}

export function useFinanceOverview() {
  return useQuery({
    queryKey: financeKeys.overview(),
    queryFn: () =>
      api.get('/analytics/finance/overview').then((r) => {
        const payload = payloadOf(r) as Record<string, unknown>;
        // The API nests financial totals under "billing"
        const b = (payload?.billing ?? payload) as Record<string, unknown>;
        const overdue = (payload?.overdueAnalysis ?? {}) as Record<string, unknown>;
        const today = new Date().toISOString().slice(0, 10);
        const daily = (Array.isArray(payload?.dailyCollectionThisMonth) ? payload.dailyCollectionThisMonth : []) as Array<Record<string, unknown>>;
        const todayRow = daily.find((d) => String(d.date) === today);
        return {
          totalInvoiced:  decimalToNumber(b.totalInvoiced),
          totalCollected: decimalToNumber(b.totalCollected),
          outstanding:    decimalToNumber(b.totalOutstanding ?? b.outstanding),
          collectionRate: Number(b.collectionRate ?? 0),
          today:          decimalToNumber(b.todayCollection ?? b.today ?? todayRow?.amount),
          overdueInvoices: Number(overdue.overdueCount ?? b.overdueCount ?? b.overdueInvoices ?? 0),
        };
      }),
    staleTime: 60_000,
  });
}

// ─── Local helpers ────────────────────────────────────────────────────────────

/** Unwrap a potentially-nested API object to a plain string. */
function strOf(raw: unknown, ...fallbacks: Array<unknown>): string {
  const resolve = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (typeof v === 'object') {
      const o = v as Record<string, unknown>;
      return resolve(o.name ?? o.fullName ?? o.label ?? o.title ?? o.value ?? '');
    }
    return String(v);
  };
  const primary = resolve(raw);
  if (primary !== '') return primary;
  for (const fb of fallbacks) {
    const s = resolve(fb);
    if (s !== '') return s;
  }
  return '';
}

/** Coerce any array/number/object to an integer count. */
function countOf(v: unknown): number {
  if (Array.isArray(v)) return v.length;
  const n = Number(v ?? 0);
  return isNaN(n) ? 0 : n;
}

/**
 * The backend serialises Decimal.js values as { s, e, d } objects.
 * Reconstruct the plain JS number from the internal representation.
 *   s – sign  (1 = positive, -1 = negative)
 *   e – exponent of the most-significant digit group
 *   d – array of digit words; d[0] is the most-significant, the rest are
 *       each 7-digit words (padded with leading zeros when necessary)
 *
 * Formula: join(d[0], pad7(d[1]), …) → digits string "1320000"
 *          value = Number(digits) × 10^(e + 1 − digits.length)
 */
function decimalToNumber(raw: unknown): number {
  if (typeof raw === 'number') return isNaN(raw) ? 0 : raw;
  // Plain string numeric value (e.g. "187160000")
  if (typeof raw === 'string') { const n = Number(raw); return isNaN(n) ? 0 : n; }
  if (!raw || typeof raw !== 'object') return 0;
  const { s = 1, e = 0, d } = raw as { s?: number; e?: number; d?: number[] };
  if (!Array.isArray(d) || !d.length) return 0;
  const digits = d.map((v, i) => (i === 0 ? String(v) : String(v).padStart(7, '0'))).join('');
  const value = Number(digits) * Math.pow(10, e + 1 - digits.length);
  return (s ?? 1) * (isNaN(value) ? 0 : value);
}

// ─── Normalised hooks ─────────────────────────────────────────────────────────

function normaliseInvoice(raw: unknown) {
  const inv = raw as Record<string, unknown>;
  const lineItems = arrayFromApi(inv, ['lineItems', 'items']).map((rawItem) => {
    const item = rawItem as Record<string, unknown>;
    return {
      ...item,
      id: strOf(item.id) || strOf(item.feeCategoryId) || crypto.randomUUID(),
      category: strOf(item.category, item.feeCategoryName, item.name, item.description, item.feeCategoryId) || 'Fee item',
      mandatory: item.mandatory === undefined ? true : Boolean(item.mandatory),
      amount: decimalToNumber(item.amount ?? item.totalAmount ?? item.value),
    };
  });
  const invoicePayments = arrayFromApi(inv, ['payments']).map((rawPayment) => {
    const payment = rawPayment as Record<string, unknown>;
    return {
      ...payment,
      id: strOf(payment.id) || crypto.randomUUID(),
      invoiceId: strOf(payment.invoiceId),
      paymentNumber: strOf(payment.paymentNumber, payment.number),
      number: strOf(payment.paymentNumber, payment.number, payment.id),
      invoiceNumber: strOf(inv.invoiceNumber, inv.number),
      student: strOf(payment.payerName, inv.student, inv.studentName),
      method: strOf(payment.method, payment.paymentMethod),
      amount: decimalToNumber(payment.amount),
      status: strOf(payment.status) || 'PENDING',
      enteredBy: strOf(payment.enteredBy, payment.recordedBy) || 'Finance desk',
      date: strOf(payment.paidAt, payment.createdAt),
      receiptId: strOf(payment.receiptId),
    };
  });
  return {
    ...inv,
    id: strOf(inv.id) || crypto.randomUUID(),
    number: strOf(inv.number, inv.invoiceNumber, inv.id),
    student: strOf(inv.student, inv.studentName),
    // never fall back to the studentId UUID — registration is filled from the student map
    registration: strOf(inv.registration, inv.registrationNumber),
    guardian: strOf(inv.guardian, inv.guardianName),
    className: strOf(inv.className, inv.class, inv.class_name),
    term: strOf(inv.term, inv.termName),
    dueDate: strOf(inv.dueDate, inv.due_date, inv.dueAt),
    lastPayment: strOf(inv.lastPayment, inv.lastPaymentDate),
    status: strOf(inv.status) || 'PENDING',
    total: decimalToNumber(inv.total ?? inv.totalAmount ?? inv.amount),
    paid: decimalToNumber(inv.paid ?? inv.paidAmount ?? inv.amountPaid),
    outstanding: decimalToNumber(inv.outstanding ?? inv.outstandingBalance ?? inv.outstandingAmount ?? inv.balance),
    subtotal: decimalToNumber(inv.subtotal),
    discountAmount: decimalToNumber(inv.discountAmount),
    studentId: strOf(inv.studentId),
    lineItems,
    payments: invoicePayments,
  };
}

export function useInvoices(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: financeKeys.invoices(params),
    queryFn: async () => {
      const rows = await api.get('/finance/invoices', { params }).then((r) => arrayFromApi(payloadOf(r), ['items', 'invoices']));
      return rows.map(normaliseInvoice);
    },
  });
}

export interface LedgerMeta { page: number; limit: number; total: number; totalPages: number }

/** One page of the invoice ledger with totals, status counts and filter choices for the whole filtered set. */
export function useInvoiceLedger(params: { page: number; limit?: number; status?: string; search?: string; classId?: string; termId?: string; studentId?: string; sort?: 'outstanding' }, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...financeKeys.all, 'invoice-ledger', params] as const,
    queryFn: async () => {
      const raw = (await api.get('/finance/invoices', { params: { ...params, paged: 1 } }).then(payloadOf)) as Loose;
      return {
        items: arrayFromApi(raw, ['items']).map(normaliseInvoice),
        meta: (raw.meta ?? { page: 1, limit: 25, total: 0, totalPages: 1 }) as LedgerMeta,
        totals: {
          total: decimalToNumber(raw.totals?.totalAmount),
          paid: decimalToNumber(raw.totals?.paidAmount),
          outstanding: decimalToNumber(raw.totals?.outstanding),
        },
        counts: (raw.counts ?? {}) as Record<string, number>,
        facets: {
          classes: ((raw.facets?.classes ?? []) as Array<{ id: string; name: string; schoolName?: string | null }>).map((c, _i, all) => ({
            id: c.id,
            // two schools can both have a "Form 1": tell them apart
            name: c.schoolName && all.some((o) => o.id !== c.id && o.name === c.name) ? `${c.name} · ${c.schoolName}` : c.name,
          })),
          terms: (raw.facets?.terms ?? []) as Array<{ id: string; name: string; academicYearName?: string | null }>,
        },
      };
    },
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: financeKeys.invoice(id),
    queryFn: async () => normaliseInvoice(await api.get(`/finance/invoices/${id}`).then(payloadOf)),
    enabled: Boolean(id),
  });
}

export function useStudentInvoices(studentId: string) {
  return useQuery({
    queryKey: financeKeys.studentInvoices(studentId),
    queryFn: () =>
      api
        .get(`/finance/invoices/student/${studentId}`)
        .then((r) => arrayFromApi(payloadOf(r), ['invoices']).map(normaliseInvoice)),
    enabled: Boolean(studentId),
  });
}

function normalisePayment(raw: unknown) {
  const p = raw as Record<string, unknown>;
  const invoiceId = strOf(p.invoiceId, p.invoice_id);
  return {
    ...p,
    id: strOf(p.id) || crypto.randomUUID(),
    invoiceId,
    paymentNumber: strOf(p.paymentNumber, p.number),
    // Payment column shows the payment reference; Invoice column links the invoice
    number: strOf(p.paymentNumber, p.number, p.id),
    invoiceNumber: strOf(p.invoiceNumber) || '—',
    student: strOf(p.studentName, p.student) || strOf(p.payerName) || 'Payer',
    registration: strOf(p.registrationNumber),
    payer: strOf(p.payerName),
    method: strOf(p.method, p.paymentMethod, p.payment_method),
    amount: decimalToNumber(p.amount ?? p.total),
    status: strOf(p.status, p.approvalStatus, p.paymentStatus) || 'PENDING',
    enteredBy: strOf(p.enteredBy, p.recordedBy) || (p.requiresApproval && p.status === 'PENDING' ? 'Awaiting approval' : 'Finance desk'),
    date: strOf(p.paidAt, p.date, p.createdAt, p.created_at),
    reference: strOf(p.referenceNumber, p.reference, p.bankReference),
    notes: strOf(p.notes, p.comment, p.description),
    receiptId: strOf(p.receiptId),
  };
}

export function usePayments(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: [...financeKeys.payments(), params ?? {}] as const,
    queryFn: () => api.get('/finance/payments', { params }).then((r) => arrayFromApi(payloadOf(r), ['items', 'payments']).map(normalisePayment)),
  });
}

export function usePayment(id: string) {
  return useQuery({
    queryKey: [...financeKeys.payments(), 'detail', id] as const,
    queryFn: async () => {
      const raw = (await api.get(`/finance/payments/${id}`).then(payloadOf)) as Loose;
      return {
        ...normalisePayment(raw),
        receiptNumber: strOf(raw.receiptNumber),
        receiptVoided: Boolean(raw.receiptVoided),
        className: strOf(raw.className),
        invoiceTotal: decimalToNumber(raw.invoiceTotal),
        invoiceOutstanding: decimalToNumber(raw.invoiceOutstanding),
        requiresApproval: Boolean(raw.requiresApproval),
        approval: (raw.approval ?? null) as null | { decision?: string | null; requestedAt?: string; reviewedAt?: string | null; rejectionReason?: string | null; notes?: string | null; supportingDocumentUrl?: string | null },
        confirmedAt: strOf(raw.confirmedAt),
        rejectedAt: strOf(raw.rejectedAt),
        rejectionReason: strOf(raw.rejectionReason),
        refundedAt: strOf(raw.refundedAt),
        refundReason: strOf(raw.refundReason),
        createdAt: strOf(raw.createdAt),
        payerPhone: strOf(raw.payerPhone),
      };
    },
    enabled: Boolean(id),
  });
}

/** One page of the payment ledger with totals and status counts for everything that matches. */
export function usePaymentLedger(params: { page: number; limit?: number; status?: string; method?: string; search?: string; startDate?: string; endDate?: string; studentId?: string }, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...financeKeys.all, 'payment-ledger', params] as const,
    queryFn: async () => {
      const raw = (await api.get('/finance/payments', { params: { ...params, paged: 1 } }).then(payloadOf)) as Loose;
      return {
        items: arrayFromApi(raw, ['items']).map(normalisePayment),
        meta: (raw.meta ?? { page: 1, limit: 25, total: 0, totalPages: 1 }) as LedgerMeta,
        confirmed: { amount: decimalToNumber(raw.totals?.confirmedAmount), count: Number(raw.totals?.confirmedCount ?? 0) },
        counts: (raw.counts ?? {}) as Record<string, number>,
        amounts: Object.fromEntries(Object.entries((raw.amounts ?? {}) as Record<string, unknown>).map(([k, v]) => [k, decimalToNumber(v)])) as Record<string, number>,
      };
    },
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
}

export function usePendingPaymentApprovals() {
  return useQuery({
    queryKey: financeKeys.pendingPaymentApprovals(),
    queryFn: () =>
      api
        .get('/finance/payments/pending-approval')
        .then((r) =>
          // Each row is an approval record with its payment nested inside
          arrayFromApi(payloadOf(r), ['items', 'approvals', 'payments']).map((raw) => {
            const a = raw as Record<string, unknown>;
            const p = (a.payment ?? {}) as Record<string, unknown>;
            return {
              ...p,
              approvalId: strOf(a.id),
              id: strOf(a.id) || crypto.randomUUID(),
              paymentId: strOf(a.paymentId, p.id),
              invoiceId: strOf(p.invoiceId),
              number: strOf(p.paymentNumber),
              invoiceNumber: strOf(a.invoiceNumber),
              student: strOf(a.studentName, p.payerName) || 'Payer',
              registration: strOf(a.registrationNumber),
              method: strOf(p.method),
              amount: decimalToNumber(p.amount),
              status: 'PENDING',
              enteredBy: 'Finance office',
              date: strOf(a.requestedAt, p.paidAt, p.createdAt),
              reference: strOf(p.referenceNumber),
              notes: strOf(a.notes, p.notes),
            };
          }),
        ),
  });
}

function normaliseReceipt(raw: unknown) {
  const rc = raw as Record<string, unknown>;
  return {
    ...rc,
    id: strOf(rc.id) || crypto.randomUUID(),
    number: strOf(rc.number, rc.receiptNumber, rc.id),
    paymentId: strOf(rc.paymentId, rc.payment_id),
    paymentNumber: strOf(rc.paymentNumber),
    invoiceNumber: strOf(rc.invoiceNumber),
    student: strOf(rc.studentName, rc.student, rc.payerName) || 'Payer',
    amount: decimalToNumber(rc.amount ?? rc.total),
    method: strOf(rc.method, rc.paymentMethod, rc.payment_method),
    issuedAt: strOf(rc.issuedAt, rc.issued_at, rc.createdAt, rc.created_at),
    status: rc.isVoided === true ? 'VOID' : strOf(rc.status) || 'ACTIVE',
  };
}

export function useReceipts(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: [...financeKeys.receipts(), params ?? {}] as const,
    queryFn: () => api.get('/finance/receipts', { params }).then((r) => arrayFromApi(payloadOf(r), ['items', 'receipts']).map(normaliseReceipt)),
  });
}

/** One page of the receipt ledger with the active/void counts for everything that matches. */
export function useReceiptLedger(params: { page: number; limit?: number; state?: string; search?: string; studentId?: string }, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...financeKeys.all, 'receipt-ledger', params] as const,
    queryFn: async () => {
      const raw = (await api.get('/finance/receipts', { params: { ...params, paged: 1 } }).then(payloadOf)) as Loose;
      return {
        items: arrayFromApi(raw, ['items']).map(normaliseReceipt),
        meta: (raw.meta ?? { page: 1, limit: 25, total: 0, totalPages: 1 }) as LedgerMeta,
        activeAmount: decimalToNumber(raw.totals?.activeAmount),
        counts: (raw.counts ?? { ALL: 0, ACTIVE: 0, VOID: 0 }) as Record<string, number>,
      };
    },
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
}

export function useReceipt(id: string) {
  return useQuery({
    queryKey: financeKeys.receipt(id),
    queryFn: () => api.get(`/finance/receipts/${id}`).then((r) => normaliseReceipt(payloadOf(r))),
    enabled: Boolean(id),
  });
}

export function useFeeCategories() {
  return useQuery({
    queryKey: financeKeys.feeCategories(),
    queryFn: () =>
      api
        .get('/finance/fee-categories')
        .then((r) =>
          arrayFromApi(payloadOf(r), ['items', 'feeCategories', 'categories']).map((raw) => {
            const c = raw as Record<string, unknown>;
            return {
              ...c,
              id: strOf(c.id) || crypto.randomUUID(),
              name: strOf(c.name, c.categoryName),
              code: strOf(c.code, c.categoryCode),
              order: Number(c.order ?? c.sortOrder ?? c.displayOrder ?? 0),
              amount: Number(c.amount ?? c.defaultAmount ?? 0),
              // categories carry no amount; billing cadence comes from isBillablePerTerm
              mandatory: !(c.isOptional ?? c.optional ?? false),
              frequency: strOf(c.frequency, c.billingFrequency, c.period) || (c.isBillablePerTerm ? 'Per Term' : 'One-time'),
              active: Boolean(c.isActive ?? c.active ?? true),
              usedByStructures: countOf(
                c.usedByStructures ??
                c.usedBy ??
                c.structureCount ??
                (c._count as Record<string, unknown> | undefined)?.feeStructures ??
                0,
              ),
              usedByAssignments: countOf((c._count as Record<string, unknown> | undefined)?.assignments ?? 0),
              usedByInvoices: countOf((c._count as Record<string, unknown> | undefined)?.lineItems ?? 0),
            };
          }),
        ),
  });
}

// Cache classId → class name so fee structures targeted at a specific class
// display the class name (the list endpoint carries only classId).
let classNameMapCache: Map<string, string> | null = null;
async function getClassNameMap(): Promise<Map<string, string>> {
  if (classNameMapCache) return classNameMapCache;
  const map = new Map<string, string>();
  try {
    const rows = await api.get('/students/classes').then((r) => arrayFromApi(payloadOf(r), ['items', 'classes']));
    rows.forEach((c) => {
      const o = c as Record<string, unknown>;
      const name = [strOf(o.name), strOf(o.stream)].filter(Boolean).join(' ').trim();
      map.set(strOf(o.id), name);
    });
  } catch { /* best-effort */ }
  classNameMapCache = map;
  return map;
}

export function useFeeStructures() {
  return useQuery({
    queryKey: financeKeys.feeStructures(),
    queryFn: async () => {
      const [rows, classMap] = await Promise.all([
        api.get('/finance/fee-structures').then((r) => arrayFromApi(payloadOf(r), ['items', 'feeStructures', 'structures'])),
        getClassNameMap(),
      ]);
      return rows.map((raw) => {
        const s = raw as Record<string, unknown>;
        const stage = strOf(s.educationStage, s.stage, s.education_stage);
        const level = Number(s.classLevel ?? s.level ?? 0);
        const classId = strOf(s.classId, s.class_id);
        const className =
          strOf(s.className, s.class, s.class_name) ||
          (classId ? classMap.get(classId) ?? '' : '') ||
          [stage.replace(/_/g, ' '), level ? `Form ${level}` : ''].filter(Boolean).join(' · ') ||
          strOf(s.studentGroup, s.group);
        return {
          ...s,
          id: strOf(s.id) || crypto.randomUUID(),
          // feeCategory is a nested relation; strOf resolves its .name
          category: strOf(s.category, s.feeCategory, s.feeCategoryName),
          className,
          educationStage: stage,
          studentGroup: strOf(s.studentGroup, s.group, s.groupName),
          effectiveTerm: strOf(s.effectiveTerm, s.term, s.termName),
          amount: decimalToNumber(s.amount ?? s.feeAmount),
          currency: strOf(s.currency) || 'TZS',
          active: Boolean(s.isActive ?? s.active ?? true),
          classLevel: level,
        };
      });
    },
  });
}

export function useFeeMatrix() {
  return useQuery({
    queryKey: financeKeys.feeMatrix(),
    queryFn: () => api.get('/finance/fee-structures/matrix').then(payloadOf),
  });
}

export function useStudentGroups() {
  return useQuery({
    queryKey: financeKeys.studentGroups(),
    queryFn: () =>
      api
        .get('/finance/fee-structures/student-groups')
        .then((r) =>
          arrayFromApi(payloadOf(r), ['items', 'studentGroups', 'groups']).map((raw) => {
            const g = raw as Record<string, unknown>;
            const memberships = Array.isArray(g.memberships) ? (g.memberships as Record<string, unknown>[]) : [];
            const activeMembers = memberships.filter((m) => m.isActive !== false).length;
            return {
              ...g,
              id: strOf(g.id) || crypto.randomUUID(),
              code: strOf(g.code, g.groupCode),
              name: strOf(g.name, g.groupName),
              members: countOf(g.members ?? g.memberCount ?? g.studentCount ?? activeMembers),
              active: Boolean(g.isActive ?? g.active ?? true),
              feeTarget: strOf(g.feeTarget, g.feeDescription, g.description),
            };
          }),
        ),
  });
}

export function useFeeAssignments() {
  return useQuery({
    queryKey: financeKeys.feeAssignments(),
    queryFn: async () => {
      const rows = await api.get('/finance/fee-assignments').then((r) => arrayFromApi(payloadOf(r), ['items', 'feeAssignments', 'assignments']));
      return rows.map((raw) => {
        const a = raw as Record<string, unknown>;
        return {
          ...a,
          id: strOf(a.id) || crypto.randomUUID(),
          student: strOf(a.student, a.studentName) || '—',
          className: strOf(a.className, a.class, a.class_name),
          // feeCategory is a nested relation; strOf resolves its .name
          category: strOf(a.category, a.feeCategory, a.feeCategoryName),
          amount: decimalToNumber(a.amount ?? a.feeAmount),
          active: Boolean(a.isActive ?? a.active ?? true),
          notes: strOf(a.notes, a.note, a.description),
          term: strOf(a.term, a.termName),
          effectiveDate: strOf(a.effectiveDate, a.effective_date, a.startDate, a.assignedAt),
        };
      });
    },
  });
}

export function useAssets() {
  const normaliseAsset = (raw: unknown): Record<string, unknown> => {
    const a = raw as Record<string, unknown>;
    const childAssets = arrayFromApi(a, ['childAssets']).map(normaliseAsset);
    return {
      ...a,
      id: strOf(a.id) || crypto.randomUUID(),
      assetNumber: strOf(a.assetNumber, a.number, a.code),
      name: strOf(a.name, a.assetName),
      category: strOf(a.category),
      type: strOf(a.type),
      serialNumber: strOf(a.serialNumber, a.serial),
      serial: strOf(a.serialNumber, a.serial),
      location: strOf(a.location),
      condition: strOf(a.condition) || 'GOOD',
      status: strOf(a.status) || 'ACTIVE',
      brand: strOf(a.brand),
      model: strOf(a.model),
      assignedTo: strOf(a.assignedTo),
      isGroup: a.isGroup === true,
      groupType: strOf(a.groupType),
      parentAssetId: strOf(a.parentAssetId),
      childCount: Number(a.childCount ?? childAssets.length ?? 0),
      quantity: decimalToNumber(a.quantity) || 1,
      unitCost: decimalToNumber(a.unitCost),
      purchaseCost: decimalToNumber(a.groupPurchaseCost ?? a.purchaseCost ?? a.cost ?? a.purchasePrice),
      currentValue: decimalToNumber(a.groupCurrentValue ?? a.currentValue ?? a.value),
      groupPurchaseCost: decimalToNumber(a.groupPurchaseCost),
      groupCurrentValue: decimalToNumber(a.groupCurrentValue),
      currency: strOf(a.currency) || 'TZS',
      purchaseDate: strOf(a.purchaseDate, a.purchasedAt, a.createdAt),
      warrantyExpiry: strOf(a.warrantyExpiryDate, a.warrantyExpiry),
      childAssets,
    };
  };
  return useQuery({
    queryKey: financeKeys.assets(),
    queryFn: () =>
      api.get('/finance/assets', { params: { rootOnly: true, includeChildren: true } }).then((r) =>
        arrayFromApi(payloadOf(r), ['items', 'assets']).map(normaliseAsset),
      ),
  });
}

export function useAssetSummary() {
  return useQuery({
    queryKey: financeKeys.assetSummary(),
    queryFn: () =>
      api.get('/finance/assets/summary').then((r) => {
        const p = payloadOf(r) as Record<string, unknown>;
        return {
          ...p,
          totalAssets: Number(p.totalAssets ?? 0),
          totalPurchaseCost: decimalToNumber(p.totalPurchaseCost),
          totalCurrentValue: decimalToNumber(p.totalCurrentValue),
        };
      }),
  });
}

export function useAsset(id: string) {
  return useQuery({
    queryKey: financeKeys.asset(id),
    queryFn: () => api.get(`/finance/assets/${id}`).then((r) => {
      const normalise = (raw: unknown): Record<string, unknown> => {
        const a = raw as Record<string, unknown>;
        const childAssets = arrayFromApi(a, ['childAssets']).map(normalise);
        return {
          ...a,
          assetNumber: strOf(a.assetNumber),
          serial: strOf(a.serialNumber, a.serial),
          quantity: decimalToNumber(a.quantity) || 1,
          unitCost: decimalToNumber(a.unitCost),
          purchaseCost: decimalToNumber(a.groupPurchaseCost ?? a.purchaseCost),
          currentValue: decimalToNumber(a.groupCurrentValue ?? a.currentValue),
          groupPurchaseCost: decimalToNumber(a.groupPurchaseCost),
          groupCurrentValue: decimalToNumber(a.groupCurrentValue),
          childCount: Number(a.childCount ?? childAssets.length ?? 0),
          childAssets,
        };
      };
      return normalise(payloadOf(r));
    }),
    enabled: Boolean(id),
  });
}

export function useFixedAssetRegister() {
  return useQuery({
    queryKey: [...financeKeys.assets(), 'fixed-register'],
    queryFn: () => api.get('/finance/assets/reports/fixed-asset-register').then(payloadOf),
  });
}

export function useFinanceAuditLogs() {
  return useQuery({
    queryKey: financeKeys.auditLogs(),
    queryFn: () =>
      api
        .get('/finance/audit-logs')
        .then((r) =>
          arrayFromApi(payloadOf(r), ['items', 'logs', 'auditLogs']).map((raw) => {
            const l = raw as Record<string, unknown>;
            const before = (l.previousValue ?? {}) as Record<string, unknown>;
            const after = (l.newValue ?? {}) as Record<string, unknown>;
            const entityType = strOf(l.entityType);
            const entityId   = strOf(l.entityId);
            return {
              ...l,
              id: strOf(l.id) || crypto.randomUUID(),
              date: strOf(l.createdAt, l.created_at, l.timestamp, l.performedAt),
              actor: strOf(l.performedByRole, l.performedBy, l.actor, l.userRole) || 'System',
              actorName: strOf(l.performedByName, l.actorName, l.performedBy) || '',
              actorId: strOf(l.performedById, l.actorId, l.userId) || '',
              action: strOf(l.action, l.eventType) || 'Event',
              entityType,
              entityId,
              entity: [entityType, entityId.slice(0, 8)].filter(Boolean).join(' #'),
              correlationId: strOf(l.correlationId, l.requestId, l.ipAddress),
              before: before as Record<string, string | number | boolean>,
              after:  after  as Record<string, string | number | boolean>,
            };
          }),
        ),
    staleTime: 60_000,
  });
}

export function useCollectionSummary() {
  return useQuery({
    queryKey: financeKeys.collectionSummary(),
    queryFn: async () => {
      const raw = (await api.get('/finance/reports/collection-summary').then(payloadOf)) as Loose;
      const rows = (v: unknown) => (Array.isArray(v) ? (v as Array<Loose>) : []);
      return {
        totalInvoiced: decimalToNumber(raw.totalBilled ?? raw.totalInvoiced),
        totalCollected: decimalToNumber(raw.totalCollected),
        outstanding: decimalToNumber(raw.totalOutstanding ?? raw.outstanding),
        collectionRate: Number(raw.collectionRate ?? 0),
        overdueCount: Number(raw.overdueCount ?? 0),
        overdueAmount: decimalToNumber(raw.overdueAmount),
        byPaymentMethod: rows(raw.byPaymentMethod).map((m) => ({
          method: String(m.method ?? ''),
          totalAmount: decimalToNumber(m.totalAmount ?? m.amount),
          amount: decimalToNumber(m.totalAmount ?? m.amount),
          transactionCount: Number(m.transactionCount ?? m.count ?? 0),
          count: Number(m.transactionCount ?? m.count ?? 0),
        })),
        byFeeCategory: rows(raw.byFeeCategory).map((c) => ({
          category: String(c.feeCategoryName ?? c.category ?? c.name ?? ''),
          name: String(c.feeCategoryName ?? c.category ?? c.name ?? ''),
          totalAmount: decimalToNumber(c.billed ?? c.totalAmount),
        })),
        byClass: rows(raw.byClass).map((c) => ({
          classId: String(c.classId ?? ''),
          className: String(c.className ?? ''),
          invoiceCount: Number(c.invoiceCount ?? 0),
          billed: decimalToNumber(c.billed),
          collected: decimalToNumber(c.collected),
          outstanding: decimalToNumber(c.outstanding),
          collectionRate: Number(c.collectionRate ?? 0),
        })),
        dailyTrend: rows(raw.dailyTrend).map((d) => ({ date: String(d.date), amount: decimalToNumber(d.amount) })),
      };
    },
  });
}

export function useOutstandingBalances() {
  return useQuery({
    queryKey: financeKeys.outstandingBalances(),
    queryFn: async () => {
      const rows = await api.get('/finance/reports/outstanding-balances').then((r) => arrayFromApi(payloadOf(r), ['items', 'balances', 'outstandingBalances']));
      return rows.map((raw) => {
        const b = raw as Record<string, unknown>;
        return {
          ...b,
          invoiceNumber: strOf(b.invoiceNumber, b.number),
          student: strOf(b.student, b.studentName) || '—',
          registration: strOf(b.registration, b.registrationNumber),
          className: strOf(b.className, b.class),
          totalAmount: decimalToNumber(b.totalAmount ?? b.total),
          paidAmount: decimalToNumber(b.paidAmount ?? b.paid),
          outstanding: decimalToNumber(b.outstanding ?? b.outstandingBalance ?? b.balance),
          dueDate: strOf(b.dueDate, b.due_date),
          daysOverdue: Number(b.daysOverdue ?? 0),
        };
      });
    },
  });
}

/** Confirmed collections per day (last 31 days) with the split by payment method. */
export function useDailyCollections() {
  return useQuery({
    queryKey: financeKeys.dailyCollections(),
    queryFn: () =>
      api.get('/finance/reports/daily-summary', { params: { days: 31 } }).then((r) =>
        arrayFromApi(payloadOf(r), ['items', 'collections']).map((raw) => {
          const d = raw as Record<string, unknown>;
          return {
            date: strOf(d.date),
            totalAmount: decimalToNumber(d.totalAmount),
            transactionCount: Number(d.transactionCount ?? 0),
            byMethod: (Array.isArray(d.byMethod) ? d.byMethod : []).map((m) => ({
              method: strOf((m as Record<string, unknown>).method),
              amount: decimalToNumber((m as Record<string, unknown>).amount),
            })),
          };
        }),
      ),
  });
}

/** Every overdue invoice in scope (server-side, biggest debt first), shaped like an invoice row. */
export function useFeeDefaulters() {
  return useQuery({
    queryKey: financeKeys.feeDefaulters(),
    queryFn: () =>
      api
        .get('/finance/reports/fee-defaulters')
        .then((r) => arrayFromApi(payloadOf(r), ['defaulters', 'feeDefaulters', 'items']).map(normaliseInvoice)),
  });
}

export function useStudentStatement(studentId: string) {
  return useQuery({
    queryKey: financeKeys.studentStatement(studentId),
    queryFn: () =>
      api.get(`/finance/reports/student-statement/${studentId}`).then(payloadOf),
    enabled: Boolean(studentId),
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/** Progress of a bulk invoice job; polls until it finishes. */
export function useInvoiceJob(jobId: string) {
  return useQuery({
    queryKey: [...financeKeys.all, 'invoice-job', jobId] as const,
    queryFn: async () =>
      (await api.get(`/finance/invoices/jobs/${jobId}`).then(payloadOf)) as {
        jobId: string;
        status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
        result?: { generated: number; skipped: number; failed: number };
        error?: string;
      },
    enabled: Boolean(jobId),
    refetchInterval: (query) => (query.state.data && (query.state.data.status === 'COMPLETED' || query.state.data.status === 'FAILED') ? false : 1500),
  });
}

export function useGenerateInvoicesMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post('/finance/invoices/generate', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.all }),
  });
}

export function useCashPaymentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post('/finance/payments/cash', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.all }),
  });
}

export function useBankTransferMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post('/finance/payments/bank-transfer', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.all }),
  });
}

export function useApprovePaymentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: Record<string, unknown> }) =>
      api.patch(`/finance/payments/approvals/${id}/approve`, body ?? {}).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.all }),
  });
}

export function useRejectPaymentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: Record<string, unknown> }) =>
      api.patch(`/finance/payments/approvals/${id}/reject`, body ?? {}).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.all }),
  });
}

export function useRefundPaymentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: Record<string, unknown> }) =>
      api.patch(`/finance/payments/${id}/refund`, body ?? {}).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.all }),
  });
}

export function useAddPaymentNoteMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      api.post(`/finance/payments/${id}/notes`, { note }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.all }),
  });
}

export function useVoidReceiptMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: Record<string, unknown> }) =>
      api.patch(`/finance/receipts/${id}/void`, body ?? {}).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.all }),
  });
}

export function useCreateFeeCategoryMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post('/finance/fee-categories', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.feeCategories() }),
  });
}

export function useUpdateFeeCategoryMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.patch(`/finance/fee-categories/${id}`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.feeCategories() }),
  });
}

export function useReorderFeeCategoriesMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) =>
      api.patch('/finance/fee-categories/reorder', { orderedIds }).then((r) => r.data?.data ?? r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.feeCategories() });
      qc.invalidateQueries({ queryKey: financeKeys.feeMatrix() });
    },
  });
}

export function useDeleteFeeCategoryMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete(`/finance/fee-categories/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.feeCategories() }),
  });
}

export function useApplyInvoiceDiscountMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.patch(`/finance/invoices/${id}/discount`, body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.all }),
  });
}

export function useCancelInvoiceMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: Record<string, unknown> }) =>
      api.patch(`/finance/invoices/${id}/cancel`, body ?? {}).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.all }),
  });
}

export function useBulkFeeAssignmentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post('/finance/fee-assignments/bulk', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.all }),
  });
}

export function useDisposeAssetMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: Record<string, unknown> }) =>
      api.patch(`/finance/assets/${id}/dispose`, body ?? {}).then((r) => r.data),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: financeKeys.asset(id) });
      qc.invalidateQueries({ queryKey: financeKeys.assets() });
    },
  });
}

export function useDeleteFeeAssignmentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/finance/fee-assignments/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.all }),
  });
}

export function useCreateFeeStructureMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post('/finance/fee-structures', body).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.feeStructures() }),
  });
}

export function useUpdateFeeStructureMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.patch(`/finance/fee-structures/${id}`, body).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.feeStructures() }),
  });
}

export function useDeactivateFeeStructureMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.patch(`/finance/fee-structures/${id}/deactivate`, {}).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.feeStructures() }),
  });
}

export function useCreateAssetMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post('/finance/assets', body).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.assets() }),
  });
}

export function useUpdateAssetMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.patch(`/finance/assets/${id}`, body).then((r) => r.data?.data ?? r.data),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: financeKeys.asset(id) });
      qc.invalidateQueries({ queryKey: financeKeys.assets() });
    },
  });
}

export function useWaiveInvoiceMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      api.patch(`/finance/invoices/${id}/waive`, body).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.all }),
  });
}

export function useRegeneratePdfMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post(`/finance/invoices/${id}/regenerate-pdf`).then((r) => r.data?.data ?? r.data),
    onSuccess: (_d, id) => qc.invalidateQueries({ queryKey: financeKeys.invoice(id) }),
  });
}

export function useDownloadInvoicePdf(id: string) {
  return useQuery({
    queryKey: [...financeKeys.invoice(id), 'pdf'],
    queryFn: () => api.get(`/finance/invoices/${id}/pdf`, { responseType: 'blob' }).then((r) => r.data as Blob),
    enabled: false,
  });
}

export function useDownloadReceiptPdf(id: string) {
  return useQuery({
    queryKey: [...financeKeys.receipt(id), 'pdf'],
    queryFn: () => api.get(`/finance/receipts/${id}/pdf`, { responseType: 'blob' }).then((r) => r.data as Blob),
    enabled: false,
  });
}
