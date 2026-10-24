import type {
  Asset,
  AuditEntry,
  FeeAssignment,
  FeeCategory,
  FeeStructure,
  FinanceOverview,
  Invoice,
  Payment,
  Receipt,
} from '../types/finance.types';

// Row shapes the finance pages are typed against. Real data always comes from the API (finance.hooks.ts);
// these are intentionally empty so no sample figures can ever leak onto a screen.
export const financeOverview: FinanceOverview = {
  totalInvoiced: 0,
  totalCollected: 0,
  outstanding: 0,
  collectionRate: 0,
  today: 0,
  overdueInvoices: 0,
};

export const invoices: Invoice[] = [];
export const payments: Payment[] = [];
export const receipts: Receipt[] = [];
export const feeCategories: FeeCategory[] = [];
export const feeStructures: FeeStructure[] = [];
export const studentGroups: Array<{ id: string; code: string; name: string; members: number; feeTarget: string }> = [];
export const feeAssignments: FeeAssignment[] = [];
export const assets: Asset[] = [];
export const auditEntries: AuditEntry[] = [];
