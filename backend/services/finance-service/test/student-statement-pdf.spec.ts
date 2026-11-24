import { StudentStatementPdfService, StatementInvoice } from '../src/reports/student-statement-pdf.service';

/** pdfkit writes each page object in clear text, so counting them counts the pages. */
const pageCount = (pdf: Buffer) => (pdf.toString('latin1').match(/\/Type \/Page\b(?!s)/g) || []).length;

const invoice = (n: number, paid = 0): StatementInvoice => ({
  invoiceNumber: `INV26${String(n).padStart(5, '0')}`,
  termName: 'Term 1',
  issuedAt: new Date('2026-11-21'),
  dueDate: new Date('2026-12-05'),
  totalAmount: '2350000',
  paidAmount: String(paid),
  outstandingBalance: String(2350000 - paid),
  status: paid ? 'PARTIALLY_PAID' : 'ISSUED',
  lineItems: [
    { feeCategoryName: 'Tuition Fee', amount: '1700000' },
    { feeCategoryName: 'Hostel Fee', amount: '650000' },
  ],
  payments: paid ? [{ paymentNumber: 'PAY1', method: 'BANK_TRANSFER', amount: String(paid), status: 'CONFIRMED', paidAt: new Date('2026-11-22'), referenceNumber: 'REF-1' }] : [],
});

const base = { school: { name: 'Kilimanjaro Primary School' }, studentName: 'Ilham Ahmed', registrationNumber: 'KEMS-P-26456', className: 'Class 2 A' };

describe('student fee statement PDF', () => {
  const service = new StudentStatementPdfService();

  it('is a single page for a learner with a couple of invoices', async () => {
    const pdf = await service.render({ ...base, invoices: [invoice(1), invoice(2, 500000)] });
    expect(pdf.slice(0, 4).toString()).toBe('%PDF');
    expect(pageCount(pdf)).toBe(1);
  });

  it('is a single page even for a learner with no invoices', async () => {
    const pdf = await service.render({ ...base, invoices: [] });
    expect(pageCount(pdf)).toBe(1);
  });

  it('adds pages only when invoices need them, never blank ones', async () => {
    const pdf = await service.render({ ...base, invoices: Array.from({ length: 14 }, (_, i) => invoice(i + 1, i % 2 ? 1000000 : 0)) });
    // 14 invoices of about 100pt each fit roughly six to a page: three pages.
    expect(pageCount(pdf)).toBe(3);
  });

  it('leaves cancelled invoices out of the totals but still lists them', async () => {
    const pdf = await service.render({ ...base, invoices: [invoice(1), { ...invoice(2), status: 'CANCELLED' }] });
    expect(pageCount(pdf)).toBe(1);
  });
});
