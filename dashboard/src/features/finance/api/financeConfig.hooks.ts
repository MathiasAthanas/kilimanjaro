import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api/client';
import { arrayFromApi, payloadOf } from '../../../lib/api/response';
import { useSchoolStore } from '../../../lib/school/schoolStore';

export type PaymentAccount = {
  id: string;
  schoolId: string;
  type: 'BANK' | 'MOBILE_MONEY' | 'OTHER';
  bankName: string;
  accountName: string;
  accountNumber: string;
  description?: string | null;
  displayOrder: number;
  isActive: boolean;
  updatedAt?: string;
};

export type BrandingKind = 'logo' | 'signature' | 'stamp';

export type FinanceSettings = {
  schoolId: string;
  accentColor: string;
  invoiceTitle: string;
  invoiceNote: string;
  signatoryName: string;
  residenceChangePolicy: 'NEXT_TERM' | 'THIS_TERM' | 'ASK';
  images: Record<BrandingKind, string | null>;
};

export type PlanInstallmentInput = {
  groupLabel?: string;
  label: string;
  percent?: number;
  fixedAmount?: number;
  isRemainder?: boolean;
  dueDate?: string;
  dueDaysAfterIssue?: number;
};

export type PaymentPlan = {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  residenceType?: 'BOARDING' | 'DAY_SCHOLAR' | null;
  educationStage?: string | null;
  classLevel?: number | null;
  academicYearId?: string | null;
  termId?: string | null;
  coveredCategoryIds: string[];
  otherItemsLabel?: string | null;
  otherItemsDueDays: number;
  installments: Array<{ id: string; sequence: number; groupLabel?: string | null; label: string; percent?: string | null; fixedAmount?: string | null; isRemainder: boolean; dueDate?: string | null; dueDaysAfterIssue?: number | null }>;
};

export type SavePlanInput = {
  name: string;
  description?: string;
  isActive?: boolean;
  residenceType?: 'BOARDING' | 'DAY_SCHOLAR' | null;
  educationStage?: string | null;
  classLevel?: number | null;
  academicYearId?: string | null;
  termId?: string | null;
  coveredCategoryIds?: string[];
  otherItemsLabel?: string;
  otherItemsDueDays?: number;
  installments: PlanInstallmentInput[];
};

export type InvoicePlan = {
  invoiceId: string;
  totalAmount: number;
  paidAmount: number;
  isCustom: boolean;
  template: { id: string; name: string } | null;
  installments: Array<{ id: string; sequence: number; groupLabel?: string | null; label: string; description?: string | null; amount: number; paid: number; balance: number; dueDate: string; overdue: boolean }>;
};

const useSchoolKey = () => useSchoolStore((s) => s.activeSchool?.id ?? '__group__');
const root = ['finance', 'config'] as const;

export function usePaymentAccounts(includeInactive = true) {
  const school = useSchoolKey();
  return useQuery({
    queryKey: [...root, 'accounts', school, includeInactive],
    queryFn: () => api.get('/finance/payment-accounts', { params: { includeInactive } }).then((r) => arrayFromApi(payloadOf(r)) as PaymentAccount[]),
  });
}

function useConfigMutation<TInput, TOutput = unknown>(fn: (input: TInput) => Promise<TOutput>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ['finance'] }) });
}

export const useCreatePaymentAccount = () => useConfigMutation((body: Omit<PaymentAccount, 'id' | 'schoolId' | 'displayOrder' | 'isActive'> & { displayOrder?: number }) => api.post('/finance/payment-accounts', body).then(payloadOf));
export const useUpdatePaymentAccount = () => useConfigMutation(({ id, ...body }: Partial<PaymentAccount> & { id: string }) => api.patch(`/finance/payment-accounts/${id}`, body).then(payloadOf));
export const useRemovePaymentAccount = () => useConfigMutation((id: string) => api.delete(`/finance/payment-accounts/${id}`).then(payloadOf));

export function useFinanceSettings() {
  const school = useSchoolKey();
  return useQuery({ queryKey: [...root, 'settings', school], queryFn: () => api.get('/finance/settings').then((r) => payloadOf(r) as FinanceSettings), retry: false });
}

