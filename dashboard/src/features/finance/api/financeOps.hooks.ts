import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';
import { arrayFromApi, payloadOf } from '../../../lib/api/response';

// ─── helpers ────────────────────────────────────────────────────────────────
function num(raw: unknown): number {
  if (typeof raw === 'number') return isNaN(raw) ? 0 : raw;
  if (typeof raw === 'string') { const n = Number(raw); return isNaN(n) ? 0 : n; }
  if (raw && typeof raw === 'object') {
    const o = raw as { s?: number; e?: number; d?: number[] };
    if (Array.isArray(o.d)) {
      const digits = o.d.map((v, i) => (i === 0 ? String(v) : String(v).padStart(7, '0'))).join('');
      const value = Number(digits) * Math.pow(10, (o.e ?? 0) + 1 - digits.length);
      return (o.s ?? 1) * (isNaN(value) ? 0 : value);
    }
  }
  return 0;
}
function str(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
  return '';
}

// ─── query keys ───────────────────────────────────────────────────────────────
export const opsKeys = {
  all: ['finance-ops'] as const,
  expenses: (p?: Record<string, unknown>) => [...opsKeys.all, 'expenses', p ?? {}] as const,
  expenseSummary: (p?: Record<string, unknown>) => [...opsKeys.all, 'expenses', 'summary', p ?? {}] as const,
  fundRequests: (p?: Record<string, unknown>) => [...opsKeys.all, 'fund-requests', p ?? {}] as const,
  fundRequest: (id: string) => [...opsKeys.all, 'fund-requests', id] as const,
  fundSummary: () => [...opsKeys.all, 'fund-requests', 'summary'] as const,
  storeItems: (p?: Record<string, unknown>) => [...opsKeys.all, 'store', 'items', p ?? {}] as const,
  storeItem: (id: string) => [...opsKeys.all, 'store', 'items', id] as const,
  storeSummary: () => [...opsKeys.all, 'store', 'summary'] as const,
  storeMovements: (p?: Record<string, unknown>) => [...opsKeys.all, 'store', 'movements', p ?? {}] as const,
};

// ─── Expenses ──────────────────────────────────────────────────────────────────
export type ExpenseRow = {
  id: string; expenseNumber: string; category: string; description: string; amount: number;
  payee: string; paymentMethod: string; reference: string; department: string; status: string;
  incurredAt: string; recordedByName: string; recordedByRole: string; fundRequestId: string; notes: string;
};
function normaliseExpense(raw: unknown): ExpenseRow {
  const e = raw as Record<string, unknown>;
  return {
    id: str(e.id), expenseNumber: str(e.expenseNumber), category: str(e.category),
    description: str(e.description), amount: num(e.amount), payee: str(e.payee),
    paymentMethod: str(e.paymentMethod), reference: str(e.reference), department: str(e.department),
    status: str(e.status) || 'RECORDED', incurredAt: str(e.incurredAt),
    recordedByName: str(e.recordedByName), recordedByRole: str(e.recordedByRole),
    fundRequestId: str(e.fundRequestId), notes: str(e.notes),
  };
}
export function useExpenses(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: opsKeys.expenses(params),
    queryFn: () => api.get('/finance/expenses', { params }).then((r) => arrayFromApi(payloadOf(r), ['items']).map(normaliseExpense)),
  });
}
export function useExpenseSummary(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: opsKeys.expenseSummary(params),
    queryFn: () => api.get('/finance/expenses/summary', { params }).then((r) => {
      const p = payloadOf(r) as Record<string, unknown>;
      return {
        totalSpent: num(p.totalSpent), count: Number(p.count ?? 0),
        byCategory: arrayFromApi(p, ['byCategory']).map((c) => { const o = c as Record<string, unknown>; return { category: str(o.category), total: num(o.total), count: Number(o.count ?? 0) }; }),
        byDepartment: arrayFromApi(p, ['byDepartment']).map((c) => { const o = c as Record<string, unknown>; return { department: str(o.department), total: num(o.total) }; }),
      };
    }),
  });
}
export function useCreateExpenseMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/finance/expenses', body).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: opsKeys.all }),
  });
}
export function useVoidExpenseMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.patch(`/finance/expenses/${id}/void`, { reason }).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: opsKeys.all }),
  });
}

