// Payment approval flow through the gateway: who may approve, paging, bulk decisions, own-entry rule, short invoice numbers.
// Usage: BASE=http://localhost:3000/api/v1 PW=Test@Kili2026 node backend/scripts/qa/payment-approval-e2e.js
// Needs local test users (finance@, headfinance@, test.hos.primary@) and open invoices in the school named by SCHOOL.
// The Head of Finance enters the payments (every finance role may) and a Head of School decides them.
const BASE = process.env.BASE || 'http://localhost:3000/api/v1';
const PW = process.env.PW || 'Test@Kili2026';
const SCHOOL = process.env.SCHOOL || 'd2ec55b5-1b4e-4268-b3d7-7440e5a4c2a9';
let failures = 0;
const check = (name, cond, extra) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`); if (!cond) failures++; };

async function login(email) {
  const r = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PW }) });
  const j = await r.json();
  if (!j.success) throw new Error(`login ${email}: ${JSON.stringify(j)}`);
  return j.data.accessToken;
}
async function call(token, method, path, body) {
  const headers = { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'x-active-school': SCHOOL };
  const r = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text();
  let j; try { j = JSON.parse(t); } catch { j = t; }
  return { status: r.status, data: j && j.data !== undefined ? j.data : j, message: j && j.message };
}

(async () => {
  const hof = await login('headfinance@demo.kilimanjaro.test');
  const officer = await login('finance@demo.kilimanjaro.test');
  const hos = await login('test.hos.primary@kilimanjaro.test');

  const inv = await call(hof, 'GET', '/finance/invoices?paged=1&limit=60&status=ISSUED');
  const items = inv.data.items || [];
  check('open invoices exist', items.length >= 4, `${items.length}`);
  check('invoice numbers are at most 10 characters', items.every((i) => i.invoiceNumber.length <= 10), items[0]?.invoiceNumber);

  const stamp = Date.now();
  for (const [n, i] of items.slice(0, 4).entries()) {
    const r = await call(hof, 'POST', '/finance/payments/cash', { invoiceId: i.id, amount: '1000', payerName: 'QA Payer', referenceNumber: `QA-${stamp}-${n}` });
    check(`payment entered on ${i.invoiceNumber}`, r.status < 300, r.status + ' ' + (r.message || ''));
  }

  const a1 = await call(officer, 'PATCH', '/finance/payments/approvals/none/approve');
  check('finance officer cannot approve', a1.status === 403, String(a1.status));
  const a2 = await call(officer, 'POST', '/finance/payments/approvals/decide', { decision: 'APPROVE', approvalIds: ['x'] });
  check('finance officer cannot bulk-decide', a2.status === 403, String(a2.status));

  const page = await call(hof, 'GET', '/finance/payments/pending-approval?paged=1&limit=2&sortBy=amount&sortDir=desc');
  check('head of finance reads a paged queue', page.status === 200 && page.data.items.length <= 2 && page.data.meta.limit === 2, JSON.stringify(page.data.meta));
  const all = await call(hof, 'GET', '/finance/payments/pending-approval?paged=1&limit=100');
  const mine = all.data.items.filter((a) => a.payment?.referenceNumber?.startsWith(`QA-${stamp}`));
  check('queue holds the four new payments', mine.length === 4, `${mine.length} of ${all.data.meta.total}`);
  check('queue items carry student, invoice and class', all.data.items.every((a) => 'invoiceNumber' in a && 'studentName' in a && 'className' in a));
  const found = await call(hof, 'GET', `/finance/payments/pending-approval?paged=1&search=${encodeURIComponent(mine[0].invoiceNumber)}`);
  check('search finds a payment by invoice number', found.data.items.some((a) => a.id === mine[0].id));
  const byMethod = await call(hof, 'GET', '/finance/payments/pending-approval?paged=1&method=BANK_TRANSFER');
  check('method filter excludes cash', !byMethod.data.items.some((a) => a.id === mine[0].id));

  const ids = mine.map((a) => a.id);
  const own = await call(hof, 'POST', '/finance/payments/approvals/decide', { decision: 'APPROVE', approvalIds: [ids[0]] });
  check('cannot approve a payment you entered yourself', own.data.failed?.length === 1 && /entered this payment/.test(own.data.failed[0].message), JSON.stringify(own.data.failed));
  const ownReject = await call(hof, 'PATCH', `/finance/payments/approvals/${ids[0]}/reject`, { rejectionReason: 'QA own entry attempt' });
  check('cannot reject one you entered yourself either', ownReject.status === 403, String(ownReject.status));

  const shortReason = await call(hos, 'POST', '/finance/payments/approvals/decide', { decision: 'REJECT', approvalIds: [ids[0]], reason: 'short' });
  check('bulk reject needs a real reason', shortReason.status === 400, String(shortReason.status));
  const rej = await call(hos, 'POST', '/finance/payments/approvals/decide', { decision: 'REJECT', approvalIds: [ids[0]], reason: 'QA test: wrong reference' });
  check('head of school bulk-rejects one', rej.data.succeeded === 1, JSON.stringify(rej.data));
  const appr = await call(hos, 'POST', '/finance/payments/approvals/decide', { decision: 'APPROVE', approvalIds: [...ids.slice(1), 'does-not-exist'] });
  check('bulk approve succeeds for three, reports the bad id without failing', appr.data.succeeded === 3 && appr.data.failed.length === 1, JSON.stringify(appr.data));
  const again = await call(hos, 'POST', '/finance/payments/approvals/decide', { decision: 'APPROVE', approvalIds: [ids[1]] });
  check('deciding twice is reported, not repeated', again.data.failed?.length === 1 && /already/i.test(again.data.failed[0].message), JSON.stringify(again.data.failed));
  const after = await call(hof, 'GET', '/finance/payments/pending-approval?paged=1&limit=100');
  check('decided payments leave the queue', !after.data.items.some((a) => ids.includes(a.id)));

  console.log(failures ? `\n${failures} FAILED` : '\nAll passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
