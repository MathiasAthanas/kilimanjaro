import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';

// ─── Query key factory ────────────────────────────────────────────────────────

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
    queryFn: () =>
      api.get('/finance/dashboard').then((res) => res.data?.data ?? res.data),
    staleTime: 60_000,
  });
}

export function useFinanceOverview() {
  return useQuery({
    queryKey: financeKeys.overview(),
    queryFn: () =>
      api.get('/analytics/finance/overview').then((res) => res.data?.data ?? res.data),
    staleTime: 60_000,
  });
}

export function useInvoices(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: financeKeys.invoices(params),
    queryFn: () =>
      api
        .get('/finance/invoices', { params })
        .then((res) => res.data?.data?.items ?? res.data?.data ?? []),
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: financeKeys.invoice(id),
    queryFn: () =>
      api.get(`/finance/invoices/${id}`).then((res) => res.data?.data ?? res.data),
    enabled: Boolean(id),
  });
}

export function useStudentInvoices(studentId: string) {
  return useQuery({
    queryKey: financeKeys.studentInvoices(studentId),
    queryFn: () =>
      api
        .get(`/finance/invoices/student/${studentId}`)
        .then((res) => res.data?.data?.items ?? res.data?.data ?? []),
    enabled: Boolean(studentId),
  });
}

export function usePayments() {
  return useQuery({
    queryKey: financeKeys.payments(),
    queryFn: () =>
      api.get('/finance/payments').then((res) => res.data?.data?.items ?? res.data?.data ?? []),
  });
}

export function usePendingPaymentApprovals() {
  return useQuery({
    queryKey: financeKeys.pendingPaymentApprovals(),
    queryFn: () =>
      api
        .get('/finance/payments/pending-approval')
        .then((res) => res.data?.data?.items ?? res.data?.data ?? []),
  });
}

export function useReceipts() {
  return useQuery({
    queryKey: financeKeys.receipts(),
    queryFn: () =>
      api.get('/finance/receipts').then((res) => res.data?.data?.items ?? res.data?.data ?? []),
  });
}

export function useReceipt(id: string) {
  return useQuery({
    queryKey: financeKeys.receipt(id),
    queryFn: () =>
      api.get(`/finance/receipts/${id}`).then((res) => res.data?.data ?? res.data),
    enabled: Boolean(id),
  });
}

export function useFeeCategories() {
  return useQuery({
    queryKey: financeKeys.feeCategories(),
    queryFn: () =>
      api
        .get('/finance/fee-categories')
        .then((res) => res.data?.data?.items ?? res.data?.data ?? []),
  });
}

export function useFeeStructures() {
  return useQuery({
    queryKey: financeKeys.feeStructures(),
    queryFn: () =>
      api
        .get('/finance/fee-structures')
        .then((res) => res.data?.data?.items ?? res.data?.data ?? []),
  });
}

export function useFeeMatrix() {
  return useQuery({
    queryKey: financeKeys.feeMatrix(),
    queryFn: () =>
      api
        .get('/finance/fee-structures/matrix')
        .then((res) => res.data?.data ?? res.data),
  });
}

export function useStudentGroups() {
  return useQuery({
    queryKey: financeKeys.studentGroups(),
    queryFn: () =>
      api
        .get('/finance/fee-structures/student-groups')
        .then((res) => res.data?.data?.items ?? res.data?.data ?? []),
  });
}

export function useFeeAssignments() {
  return useQuery({
    queryKey: financeKeys.feeAssignments(),
    queryFn: () =>
      api
        .get('/finance/fee-assignments')
        .then((res) => res.data?.data?.items ?? res.data?.data ?? []),
  });
}

export function useAssets() {
  return useQuery({
    queryKey: financeKeys.assets(),
    queryFn: () =>
      api.get('/finance/assets').then((res) => res.data?.data?.items ?? res.data?.data ?? []),
  });
}