// ─── Fund requests ──────────────────────────────────────────────────────────────
export type FundEvent = { id: string; action: string; actorName: string; actorRole: string; note: string; createdAt: string };
export type FundRequestRow = {
  id: string; requestNumber: string; title: string; description: string; category: string; amount: number;
  department: string; status: string; requestedByName: string; requestedByRole: string; neededBy: string;
  bursarName: string; bursarNote: string; forwardedAt: string;
  principalName: string; principalNote: string; decidedAt: string; rejectionReason: string;
  disbursedByName: string; disbursementMethod: string; disbursementRef: string; disbursedAt: string;
  expenseId: string; createdAt: string; events: FundEvent[];
};
function normaliseFund(raw: unknown): FundRequestRow {
  const f = raw as Record<string, unknown>;
  return {
    id: str(f.id), requestNumber: str(f.requestNumber), title: str(f.title), description: str(f.description),
    category: str(f.category), amount: num(f.amount), department: str(f.department), status: str(f.status) || 'SUBMITTED',
    requestedByName: str(f.requestedByName) || str(f.requestedByRole), requestedByRole: str(f.requestedByRole), neededBy: str(f.neededBy),
    bursarName: str(f.bursarName), bursarNote: str(f.bursarNote), forwardedAt: str(f.forwardedAt),
    principalName: str(f.principalName), principalNote: str(f.principalNote), decidedAt: str(f.decidedAt), rejectionReason: str(f.rejectionReason),
    disbursedByName: str(f.disbursedByName), disbursementMethod: str(f.disbursementMethod), disbursementRef: str(f.disbursementRef), disbursedAt: str(f.disbursedAt),
    expenseId: str(f.expenseId), createdAt: str(f.createdAt),
    events: arrayFromApi(f, ['events']).map((e) => { const o = e as Record<string, unknown>; return { id: str(o.id), action: str(o.action), actorName: str(o.actorName) || str(o.actorRole), actorRole: str(o.actorRole), note: str(o.note), createdAt: str(o.createdAt) }; }),
  };
}
export function useFundRequests(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: opsKeys.fundRequests(params),
    queryFn: () => api.get('/finance/fund-requests', { params }).then((r) => arrayFromApi(payloadOf(r), ['items']).map(normaliseFund)),
  });
}
export function useFundRequest(id: string) {
  return useQuery({
    queryKey: opsKeys.fundRequest(id),
    queryFn: () => api.get(`/finance/fund-requests/${id}`).then((r) => normaliseFund(payloadOf(r))),
    enabled: Boolean(id),
  });
}
export function useFundRequestSummary() {
  return useQuery({
    queryKey: opsKeys.fundSummary(),
    queryFn: () => api.get('/finance/fund-requests/summary').then((r) => {
      const p = payloadOf(r) as Record<string, unknown>;
      return {
        pendingForward: Number(p.pendingForward ?? 0),
        pendingApproval: Number(p.pendingApproval ?? 0),
        approvedAwaitingDisbursement: Number(p.approvedAwaitingDisbursement ?? 0),
        byStatus: (p.byStatus ?? {}) as Record<string, { count: number; total: unknown }>,
      };
    }),
  });
}
export function useCreateFundRequestMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/finance/fund-requests', body).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: opsKeys.all }),
  });
}
function fundAction(action: string) {
  return function useFundActionMutation() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: ({ id, body }: { id: string; body?: Record<string, unknown> }) =>
        api.patch(`/finance/fund-requests/${id}/${action}`, body ?? {}).then((r) => r.data?.data ?? r.data),
      onSuccess: () => qc.invalidateQueries({ queryKey: opsKeys.all }),
    });
  };
}
export const useForwardFundRequestMutation = fundAction('forward');
export const useApproveFundRequestMutation = fundAction('approve');
export const useRejectFundRequestMutation = fundAction('reject');
export const useDisburseFundRequestMutation = fundAction('disburse');
export const useCancelFundRequestMutation = fundAction('cancel');