export const useUpdateFinanceSettings = () =>
  useConfigMutation((body: Partial<Pick<FinanceSettings, 'accentColor' | 'invoiceTitle' | 'invoiceNote' | 'signatoryName' | 'residenceChangePolicy'>>) => api.patch('/finance/settings', body).then(payloadOf));
export const useUploadBrandingImage = () => useConfigMutation(({ kind, dataUrl }: { kind: BrandingKind; dataUrl: string }) => api.put(`/finance/settings/branding/${kind}`, { dataUrl }).then(payloadOf));
export const useRemoveBrandingImage = () => useConfigMutation((kind: BrandingKind) => api.delete(`/finance/settings/branding/${kind}`).then(payloadOf));

export function usePaymentPlans(includeInactive = true) {
  const school = useSchoolKey();
  return useQuery({
    queryKey: [...root, 'plans', school, includeInactive],
    queryFn: () => api.get('/finance/payment-plans', { params: { includeInactive } }).then((r) => arrayFromApi(payloadOf(r)) as PaymentPlan[]),
  });
}

export const useCreatePaymentPlan = () => useConfigMutation((body: SavePlanInput) => api.post('/finance/payment-plans', body).then(payloadOf));
export const useUpdatePaymentPlan = () => useConfigMutation(({ id, ...body }: SavePlanInput & { id: string }) => api.put(`/finance/payment-plans/${id}`, body).then(payloadOf));
export const useSetPlanActive = () => useConfigMutation(({ id, isActive }: { id: string; isActive: boolean }) => api.patch(`/finance/payment-plans/${id}/active`, { isActive }).then(payloadOf));
export const usePreviewPlan = () =>
  useMutation({
    mutationFn: (body: { installments: PlanInstallmentInput[]; amountToSplit: number; otherAmount?: number; otherItemsLabel?: string; otherItemsDueDays?: number }) =>
      api.post('/finance/payment-plans/preview', body).then((r) => payloadOf(r) as { errors: string[]; rows: Array<{ sequence: number; groupLabel: string | null; label: string; description: string | null; amount: number; dueDate: string }> }),
  });
export const useApplyPlansToTerm = () =>
  useConfigMutation((body: { academicYearId: string; termId: string; templateId?: string }) => api.post('/finance/payment-plans/apply-to-term', body).then((r) => payloadOf(r) as { checked: number; applied: number; skipped: number }));

export function useInvoicePlan(invoiceId?: string) {
  return useQuery({
    queryKey: [...root, 'invoice-plan', invoiceId],
    queryFn: () => api.get(`/finance/invoices/${invoiceId}/plan`).then((r) => payloadOf(r) as InvoicePlan),
    enabled: !!invoiceId,
  });
}

export const useApplyInvoicePlan = () => useConfigMutation(({ invoiceId, templateId }: { invoiceId: string; templateId?: string }) => api.post(`/finance/invoices/${invoiceId}/plan`, templateId ? { templateId } : {}).then(payloadOf));
export const useSetCustomInvoicePlan = () =>
  useConfigMutation(({ invoiceId, ...body }: { invoiceId: string; reason: string; installments: Array<{ groupLabel?: string; label: string; amount: number; dueDate: string }> }) => api.put(`/finance/invoices/${invoiceId}/plan`, body).then(payloadOf));
export const useClearInvoicePlan = () => useConfigMutation((invoiceId: string) => api.delete(`/finance/invoices/${invoiceId}/plan`).then(payloadOf));
export const useNotifyParentOfInvoice = () => useConfigMutation((invoiceId: string) => api.post(`/finance/invoices/${invoiceId}/send`).then(payloadOf));

/** Opens a sample invoice PDF drawn with the school's current payment info and branding. */
export async function openSampleInvoice(): Promise<void> {
  const response = await api.get('/finance/invoices/preview/pdf', { responseType: 'blob' });
  const url = URL.createObjectURL(new Blob([response.data as BlobPart], { type: 'application/pdf' }));
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
