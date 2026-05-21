export const financeKeys = {
  all: ['finance'] as const,
  overview: () => [...financeKeys.all, 'overview'] as const,
  invoices: () => [...financeKeys.all, 'invoices'] as const,
  payments: () => [...financeKeys.all, 'payments'] as const,
  pendingApprovals: () => [...financeKeys.payments(), 'pending'] as const,
  receipts: () => [...financeKeys.all, 'receipts'] as const,
  fees: () => [...financeKeys.all, 'fees'] as const,
  assets: () => [...financeKeys.all, 'assets'] as const,
  reports: () => [...financeKeys.all, 'reports'] as const,
  audit: () => [...financeKeys.all, 'audit'] as const,
};
