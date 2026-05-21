export type FinanceStatus =
  | 'PAID'
  | 'PARTIAL'
  | 'OVERDUE'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'VOID'
  | 'ACTIVE'
  | 'INACTIVE'
  | 'DISPOSED';

export type PaymentMethod = 'CASH' | 'BANK' | 'MOBILE_MONEY';

export type Invoice = {
  id: string;
  number: string;
  studentId: string;
  student: string;
  registration: string;
  guardian: string;
  className: string;
  term: string;
  total: number;
  paid: number;
  outstanding: number;
  status: Extract<FinanceStatus, 'PAID' | 'PARTIAL' | 'OVERDUE' | 'VOID'>;
  dueDate: string;
  lastPayment: string;
  lineItems: Array<{ category: string; amount: number; mandatory: boolean }>;
};

export type Payment = {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  student: string;
  method: PaymentMethod;
  amount: number;
  status: Extract<FinanceStatus, 'PENDING' | 'APPROVED' | 'REJECTED'>;
  enteredBy: string;
  date: string;
  receiptId?: string;
  reference?: string;
  evidence?: string;
  notes: string;
};

export type Receipt = {
  id: string;
  number: string;
  paymentId: string;
  student: string;
  amount: number;
  method: PaymentMethod;
  issuedAt: string;
  status: Extract<FinanceStatus, 'ACTIVE' | 'VOID'>;
};

export type FeeCategory = {
  id: string;
  order: number;
  name: string;
  code: string;
  amount: number;
  frequency: string;
  mandatory: boolean;
  active: boolean;
  usedByStructures: number;
};

export type FeeStructure = {
  id: string;
  category: string;
  className: string;
  amount: number;
  effectiveTerm: string;
  active: boolean;
};

export type FeeAssignment = {
  id: string;
  student: string;
  className: string;
  category: string;
  amount: number;
  term: string;
  effectiveDate: string;
};

export type Asset = {
  id: string;
  name: string;
  category: string;
  type: string;
  brand: string;
  serial: string;
  purchaseDate: string;
  purchaseCost: number;
  currentValue: number;
  location: string;
  assignedTo: string;
  condition: string;
  warrantyExpiry: string;
  status: Extract<FinanceStatus, 'ACTIVE' | 'DISPOSED'>;
};

export type AuditEntry = {
  id: string;
  date: string;
  actor: string;
  action: string;
  entity: string;
  correlationId: string;
  before: Record<string, string | number | boolean>;
  after: Record<string, string | number | boolean>;
};

export type FinanceOverview = {
  totalInvoiced: number;
  totalCollected: number;
  outstanding: number;
  collectionRate: number;
  today: number;
  overdueInvoices: number;
};