export function useAssetSummary() {
  return useQuery({
    queryKey: financeKeys.assetSummary(),
    queryFn: () =>
      api.get('/finance/assets/summary').then((res) => res.data?.data ?? res.data),
  });
}

export function useAsset(id: string) {
  return useQuery({
    queryKey: financeKeys.asset(id),
    queryFn: () =>
      api.get(`/finance/assets/${id}`).then((res) => res.data?.data ?? res.data),
    enabled: Boolean(id),
  });
}

export function useFinanceAuditLogs() {
  return useQuery({
    queryKey: financeKeys.auditLogs(),
    queryFn: () =>
      api
        .get('/finance/audit-logs')
        .then((res) => res.data?.data?.items ?? res.data?.data ?? []),
    staleTime: 60_000,
  });
}

export function useCollectionSummary() {
  return useQuery({
    queryKey: financeKeys.collectionSummary(),
    queryFn: () =>
      api
        .get('/finance/reports/collection-summary')
        .then((res) => res.data?.data ?? res.data),
  });
}

export function useOutstandingBalances() {
  return useQuery({
    queryKey: financeKeys.outstandingBalances(),
    queryFn: () =>
      api
        .get('/finance/reports/outstanding-balances')
        .then((res) => res.data?.data?.items ?? res.data?.data ?? []),
  });
}

export function useDailyCollections() {
  return useQuery({
    queryKey: financeKeys.dailyCollections(),
    queryFn: () =>
      api
        .get('/finance/reports/daily-collections')
        .then((res) => res.data?.data?.items ?? res.data?.data ?? []),
  });
}

export function useFeeDefaulters() {
  return useQuery({
    queryKey: financeKeys.feeDefaulters(),
    queryFn: () =>
      api
        .get('/finance/reports/fee-defaulters')
        .then((res) => res.data?.data?.items ?? res.data?.data ?? []),
  });
}

export function useStudentStatement(studentId: string) {
  return useQuery({
    queryKey: financeKeys.studentStatement(studentId),
    queryFn: () =>
      api
        .get(`/finance/reports/student-statement/${studentId}`)
        .then((res) => res.data?.data ?? res.data),
    enabled: Boolean(studentId),
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useGenerateInvoicesMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post('/finance/invoices/generate', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.invoices() }),
  });
}

export function useCashPaymentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post('/finance/payments/cash', body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.payments() });
      qc.invalidateQueries({ queryKey: financeKeys.invoices() });
    },
  });
}

export function useBankTransferMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post('/finance/payments/bank-transfer', body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.payments() });
      qc.invalidateQueries({ queryKey: financeKeys.invoices() });
    },
  });
}

export function useApprovePaymentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: Record<string, unknown> }) =>
      api.patch(`/finance/payments/approvals/${id}/approve`, body ?? {}).then((r) => r.data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: financeKeys.pendingPaymentApprovals() }),
  });
}

export function useRejectPaymentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: Record<string, unknown> }) =>
      api.patch(`/finance/payments/approvals/${id}/reject`, body ?? {}).then((r) => r.data),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: financeKeys.pendingPaymentApprovals() }),
  });
}

export function useRefundPaymentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: Record<string, unknown> }) =>
      api.patch(`/finance/payments/${id}/refund`, body ?? {}).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.payments() }),
  });
}

export function useVoidReceiptMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: Record<string, unknown> }) =>
      api.patch(`/finance/receipts/${id}/void`, body ?? {}).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.receipts() }),
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
    onSuccess: (_d, { id }) => qc.invalidateQueries({ queryKey: financeKeys.invoice(id) }),
  });
}

export function useCancelInvoiceMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: Record<string, unknown> }) =>
      api.patch(`/finance/invoices/${id}/cancel`, body ?? {}).then((r) => r.data),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: financeKeys.invoice(id) });
      qc.invalidateQueries({ queryKey: financeKeys.invoices() });
    },
  });
}

export function useBulkFeeAssignmentMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post('/finance/fee-assignments/bulk', body).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: financeKeys.feeAssignments() }),
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
