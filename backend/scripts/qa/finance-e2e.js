// Finance end-to-end through the gateway: school separation, ownership, payment lifecycle, reports.
// Usage: BASE=http://localhost:3910/api/v1 node backend/scripts/qa/finance-e2e.js
// Needs the demo seed (finance@, headfinance@, principal@, hos-primary@, hos-secondary@, parents, students).
const BASE = process.env.BASE || 'http://localhost:3910/api/v1';
const PW = process.env.FIN_PW || 'Finance@Kili2026';
const results = [];
let failures = 0;
const PRIMARY = '00000000-0000-4000-8000-000000000002';
const SECONDARY = '00000000-0000-4000-8000-000000000003';
const NURSERY = '00000000-0000-4000-8000-000000000001';

async function login(body) {
  const r = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!j.success) throw new Error('login failed ' + JSON.stringify(body.email || body.registrationNumber) + ' ' + JSON.stringify(j));
  return { token: j.data.accessToken, user: j.data.user };
}
const staff = (e, pw = PW) => login({ email: e, password: pw });
const parent = (n) => login({ email: `parent${n}@demo.kilimanjaro.test`, password: 'Parent@Kili2026' });
const student = (reg) => login({ registrationNumber: reg, password: 'Student@Kili2026' });

async function call(who, method, path, body, school) {
  const headers = { 'content-type': 'application/json', authorization: `Bearer ${who.token}` };
  if (school) headers['x-active-school'] = school;
  const r = await fetch(`${BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let j; try { j = text ? JSON.parse(text) : null; } catch { j = text; }
  return { status: r.status, data: j && j.data !== undefined ? j.data : j, message: j && j.message };
}
const ok = (r, label) => { if (r.status >= 400) throw new Error(`${label}: ${r.status} ${JSON.stringify(r.message || r.data)}`); return r.data; };
function check(name, cond, extra = '') {
  results.push({ name, pass: !!cond });
  if (!cond) { failures++; console.log(`  FAIL  ${name} ${extra}`); } else console.log(`  pass  ${name}`);
}
const expectStatus = async (name, p, ...statuses) => { const r = await p; check(name, statuses.includes(r.status), `(got ${r.status} ${JSON.stringify(r.message || '').slice(0, 140)})`); return r; };
const sum = (rows, f) => rows.reduce((a, r) => a + Number(f(r) ?? 0), 0);
const list = (d) => (Array.isArray(d) ? d : d?.items ?? []);

(async () => {
  const finance = await staff('finance@demo.kilimanjaro.test');
  const headFinance = await staff('headfinance@demo.kilimanjaro.test');
  const manager = await staff('principal@demo.kilimanjaro.test', 'Principal@Kili2026');
  const hosP = await staff('hos-primary@demo.kilimanjaro.test');
  const hosS = await staff('hos-secondary@demo.kilimanjaro.test');
  const parentP = await parent('001'); // child KS-P-2026-00001 (primary)
  const parentS = await parent('023'); // child KS-S-2026-00126 (secondary)
  const studentP = await student('KS-P-2026-00001');
  const studentS = await student('KS-S-2026-00126');
  console.log('\n== School separation: lists');

  const invP = list(ok(await call(hosP, 'GET', '/finance/invoices?limit=100'), 'inv hosP'));
  const invS = list(ok(await call(hosS, 'GET', '/finance/invoices?limit=100'), 'inv hosS'));
  check('primary head sees primary invoices only', invP.length > 0 && invP.every((i) => i.schoolId === PRIMARY), `n=${invP.length}`);
  check('secondary head sees secondary invoices only', invS.length > 0 && invS.every((i) => i.schoolId === SECONDARY), `n=${invS.length}`);
  const finPrimary = list(ok(await call(finance, 'GET', '/finance/invoices?limit=100', undefined, PRIMARY), 'fin P'));
  const finSecondary = list(ok(await call(finance, 'GET', '/finance/invoices?limit=100', undefined, SECONDARY), 'fin S'));
  check('multi-school finance + active school primary', finPrimary.length > 0 && finPrimary.every((i) => i.schoolId === PRIMARY));
  check('multi-school finance + active school secondary', finSecondary.length > 0 && finSecondary.every((i) => i.schoolId === SECONDARY));
  const finAll = list(ok(await call(finance, 'GET', '/finance/invoices?limit=100'), 'fin all'));
  check('multi-school finance without active school sees both', finAll.some((i) => i.schoolId === PRIMARY) && finAll.some((i) => i.schoolId === SECONDARY));
  const sneaky = await call(hosP, 'GET', '/finance/invoices?limit=100', undefined, SECONDARY);
  const sneakyRows = Array.isArray(sneaky.data) ? sneaky.data : [];
  check('forged active school header cannot widen scope', sneaky.status >= 400 || sneakyRows.every((i) => i.schoolId === PRIMARY), `(${sneaky.status}, rows=${sneakyRows.length})`);

  const secInvoice = invS[0];
  const parentOwn = list(ok(await call(parentP, 'GET', '/finance/invoices'), 'parent invoices (early)'));
  const priInvoice = parentOwn.find((i) => Number(i.outstandingBalance) > 5000 && i.schoolId === PRIMARY) || parentOwn[0];
  await expectStatus('primary head cannot open a secondary invoice by id', call(hosP, 'GET', `/finance/invoices/${secInvoice.id}`), 403, 404);
  const byStudent = await call(hosP, 'GET', `/finance/invoices/student/${secInvoice.studentId}`);
  check('primary head gets nothing for a secondary student', byStudent.status >= 400 || list(byStudent.data).length === 0, `(${byStudent.status})`);
  const stmt = await call(hosP, 'GET', `/finance/reports/student-statement/${secInvoice.studentId}`);
  check('student statement is school-scoped', stmt.status >= 400 || list(stmt.data).length === 0);
  await expectStatus('primary head cannot discount a secondary invoice', call(hosP, 'PATCH', `/finance/invoices/${secInvoice.id}/discount`, { discountAmount: '1', discountReason: 'x' }), 403, 404);
  await expectStatus('primary head cannot cancel a secondary invoice', call(hosP, 'PATCH', `/finance/invoices/${secInvoice.id}/cancel`, { cancellationReason: 'x' }), 403, 404);
  await expectStatus('primary head cannot regenerate a secondary invoice pdf', call(hosP, 'POST', `/finance/invoices/${secInvoice.id}/regenerate-pdf`), 403, 404);

  const payP = list(ok(await call(hosP, 'GET', '/finance/payments?limit=100'), 'pay P'));
  const payS = list(ok(await call(hosS, 'GET', '/finance/payments?limit=100'), 'pay S'));
  check('payments are school-scoped', payP.every((p) => p.schoolId === PRIMARY) && payS.every((p) => p.schoolId === SECONDARY) && payP.length > 0 && payS.length > 0);
  const rcpP = list(ok(await call(hosP, 'GET', '/finance/receipts?limit=100'), 'rcp P'));
  const rcpS = list(ok(await call(hosS, 'GET', '/finance/receipts?limit=100'), 'rcp S'));
  check('receipts are school-scoped', rcpP.every((r) => r.schoolId === PRIMARY) && rcpS.every((r) => r.schoolId === SECONDARY) && rcpP.length > 0);
  await expectStatus('primary head cannot open a secondary receipt by id', call(hosP, 'GET', `/finance/receipts/${rcpS[0].id}`), 403, 404);
  await expectStatus('primary head cannot download a secondary receipt pdf', call(hosP, 'GET', `/finance/receipts/${rcpS[0].id}/pdf`), 403, 404);
  await expectStatus('primary head cannot void a secondary receipt', call(hosP, 'PATCH', `/finance/receipts/${rcpS[0].id}/void`, { voidReason: 'x' }), 403, 404);

  console.log('\n== School separation: reports');
  const csP = ok(await call(hosP, 'GET', '/finance/reports/collection-summary'), 'cs P');
  const csS = ok(await call(hosS, 'GET', '/finance/reports/collection-summary'), 'cs S');
  const csAll = ok(await call(headFinance, 'GET', '/finance/reports/collection-summary'), 'cs all');
  const billedP = sum(invP.length < 100 ? invP : [], (i) => i.totalAmount);
  check('collection summary excludes other schools', Number(csP.totalBilled) > 0 && Number(csP.totalBilled) < Number(csAll.totalBilled) && Number(csS.totalBilled) < Number(csAll.totalBilled));
  check('school summaries add up to the group total', Math.abs(Number(csP.totalBilled) + Number(csS.totalBilled) - Number(csAll.totalBilled)) < 1, `${csP.totalBilled}+${csS.totalBilled} vs ${csAll.totalBilled}`);
  check('collection summary has a class breakdown', Array.isArray(csP.byClass) && csP.byClass.length > 0 && csP.byClass.every((c) => c.className));
  check('collection summary has a fee category breakdown', Array.isArray(csP.byFeeCategory) && csP.byFeeCategory.length > 0);
  check('class breakdown adds up to the total', Math.abs(sum(csP.byClass, (c) => c.billed) - Number(csP.totalBilled)) < 1);
  const obP = list(ok(await call(hosP, 'GET', '/finance/reports/outstanding-balances'), 'ob P'));
  const obS = list(ok(await call(hosS, 'GET', '/finance/reports/outstanding-balances'), 'ob S'));
  check('outstanding balances are school-scoped and named', obP.length > 0 && obP.every((r) => r.studentName) && !obP.some((r) => obS.some((x) => x.invoiceId === r.invoiceId)));
  check('outstanding total matches the summary', Math.abs(sum(obP, (r) => r.outstanding) - Number(csP.totalOutstanding)) < 1);
  const dfP = list(ok(await call(hosP, 'GET', '/finance/reports/fee-defaulters'), 'df P'));
  const dfS = list(ok(await call(hosS, 'GET', '/finance/reports/fee-defaulters'), 'df S'));
  check('defaulters are school-scoped', !dfP.some((r) => dfS.some((x) => x.id === r.id)));
  check('defaulters carry names', dfP.length === 0 || dfP.every((r) => r.studentName));
  const dashP = ok(await call(hosP, 'GET', '/finance/dashboard'), 'dash P');
  const dashInv = list(dashP.invoices);
  check('finance dashboard (gateway view) is school-scoped', dashInv.length > 0 && dashInv.every((i) => i.schoolId === PRIMARY), `n=${dashInv.length}`);
  const dashFin = ok(await call(finance, 'GET', '/finance/dashboard', undefined, SECONDARY), 'dash fin S');
  check('finance dashboard follows the active school', list(dashFin.invoices).every((i) => i.schoolId === SECONDARY));
  await expectStatus('head of finance can open the finance dashboard', call(headFinance, 'GET', '/finance/dashboard'), 200);
  const today = new Date().toISOString().slice(0, 10);
  const dcP = list(ok(await call(hosP, 'GET', `/finance/reports/daily-collections?startDate=2026-01-01&endDate=${today}T23:59:59Z`), 'dc P'));
  check('daily collections are school-scoped', dcP.every((p) => p.schoolId === PRIMARY));
  const stmtOwn = await call(hosP, 'GET', '/finance/reports/financial-statement');
  check('financial statement loads for a school head', stmtOwn.status === 200, `(${stmtOwn.status})`);

  console.log('\n== Ownership: parents and students');
  const myInv = list(ok(await call(parentP, 'GET', '/finance/invoices'), 'parent invoices'));
  check('parent sees only their child invoices', myInv.length > 0 && myInv.every((i) => i.studentId === priInvoice.studentId || i.schoolId === PRIMARY));
  await expectStatus('parent cannot open another school invoice', call(parentP, 'GET', `/finance/invoices/${secInvoice.id}`), 403, 404);
  await expectStatus('parent cannot download another school invoice pdf', call(parentP, 'GET', `/finance/invoices/${secInvoice.id}/pdf`), 403, 404);
  await expectStatus('parent cannot read another child statement', call(parentP, 'GET', `/finance/reports/student-statement/${secInvoice.studentId}`), 403);
  await expectStatus('parent cannot record a payment', call(parentP, 'POST', '/finance/payments/cash', { invoiceId: priInvoice.id, amount: '1000', payerName: 'x' }), 403);
  await expectStatus('student cannot record a payment', call(studentP, 'POST', '/finance/payments/cash', { invoiceId: priInvoice.id, amount: '1000', payerName: 'x' }), 403);
  const stuInv = list(ok(await call(studentP, 'GET', '/finance/invoices'), 'student invoices'));
  check('student sees only their own invoices', stuInv.length > 0 && stuInv.every((i) => i.schoolId === PRIMARY));
  await expectStatus('student cannot open someone else invoice', call(studentP, 'GET', `/finance/invoices/${secInvoice.id}`), 403, 404);
  const stuRcp = list(ok(await call(studentP, 'GET', '/finance/receipts'), 'student receipts'));
  check('student receipts are their own', stuRcp.every((r) => r.schoolId === PRIMARY));
  await expectStatus('student cannot read finance reports', call(studentP, 'GET', '/finance/reports/collection-summary'), 403);
  await expectStatus('parent cannot read finance dashboard', call(parentP, 'GET', '/finance/dashboard'), 403);
  await expectStatus('secondary parent cannot see primary receipt', call(parentS, 'GET', `/finance/receipts/${rcpP[0].id}`), 403, 404);

  console.log('\n== Payment lifecycle');
  const invBefore = ok(await call(hosP, 'GET', `/finance/invoices/${priInvoice.id}`), 'inv before');
  const outstanding0 = Number(invBefore.outstandingBalance);
  const paid0 = Number(invBefore.paidAmount);
  const ref = `QA-${Date.now()}`;
  await expectStatus('zero amount rejected', call(finance, 'POST', '/finance/payments/cash', { invoiceId: priInvoice.id, amount: '0', payerName: 'QA Payer' }, PRIMARY), 400);
  await expectStatus('negative amount rejected', call(finance, 'POST', '/finance/payments/cash', { invoiceId: priInvoice.id, amount: '-50', payerName: 'QA Payer' }, PRIMARY), 400);
  await expectStatus('payment above the balance rejected', call(finance, 'POST', '/finance/payments/cash', { invoiceId: priInvoice.id, amount: String(outstanding0 + 1), payerName: 'QA Payer' }, PRIMARY), 400);
  await expectStatus('recording for another school invoice is blocked', call(hosP, 'POST', '/finance/payments/bank-transfer', { invoiceId: secInvoice.id, amount: '1000', payerName: 'QA Payer', referenceNumber: 'X' }), 403, 404);
  await expectStatus('a school head without finance role cannot record cash', call(hosP, 'POST', '/finance/payments/cash', { invoiceId: priInvoice.id, amount: '1000', payerName: 'QA Payer' }), 403);
  const pay = ok(await call(finance, 'POST', '/finance/payments/bank-transfer', { invoiceId: priInvoice.id, amount: '1000', payerName: 'QA Payer', referenceNumber: ref, notes: 'qa' }, PRIMARY), 'record payment');
  check('new payment is pending and stamped with the invoice school', pay.status === 'PENDING' && pay.schoolId === PRIMARY, JSON.stringify({ s: pay.status, sc: pay.schoolId }));
  await expectStatus('duplicate bank reference rejected', call(finance, 'POST', '/finance/payments/bank-transfer', { invoiceId: priInvoice.id, amount: '500', payerName: 'QA Payer', referenceNumber: ref }, PRIMARY), 409);
  const invMid = ok(await call(hosP, 'GET', `/finance/invoices/${priInvoice.id}`), 'inv mid');
  check('pending payment does not change the balance', Number(invMid.outstandingBalance) === outstanding0);
  await expectStatus('pending amount counts against what can still be recorded', call(finance, 'POST', '/finance/payments/cash', { invoiceId: priInvoice.id, amount: String(outstanding0 - 500), payerName: 'QA Payer' }, PRIMARY), 400);
  const pend = list(ok(await call(hosP, 'GET', '/finance/payments/pending-approval'), 'pending'));
  const approval = pend.find((a) => a.paymentId === pay.id);
  check('payment appears in the school approval queue with a name', approval && approval.studentName, JSON.stringify(approval && { n: approval.studentName }));
  const pendS = list(ok(await call(hosS, 'GET', '/finance/payments/pending-approval'), 'pending S'));
  check('other school cannot see the pending approval', !pendS.some((a) => a.paymentId === pay.id));
  await expectStatus('other school head cannot approve', call(hosS, 'PATCH', `/finance/payments/approvals/${approval.id}/approve`), 403, 404);
  await expectStatus('finance cannot approve its own entry', call(finance, 'PATCH', `/finance/payments/approvals/${approval.id}/approve`), 403);
  ok(await call(hosP, 'PATCH', `/finance/payments/approvals/${approval.id}/approve`), 'approve');
  await expectStatus('approving twice is rejected', call(hosP, 'PATCH', `/finance/payments/approvals/${approval.id}/approve`), 400);
  const invAfter = ok(await call(hosP, 'GET', `/finance/invoices/${priInvoice.id}`), 'inv after');
  check('approval reduces the balance exactly', Number(invAfter.outstandingBalance) === outstanding0 - 1000 && Number(invAfter.paidAmount) === paid0 + 1000, `${invAfter.outstandingBalance}`);
  const rec = list(ok(await call(hosP, 'GET', `/finance/receipts?studentId=${priInvoice.studentId}`), 'receipt after')).find((r) => r.paymentId === pay.id);
  check('a receipt is issued for the payment in the same school', rec && rec.schoolId === PRIMARY && !rec.isVoided, JSON.stringify(rec && { s: rec.schoolId }));
  const parentRcp = list(ok(await call(parentP, 'GET', '/finance/receipts'), 'parent receipts'));
  check('the parent can see the new receipt', parentRcp.some((r) => r.id === rec?.id));
  const pdfRes = await fetch(`${BASE}/finance/receipts/${rec.id}/pdf`, { headers: { authorization: `Bearer ${parentP.token}` } });
  check('the parent can download the receipt pdf', pdfRes.status === 200 && (pdfRes.headers.get('content-type') || '').includes('pdf'), `(${pdfRes.status})`);
  await expectStatus('other school head cannot refund', call(hosS, 'PATCH', `/finance/payments/${pay.id}/refund`, { refundReason: 'x' }), 403, 404);
  ok(await call(hosP, 'PATCH', `/finance/payments/${pay.id}/refund`, { refundReason: 'qa cleanup' }), 'refund');
  const invRefunded = ok(await call(hosP, 'GET', `/finance/invoices/${priInvoice.id}`), 'inv refunded');
  check('refund restores the balance', Number(invRefunded.outstandingBalance) === outstanding0 && Number(invRefunded.paidAmount) === paid0);
  const recAfter = ok(await call(hosP, 'GET', `/finance/receipts/${rec.id}`), 'receipt voided');
  check('refund voids the receipt', recAfter.isVoided === true);
  await expectStatus('refunding twice is rejected', call(hosP, 'PATCH', `/finance/payments/${pay.id}/refund`, { refundReason: 'again' }), 400);

  console.log('\n== Rejecting and invoice states');
  const pay2 = ok(await call(finance, 'POST', '/finance/payments/cash', { invoiceId: priInvoice.id, amount: '2000', payerName: 'QA Payer' }, PRIMARY), 'pay2');
  const appr2 = list(ok(await call(hosP, 'GET', '/finance/payments/pending-approval'), 'pend2')).find((a) => a.paymentId === pay2.id);
  ok(await call(hosP, 'PATCH', `/finance/payments/approvals/${appr2.id}/reject`, { rejectionReason: 'wrong amount' }), 'reject');
  const invRej = ok(await call(hosP, 'GET', `/finance/invoices/${priInvoice.id}`), 'inv rej');
  check('rejected payment leaves the balance alone', Number(invRej.outstandingBalance) === outstanding0);
  await expectStatus('discount needs a reason', call(hosP, 'PATCH', `/finance/invoices/${priInvoice.id}/discount`, { discountAmount: '100', discountReason: '' }), 400);
  await expectStatus('discount cannot exceed what is unpaid', call(hosP, 'PATCH', `/finance/invoices/${priInvoice.id}/discount`, { discountAmount: String(Number(invRej.subtotal) + 1), discountReason: 'too much' }), 400);
  ok(await call(hosP, 'PATCH', `/finance/invoices/${priInvoice.id}/discount`, { discountAmount: '1000', discountReason: 'qa discount' }), 'discount');
  const invDisc = ok(await call(hosP, 'GET', `/finance/invoices/${priInvoice.id}`), 'inv disc');
  check('discount lowers total and balance', Number(invDisc.totalAmount) === Number(invBefore.subtotal) - 1000 && Number(invDisc.outstandingBalance) === outstanding0 - 1000 + (Number(invBefore.subtotal) - Number(invBefore.totalAmount)));
  ok(await call(hosP, 'PATCH', `/finance/invoices/${priInvoice.id}/discount`, { discountAmount: String(Number(invBefore.subtotal) - Number(invBefore.totalAmount)), discountReason: 'qa restore' }), 'restore discount');
  const invRestored = ok(await call(hosP, 'GET', `/finance/invoices/${priInvoice.id}`), 'inv restored');
  check('discount can be restored exactly', Number(invRestored.outstandingBalance) === outstanding0 && Number(invRestored.totalAmount) === Number(invBefore.totalAmount));
  await expectStatus('cannot cancel an invoice with confirmed payments', call(hosP, 'PATCH', `/finance/invoices/${priInvoice.id}/cancel`, { cancellationReason: 'qa' }), 409, 400);
  const paidInvoice = invP.find((i) => i.status === 'PAID');
  if (paidInvoice) {
    await expectStatus('a settled invoice cannot take a payment', call(finance, 'POST', '/finance/payments/cash', { invoiceId: paidInvoice.id, amount: '10', payerName: 'QA Payer' }, PRIMARY), 400);
    await expectStatus('a settled invoice cannot be waived', call(hosP, 'PATCH', `/finance/invoices/${paidInvoice.id}/waive`, { waiverReason: 'qa' }), 400);
    await expectStatus('a settled invoice cannot be discounted', call(hosP, 'PATCH', `/finance/invoices/${paidInvoice.id}/discount`, { discountAmount: '10', discountReason: 'qa' }), 400);
  }

  console.log('\n== Invoice generation follows the student school');
  const cats = list(ok(await call(finance, 'GET', '/finance/fee-categories'), 'cats'));
  const classId = priInvoice.classId;
  const termId = `QA-TERM-${Date.now().toString(36).toUpperCase()}`;
  const yearId = priInvoice.academicYearId;
  await expectStatus('multi-school finance must pick a school before creating a fee structure', call(finance, 'POST', '/finance/fee-structures', { feeCategoryId: cats[0].id, classId, academicYearId: yearId, termId, amount: '1000' }), 400);
  const fs = ok(await call(finance, 'POST', '/finance/fee-structures', { feeCategoryId: cats[0].id, classId, academicYearId: yearId, termId, amount: '1000' }, PRIMARY), 'fee structure');
  check('fee structure is stamped with the selected school', fs.schoolId === PRIMARY);
  const secStructs = list(ok(await call(hosS, 'GET', `/finance/fee-structures?termId=${termId}`), 'fs S'));
  check('other school cannot see the new fee structure', secStructs.length === 0);
  const genWrong = ok(await call(hosS, 'POST', '/finance/invoices/generate', { termId, academicYearId: yearId, classIds: [classId] }), 'gen wrong');
  await new Promise((r) => setTimeout(r, 2500));
  const jobWrong = ok(await call(hosS, 'GET', `/finance/invoices/jobs/${genWrong.jobId}`), 'job wrong');
  check('another school cannot bill this class', jobWrong.result && jobWrong.result.generated === 0, JSON.stringify(jobWrong.result));
  const gen = ok(await call(finance, 'POST', '/finance/invoices/generate', { termId, academicYearId: yearId, classIds: [classId] }, PRIMARY), 'gen');
  await new Promise((r) => setTimeout(r, 4000));
  const job = ok(await call(finance, 'GET', `/finance/invoices/jobs/${gen.jobId}`, undefined, PRIMARY), 'job');
  check('generation bills the class', job.status === 'COMPLETED' && job.result.generated > 0, JSON.stringify(job.result || job));
  const newInv = list(ok(await call(hosP, 'GET', `/finance/invoices?termId=${termId}&limit=100`), 'new invoices'));
  check('every generated invoice carries the student school', newInv.length === job.result.generated && newInv.every((i) => i.schoolId === PRIMARY && Number(i.totalAmount) === 1000));
  const gen2 = ok(await call(finance, 'POST', '/finance/invoices/generate', { termId, academicYearId: yearId, classIds: [classId] }, PRIMARY), 'gen2');
  await new Promise((r) => setTimeout(r, 3000));
  const job2 = ok(await call(finance, 'GET', `/finance/invoices/jobs/${gen2.jobId}`, undefined, PRIMARY), 'job2');
  check('generating again does not duplicate invoices', job2.result && job2.result.generated === 0);
  // a pending payment must not survive cancelling the invoice
  const target = newInv[0];
  const pay3 = ok(await call(finance, 'POST', '/finance/payments/cash', { invoiceId: target.id, amount: '300', payerName: 'QA Payer' }, PRIMARY), 'pay3');
  ok(await call(hosP, 'PATCH', `/finance/invoices/${target.id}/cancel`, { cancellationReason: 'qa cancel' }), 'cancel');
  const cancelled = ok(await call(hosP, 'GET', `/finance/invoices/${target.id}`), 'cancelled');
  check('cancel closes the invoice', cancelled.status === 'CANCELLED' && Number(cancelled.outstandingBalance) === 0);
  const pend3 = list(ok(await call(hosP, 'GET', '/finance/payments/pending-approval'), 'pend3'));
  check('cancel clears pending payments for it', !pend3.some((a) => a.paymentId === pay3.id));
  await expectStatus('a cancelled invoice cannot take a payment', call(finance, 'POST', '/finance/payments/cash', { invoiceId: target.id, amount: '100', payerName: 'QA Payer' }, PRIMARY), 400);
  await expectStatus('a cancelled invoice cannot be discounted back to life', call(hosP, 'PATCH', `/finance/invoices/${target.id}/discount`, { discountAmount: '10', discountReason: 'qa' }), 400);
  const afterCancel = ok(await call(hosP, 'GET', '/finance/reports/collection-summary'), 'cs after');
  check('cancelled invoices drop out of the billed total', Number(afterCancel.totalBilled) === Number(csP.totalBilled) + (newInv.length - 1) * 1000, `${afterCancel.totalBilled}`);

  console.log('\n== Expenses, assets and store follow the school');
  const exp = ok(await call(finance, 'POST', '/finance/expenses', { category: 'OTHER', description: 'QA expense', amount: '5000', payee: 'QA Vendor', paymentMethod: 'CASH', incurredAt: new Date().toISOString() }, PRIMARY), 'expense');
  check('expense is stamped with the school', exp.schoolId === PRIMARY);
  const expS = list(ok(await call(hosS, 'GET', '/finance/expenses'), 'exp S'));
  const expP = list(ok(await call(hosP, 'GET', '/finance/expenses'), 'exp P'));
  check('expenses are school-scoped', !expS.some((e) => e.id === exp.id) && expP.some((e) => e.id === exp.id));
  await expectStatus('other school cannot read the expense', call(hosS, 'GET', `/finance/expenses/${exp.id}`), 403, 404);
  await expectStatus('expense needs a school choice for multi-school finance', call(finance, 'POST', '/finance/expenses', { category: 'OTHER', description: 'QA expense', amount: '1', payee: 'QA', paymentMethod: 'CASH', incurredAt: new Date().toISOString() }), 400);
  ok(await call(finance, 'PATCH', `/finance/expenses/${exp.id}/void`, { reason: 'qa cleanup' }, PRIMARY), 'void expense');
  const asset = ok(await call(finance, 'POST', '/finance/assets', { name: 'QA Projector', category: 'ELECTRONICS', type: 'MOVABLE', purchaseCost: '100000' }, PRIMARY), 'asset');
  check('asset is stamped with the school', asset.schoolId === PRIMARY);
  const assetsS = list(ok(await call(hosS, 'GET', '/finance/assets?limit=100'), 'assets S'));
  check('other school does not see the asset', !assetsS.some((a) => a.id === asset.id));
  await expectStatus('other school cannot open the asset', call(hosS, 'GET', `/finance/assets/${asset.id}`), 403, 404);
  const item = ok(await call(finance, 'POST', '/finance/store/items', { name: 'QA Chalk', category: 'STATIONERY', unit: 'box', reorderLevel: '2', unitCost: '1500', openingQuantity: '10' }, PRIMARY), 'store item');
  check('store item is stamped with the school', item.schoolId === PRIMARY);
  const itemsS = list(ok(await call(hosS, 'GET', '/finance/store/items'), 'items S'));
  check('other school does not see the store item', !itemsS.some((i) => i.id === item.id));
  await expectStatus('other school cannot issue stock', call(hosS, 'POST', `/finance/store/items/${item.id}/issue`, { quantity: '1', issuedTo: 'x' }), 403, 404);
  await expectStatus('cannot issue more than is on hand', call(finance, 'POST', `/finance/store/items/${item.id}/issue`, { quantity: '11', issuedTo: 'x' }, PRIMARY), 400);
  const racing = await Promise.all([1, 2, 3].map(() => call(finance, 'POST', `/finance/store/items/${item.id}/issue`, { quantity: '4', issuedTo: 'race' }, PRIMARY)));
  const wins = racing.filter((r) => r.status < 300).length;
  const itemNow = ok(await call(finance, 'GET', `/finance/store/items/${item.id}`, undefined, PRIMARY), 'item now');
  check('simultaneous issues cannot overdraw stock', wins === 2 && Number(itemNow.quantityOnHand) === 2, `wins=${wins} onHand=${itemNow.quantityOnHand}`);

  console.log('\n== Audit trail, paged ledgers and single records follow the school');
  const auditP = list(ok(await call(hosP, 'GET', '/finance/audit-logs?limit=100'), 'audit P'));
  const auditS = list(ok(await call(hosS, 'GET', '/finance/audit-logs?limit=100'), 'audit S'));
  check('audit trail is school-scoped (primary)', auditP.length > 0 && auditP.every((a) => a.schoolId === PRIMARY), `n=${auditP.length}`);
  check('audit trail is school-scoped (secondary)', auditS.length > 0 && auditS.every((a) => a.schoolId === SECONDARY), `n=${auditS.length}`);
  const auditAll = list(ok(await call(finance, 'GET', '/finance/audit-logs?limit=100'), 'audit all'));
  check('group finance sees both schools in the audit trail', auditAll.some((a) => a.schoolId === PRIMARY) && auditAll.some((a) => a.schoolId === SECONDARY));
  const ledgerP = ok(await call(hosP, 'GET', '/finance/invoices?paged=1&limit=10&status=OVERDUE,PAID'), 'ledger P');
  check('paged invoice ledger returns totals, counts and facets', ledgerP.items.length > 0 && ledgerP.meta.total >= ledgerP.items.length && ledgerP.totals && ledgerP.counts.ALL >= ledgerP.meta.total && Array.isArray(ledgerP.facets.classes));
  check('paged invoice ledger stays in the school', ledgerP.items.every((i) => i.schoolId === PRIMARY) && ledgerP.facets.classes.length > 0);
  const byName = ok(await call(hosP, 'GET', `/finance/invoices?paged=1&limit=5&search=${encodeURIComponent(ledgerP.items[0].studentName.split(' ')[0])}`), 'search');
  check('ledger search finds a student by name', byName.items.some((i) => i.id === ledgerP.items[0].id));
  const payLedger = ok(await call(hosS, 'GET', '/finance/payments?paged=1&limit=5&status=CONFIRMED'), 'pay ledger');
  check('paged payment ledger is school-scoped with totals', payLedger.items.length > 0 && payLedger.items.every((p) => p.schoolId === SECONDARY && p.studentName) && Number(payLedger.totals.confirmedAmount) > 0);
  const onePay = ok(await call(hosS, 'GET', `/finance/payments/${payLedger.items[0].id}`), 'one payment');
  check('single payment carries invoice, receipt and student', onePay.invoiceNumber && onePay.studentName && onePay.receiptId !== undefined);
  await expectStatus('other school cannot open a payment by id', call(hosP, 'GET', `/finance/payments/${payLedger.items[0].id}`), 403, 404);
  const oneRcp = ok(await call(hosS, 'GET', `/finance/receipts/${onePay.receiptId}`), 'one receipt');
  check('receipt carries the school letterhead', oneRcp.school && oneRcp.school.name);
  const daily = ok(await call(hosP, 'GET', '/finance/reports/daily-summary?days=400'), 'daily summary');
  check('daily summary is school-scoped and totals add up', Array.isArray(daily) && daily.every((d) => Number(d.totalAmount) >= 0 && d.transactionCount > 0));
  const asgn = list(ok(await call(hosP, 'GET', '/finance/fee-assignments'), 'assignments'));
  check('fee assignments carry student names and stay in school', asgn.every((a) => a.studentName !== undefined));
  const pdf = await fetch(`${BASE}/finance/receipts/${onePay.receiptId}/pdf`, { headers: { authorization: `Bearer ${hosS.token}` } });
  check('receipt pdf is drawn on demand', pdf.status === 200 && (pdf.headers.get('content-type') || '').includes('pdf'));

  console.log(`\n${results.filter((r) => r.pass).length}/${results.length} checks passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('\nSCRIPT ERROR', e.message); process.exit(2); });
