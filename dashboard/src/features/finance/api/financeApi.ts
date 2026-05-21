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

export const financeOverview: FinanceOverview = {
  totalInvoiced: 121_680_000,
  totalCollected: 89_621_000,
  outstanding: 32_059_000,
  collectionRate: 73.7,
  today: 1_840_000,
  overdueInvoices: 47,
};

export const invoices: Invoice[] = [
  {
    id: 'inv-2026-0001',
    number: 'INV-2026-0001',
    studentId: 'stu-amina',
    student: 'Amina Baraka Juma',
    registration: 'KS-2026-00017',
    guardian: 'Mr. Baraka Juma',
    className: 'Form 2A',
    term: 'Term II 2026',
    total: 1_200_000,
    paid: 800_000,
    outstanding: 400_000,
    status: 'PARTIAL',
    dueDate: 'May 30, 2026',
    lastPayment: 'May 20, 2026',
    lineItems: [
      { category: 'Tuition', amount: 780_000, mandatory: true },
      { category: 'Meals', amount: 210_000, mandatory: false },
      { category: 'Library and ICT', amount: 210_000, mandatory: true },
    ],
  },
  {
    id: 'inv-2026-0002',
    number: 'INV-2026-0002',
    studentId: 'stu-jabir',
    student: 'Jabir Hassan',
    registration: 'KS-2026-00092',
    guardian: 'Mrs. Rehema Hassan',
    className: 'Form 3B',
    term: 'Term II 2026',
    total: 1_450_000,
    paid: 0,
    outstanding: 1_450_000,
    status: 'OVERDUE',
    dueDate: 'May 10, 2026',
    lastPayment: 'None',
    lineItems: [
      { category: 'Tuition', amount: 920_000, mandatory: true },
      { category: 'Boarding', amount: 390_000, mandatory: false },
      { category: 'Science Lab', amount: 140_000, mandatory: true },
    ],
  },
  {
    id: 'inv-2026-0003',
    number: 'INV-2026-0003',
    studentId: 'stu-zahara',
    student: 'Zahara Mushi',
    registration: 'KS-2026-00058',
    guardian: 'Mr. Mushi',
    className: 'Form 4A',
    term: 'Term II 2026',
    total: 1_200_000,
    paid: 1_200_000,
    outstanding: 0,
    status: 'PAID',
    dueDate: 'May 30, 2026',
    lastPayment: 'May 21, 2026',
    lineItems: [
      { category: 'Tuition', amount: 820_000, mandatory: true },
      { category: 'Exam Preparation', amount: 240_000, mandatory: true },
      { category: 'Library and ICT', amount: 140_000, mandatory: true },
    ],
  },
];

export const payments: Payment[] = [
  { id: 'PAY-9001', invoiceId: 'inv-2026-0003', invoiceNumber: 'INV-2026-0003', student: 'Zahara Mushi', method: 'CASH', amount: 600_000, status: 'APPROVED', enteredBy: 'Grace Temba', date: 'May 21, 2026 08:42', receiptId: 'rct-5001', notes: 'Cash drawer FD-02' },
  { id: 'PAY-9002', invoiceId: 'inv-2026-0001', invoiceNumber: 'INV-2026-0001', student: 'Amina Baraka Juma', method: 'BANK', amount: 800_000, status: 'PENDING', enteredBy: 'Grace Temba', date: 'May 21, 2026 10:14', reference: 'CRDB-8841', evidence: 'Bank slip pending review', notes: 'Awaiting principal approval' },
  { id: 'PAY-9003', invoiceId: 'inv-2026-0002', invoiceNumber: 'INV-2026-0002', student: 'Jabir Hassan', method: 'MOBILE_MONEY', amount: 250_000, status: 'REJECTED', enteredBy: 'Grace Temba', date: 'May 20, 2026 15:21', reference: 'MPESA-7442', notes: 'Reference did not match bank statement' },
];

export const receipts: Receipt[] = [
  { id: 'rct-5001', number: 'RCT-2026-5001', paymentId: 'PAY-9001', student: 'Zahara Mushi', amount: 600_000, method: 'CASH', issuedAt: 'May 21, 2026 08:43', status: 'ACTIVE' },
  { id: 'rct-5002', number: 'RCT-2026-5002', paymentId: 'PAY-8998', student: 'Joel Komba', amount: 450_000, method: 'BANK', issuedAt: 'May 20, 2026 11:30', status: 'ACTIVE' },
  { id: 'rct-4991', number: 'RCT-2026-4991', paymentId: 'PAY-8982', student: 'Pendo Shayo', amount: 120_000, method: 'CASH', issuedAt: 'May 18, 2026 14:11', status: 'VOID' },
];