// ─── Store / inventory ──────────────────────────────────────────────────────────
export type StoreItemRow = {
  id: string; itemCode: string; name: string; category: string; unit: string; description: string;
  quantityOnHand: number; reorderLevel: number; unitCost: number; location: string; isActive: boolean;
  lowStock: boolean; stockValue: number;
};
function normaliseStoreItem(raw: unknown): StoreItemRow {
  const i = raw as Record<string, unknown>;
  const qty = num(i.quantityOnHand); const cost = num(i.unitCost); const reorder = num(i.reorderLevel);
  return {
    id: str(i.id), itemCode: str(i.itemCode), name: str(i.name), category: str(i.category),
    unit: str(i.unit) || 'unit', description: str(i.description), quantityOnHand: qty, reorderLevel: reorder,
    unitCost: cost, location: str(i.location), isActive: i.isActive !== false,
    lowStock: typeof i.lowStock === 'boolean' ? i.lowStock : qty <= reorder, stockValue: num(i.stockValue) || qty * cost,
  };
}
export function useStoreItems(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: opsKeys.storeItems(params),
    queryFn: () => api.get('/finance/store/items', { params }).then((r) => arrayFromApi(payloadOf(r), ['items']).map(normaliseStoreItem)),
  });
}
export function useStoreItem(id: string) {
  return useQuery({
    queryKey: opsKeys.storeItem(id),
    queryFn: () => api.get(`/finance/store/items/${id}`).then((r) => {
      const p = payloadOf(r) as Record<string, unknown>;
      return {
        ...normaliseStoreItem(p),
        movements: arrayFromApi(p, ['movements']).map((m) => {
          const o = m as Record<string, unknown>;
          return { id: str(o.id), movementNumber: str(o.movementNumber), type: str(o.type), quantity: num(o.quantity), unitCost: num(o.unitCost), totalValue: num(o.totalValue), balanceAfter: num(o.balanceAfter), supplier: str(o.supplier), issuedTo: str(o.issuedTo), department: str(o.department), reference: str(o.reference), reason: str(o.reason), occurredAt: str(o.occurredAt), recordedByName: str(o.recordedByName) };
        }),
      };
    }),
    enabled: Boolean(id),
  });
}
export function useStoreSummary() {
  return useQuery({
    queryKey: opsKeys.storeSummary(),
    queryFn: () => api.get('/finance/store/summary').then((r) => {
      const p = payloadOf(r) as Record<string, unknown>;
      return {
        totalItems: Number(p.totalItems ?? 0), lowStockCount: Number(p.lowStockCount ?? 0), totalStockValue: num(p.totalStockValue),
        byCategory: arrayFromApi(p, ['byCategory']).map((c) => { const o = c as Record<string, unknown>; return { category: str(o.category), count: Number(o.count ?? 0), value: num(o.value) }; }),
      };
    }),
  });
}
export function useStoreMovements(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: opsKeys.storeMovements(params),
    queryFn: () => api.get('/finance/store/movements', { params }).then((r) => arrayFromApi(payloadOf(r), ['items']).map((m) => {
      const o = m as Record<string, unknown>;
      const item = (o.storeItem ?? {}) as Record<string, unknown>;
      return { id: str(o.id), movementNumber: str(o.movementNumber), type: str(o.type), quantity: num(o.quantity), totalValue: num(o.totalValue), balanceAfter: num(o.balanceAfter), itemName: str(item.name), unit: str(item.unit), issuedTo: str(o.issuedTo), supplier: str(o.supplier), department: str(o.department), occurredAt: str(o.occurredAt), recordedByName: str(o.recordedByName) };
    })),
  });
}
export function useCreateStoreItemMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/finance/store/items', body).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: opsKeys.all }),
  });
}
export function useUpdateStoreItemMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api.patch(`/finance/store/items/${id}`, body).then((r) => r.data?.data ?? r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: opsKeys.all }),
  });
}
function stockAction(action: string) {
  return function useStockMutation() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
        api.post(`/finance/store/items/${id}/${action}`, body).then((r) => r.data?.data ?? r.data),
      onSuccess: () => qc.invalidateQueries({ queryKey: opsKeys.all }),
    });
  };
}
export const useReceiveStockMutation = stockAction('receive');
export const useIssueStockMutation = stockAction('issue');
export const useAdjustStockMutation = stockAction('adjust');
