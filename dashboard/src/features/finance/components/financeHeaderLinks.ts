type FinanceHeaderLink = { to: string; label: string; primary?: boolean };

/** Navigation only: mutations and approvals remain in their existing pages. */
export function financeHeaderLinks(pathname: string): FinanceHeaderLink[] {
  if (pathname === '/finance') return [
    { to: '/finance/invoices', label: 'Invoice Ledger' },
    { to: '/finance/payments', label: 'Payment Ledger', primary: true },
  ];
  if (pathname === '/finance/invoices') return [
    { to: '/finance/invoices/generate', label: 'Generate Invoices', primary: true },
  ];
  if (pathname.startsWith('/finance/invoices/')) return [
    { to: '/finance/invoices', label: 'Back to Invoice Ledger' },
  ];
  if (pathname === '/finance/payments') return [
    { to: '/finance/payments/pending', label: 'Pending Approval' },
    { to: '/finance/payments/bank', label: 'Bank Transfer' },
    { to: '/finance/payments/cash', label: 'Cash Payment', primary: true },
  ];
  if (pathname.startsWith('/finance/payments/')) return [
    { to: '/finance/payments', label: 'Back to Payment Ledger' },
  ];
  if (pathname.startsWith('/finance/receipts/')) return [
    { to: '/finance/receipts', label: 'Back to Receipt Ledger' },
  ];
  if (pathname === '/finance/receipts') return [
    { to: '/finance/payments', label: 'Payment Ledger' },
  ];
  if (pathname === '/finance/fee-categories') return [
    { to: '/finance/fee-categories/create', label: 'Create Category', primary: true },
  ];
  if (pathname.startsWith('/finance/fee-categories/')) return [
    { to: '/finance/fee-categories', label: 'Back to Categories' },
  ];
  if (pathname === '/finance/fee-structures') return [
    { to: '/finance/fee-structures/matrix', label: 'Fee Matrix' },
    { to: '/finance/fee-structures/create', label: 'Create Structure', primary: true },
  ];
  if (pathname.startsWith('/finance/fee-structures/')) return [
    { to: '/finance/fee-structures', label: 'Back to Structures' },
  ];
  if (pathname.startsWith('/finance/assets/')) return [
    { to: '/finance/assets', label: 'Back to Assets Ledger' },
  ];
  if (pathname.startsWith('/finance/reports/')) return [
    { to: '/finance/reports', label: 'Back to Reports' },
  ];
  if (pathname.startsWith('/finance/fund-requests/')) return [
    { to: '/finance/fund-requests', label: 'Back to Fund Requests' },
  ];
  return [];
}