export const feeCategories: FeeCategory[] = [
  { id: 'fee-tuition', order: 1, name: 'Tuition', code: 'TUI', amount: 820_000, frequency: 'Termly', mandatory: true, active: true, usedByStructures: 12 },
  { id: 'fee-board', order: 2, name: 'Boarding', code: 'BRD', amount: 390_000, frequency: 'Termly', mandatory: false, active: true, usedByStructures: 5 },
  { id: 'fee-meals', order: 3, name: 'Meals', code: 'MLS', amount: 210_000, frequency: 'Termly', mandatory: false, active: true, usedByStructures: 8 },
  { id: 'fee-ict', order: 4, name: 'Library and ICT', code: 'ICT', amount: 140_000, frequency: 'Termly', mandatory: true, active: true, usedByStructures: 12 },
];

export const feeStructures: FeeStructure[] = [
  { id: 'fs-f1-tuition', category: 'Tuition', className: 'Form 1', amount: 780_000, effectiveTerm: 'Term II 2026', active: true },
  { id: 'fs-f2-tuition', category: 'Tuition', className: 'Form 2', amount: 820_000, effectiveTerm: 'Term II 2026', active: true },
  { id: 'fs-f3-board', category: 'Boarding', className: 'Form 3', amount: 390_000, effectiveTerm: 'Term II 2026', active: true },
  { id: 'fs-f4-exam', category: 'Exam Preparation', className: 'Form 4', amount: 240_000, effectiveTerm: 'Term II 2026', active: true },
];

export const feeAssignments: FeeAssignment[] = [
  { id: 'asn-001', student: 'Amina Baraka Juma', className: 'Form 2A', category: 'Meals', amount: 210_000, term: 'Term II 2026', effectiveDate: 'May 5, 2026' },
  { id: 'asn-002', student: 'Jabir Hassan', className: 'Form 3B', category: 'Boarding', amount: 390_000, term: 'Term II 2026', effectiveDate: 'May 1, 2026' },
  { id: 'asn-003', student: 'Zahara Mushi', className: 'Form 4A', category: 'Exam Preparation', amount: 240_000, term: 'Term II 2026', effectiveDate: 'May 1, 2026' },
];

export const assets: Asset[] = [
  { id: 'asset-lab-001', name: 'Chemistry Lab Microscope Set', category: 'Science Lab', type: 'Equipment', brand: 'Olympus', serial: 'OLY-KS-4421', purchaseDate: 'Jan 14, 2025', purchaseCost: 9_200_000, currentValue: 7_800_000, location: 'Science Block Lab 2', assignedTo: 'Amina Rashidi', condition: 'Good', warrantyExpiry: 'Jan 14, 2028', status: 'ACTIVE' },
  { id: 'asset-bus-002', name: 'School Bus KJ-17', category: 'Transport', type: 'Vehicle', brand: 'Toyota', serial: 'BUS-KS-0217', purchaseDate: 'Aug 4, 2023', purchaseCost: 112_000_000, currentValue: 91_000_000, location: 'Transport Yard', assignedTo: 'Operations Office', condition: 'Service due', warrantyExpiry: 'Aug 4, 2026', status: 'ACTIVE' },
  { id: 'asset-ict-003', name: 'ICT Lab Desktop Batch', category: 'ICT', type: 'Computers', brand: 'Dell', serial: 'DELL-BATCH-19', purchaseDate: 'Mar 18, 2022', purchaseCost: 34_000_000, currentValue: 11_500_000, location: 'ICT Lab', assignedTo: 'ICT Department', condition: 'Aging', warrantyExpiry: 'Expired', status: 'ACTIVE' },
];

export const auditEntries: AuditEntry[] = [
  { id: 'audit-1001', date: 'May 21, 2026 10:14', actor: 'Grace Temba', action: 'BANK_PAYMENT_CREATED', entity: 'PAY-9002', correlationId: 'FIN-2026-8812', before: { status: 'none' }, after: { status: 'PENDING', amount: 800_000 } },
  { id: 'audit-1002', date: 'May 21, 2026 08:43', actor: 'Grace Temba', action: 'RECEIPT_ISSUED', entity: 'RCT-2026-5001', correlationId: 'FIN-2026-8799', before: { receipt: false }, after: { receipt: true, amount: 600_000 } },
  { id: 'audit-1003', date: 'May 20, 2026 15:21', actor: 'Principal Office', action: 'PAYMENT_REJECTED', entity: 'PAY-9003', correlationId: 'FIN-2026-8740', before: { status: 'PENDING' }, after: { status: 'REJECTED', reason: 'Reference mismatch' } },
];

export const financeApi = {
  getOverview: async () => financeOverview,
  getInvoices: async () => invoices,
  getPayments: async () => payments,
  getReceipts: async () => receipts,
  getFeeCategories: async () => feeCategories,
  getFeeStructures: async () => feeStructures,
  getFeeAssignments: async () => feeAssignments,
  getAssets: async () => assets,
  getAuditEntries: async () => auditEntries,
};
