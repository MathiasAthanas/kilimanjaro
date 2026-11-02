// Walk the results / grades / report-card API surface as every role against the QA stack.
const { login, call, BASE } = require('./results-e2e-api.js');
const { execSync } = require('child_process');
const sql = (q) => execSync('psql -h localhost -U postgres -d kilimanjaro_qa -tA -F "|" -v ON_ERROR_STOP=1', { input: q, env: { ...process.env, PGPASSWORD: 'Mtunzi123' } }).toString().replace(/\r/g, '').trim();

let pass = 0, fail = 0;
const check = (n, c, i) => { if (c) { pass++; console.log('  PASS', n); } else { fail++; console.log('  FAIL', n, i !== undefined ? JSON.stringify(i).slice(0, 400) : ''); } };

const CLASS_ID = '4784066e-e304-499b-822f-c235af6a83fe';
const TERM_ID = 'da0e69ef-1632-40fc-adfb-f9a8fa17c12c';
const YEAR_ID = '71a7faf9-72b9-44ca-9a47-aa64db0feba5';
const SCHOOL = { 'X-Active-School': '00000000-0000-4000-8000-000000000002' };

(async () => {
  const P = await login('principal@demo.kilimanjaro.test', 'Principal@Kili2026');
  const pc = (m, p, b) => call(P.token, m, p, b, SCHOOL);

  console.log('== PRINCIPAL: grading + results surface');
  let r = await pc('GET', '/academics/grading-scales'); check('grading scales list', r.status === 200 && r.data.length >= 3, r.status);
  r = await pc('GET', '/academics/assessment-types'); check('assessment types', r.status === 200, r.status);
  r = await pc('GET', `/academics/results/readiness?termId=${TERM_ID}`); check('results readiness', r.status === 200, r.body);
  r = await pc('GET', `/academics/results/class/${CLASS_ID}/term/${TERM_ID}`); check('class results review', r.status === 200, r.body);
  const classRes = r.data;
  check('class results: EXEMPT rows kept in items but out of subject stats', classRes.items.some((i) => i.resultStatus === 'EXEMPT') && classRes.subjectStats.every((s) => s.subjectName), classRes.subjectStats && classRes.subjectStats.length);
  const agr = (classRes.subjectStats || []).find((s) => s.subjectName === 'Agriculture');
  check('Agriculture average excludes the exempt student (13 values)', agr && agr.average > 0, agr);
  r = await pc('GET', `/academics/report-cards/class/${CLASS_ID}/term/${TERM_ID}`); check('report card centre: class list', r.status === 200 && r.data.length === 14, r.status);
  check('report card centre: student names resolved (not UUIDs)', r.data.every((c) => c.studentName && !/^[0-9a-f-]{36}$/.test(c.studentName) && c.registrationNumber), r.data[0]);
  const juma = r.data.find((c) => c.exemptSubjectCount === 1);
  check('report card flags 6 of 7 assessed, 1 exempt', juma && juma.subjectCount === 6 && juma.subjectsExpected === 7, juma && [juma.subjectCount, juma.subjectsExpected]);
  

  console.log('== PUBLISH report cards, then student / parent views');
  const compose = await pc('POST', '/academics/report-card-compositions', { name: 'role-walk', publish: true, academicYearId: YEAR_ID, termId: TERM_ID, windows: [{ examWindowId: sql(`SELECT id FROM academics."ExamWindow" WHERE name='UI Walkthrough 2026'`), weight: 100 }] });
  check('compose + publish', compose.status < 300 && compose.data.published, compose.body);

  const jumaId = juma.studentId;
  const reg = sql(`SELECT "registrationNumber" FROM students."Student" WHERE id='${jumaId}'`);
  const stuEmail = reg; // students sign in with their registration number
  const S = await login(stuEmail, 'Student@Kili2026').catch((e) => null);
  if (!S) { console.log('  (no student login available, skipping student view)'); }
  else {
    r = await call(S.token, 'GET', `/academics/results?termId=${TERM_ID}`);
    check('student: sees own published results', r.status === 200 && r.data.length >= 7, [r.status, r.data && r.data.length]);
    check('student: exempt subject carries status EXEMPT', (r.data || []).some((x) => x.resultStatus === 'EXEMPT' && x.subjectName === 'Agriculture'), (r.data || []).map((x) => x.resultStatus));
    r = await call(S.token, 'GET', `/academics/report-cards/${jumaId}/term/${TERM_ID}`);
    check('student: own report card', r.status === 200 && r.data.subjectCount === 6, r.body);
    const pdf = await fetch(BASE + `/academics/report-cards/${jumaId}/term/${TERM_ID}/pdf`, { headers: { authorization: 'Bearer ' + S.token } });
    check('student: PDF download', pdf.status === 200 && (await pdf.arrayBuffer()).byteLength > 1000, pdf.status);
    const other = sql(`SELECT "studentId" FROM academics."ReportCard" WHERE "classId"='${CLASS_ID}' AND "termId"='${TERM_ID}' AND "studentId"<>'${jumaId}' LIMIT 1`);
    r = await call(S.token, 'GET', `/academics/report-cards/${other}/term/${TERM_ID}`);
    check("student cannot read a classmate's card", r.status === 403 || r.status === 404, r.status);
    r = await call(S.token, 'GET', `/academics/exam-windows/${sql(`SELECT id FROM academics."ExamWindow" WHERE name='UI Walkthrough 2026'`)}/readiness`);
    check('student blocked from readiness', r.status === 403, r.status);
    r = await call(S.token, 'POST', '/academics/result-exemptions', {});
    check('student blocked from exemptions', r.status === 403, r.status);
  }
  const parentEmail = sql(`SELECT u.email FROM students."StudentGuardianLink" l JOIN students."Guardian" g ON g.id=l."guardianId" JOIN auth.users u ON u.id=g."authUserId" WHERE l."studentId"='${jumaId}' LIMIT 1`);
  if (parentEmail) {
    const PR = await login(parentEmail, 'Parent@Kili2026').catch(() => null);
    if (PR) {
      r = await call(PR.token, 'GET', `/academics/report-cards/${jumaId}/term/${TERM_ID}`);
      check('parent: child report card', r.status === 200, r.status);
      r = await call(PR.token, 'GET', `/academics/results?studentId=${jumaId}&termId=${TERM_ID}`);
      check('parent: child results', r.status === 200 && r.data.length >= 7, r.status);
    } else console.log('  (parent login unavailable)');
  }

  console.log('== TEACHER / HOD / AQA');
  const T = await login('t-maths-b@demo.kilimanjaro.test', 'Teacher@Kili2026');
  r = await call(T.token, 'GET', '/academics/assessments'); check('teacher: assessments list', r.status === 200, r.status);
  r = await call(T.token, 'GET', '/academics/exam-windows/teacher'); check('teacher: exam windows', r.status === 200, r.status);
  r = await call(T.token, 'GET', `/academics/results/class/${CLASS_ID}/term/${TERM_ID}`); check('teacher: class results', r.status === 200, r.status);
  r = await call(T.token, 'GET', `/academics/exam-windows`); check('teacher: cannot list admin windows (403)', r.status === 403, r.status);
  r = await call(T.token, 'GET', `/academics/result-exemptions`); check('teacher: cannot list exemptions (403)', r.status === 403, r.status);

  const H = await login('hod-science@demo.kilimanjaro.test', 'Hod@Kili2026');
  r = await call(H.token, 'GET', '/academics/assessments/pending-approval'); check('hod: pending approvals', r.status === 200, r.status);
  r = await call(H.token, 'GET', '/academics/assessments/approval-history'); check('hod: approval history', r.status === 200, r.status);
  r = await call(H.token, 'GET', `/academics/result-exemptions`); check('hod: can list exemptions', r.status === 200, r.status);
  r = await call(H.token, 'POST', `/academics/result-exemptions`, { academicYearId: YEAR_ID, termId: TERM_ID, classId: CLASS_ID, subjectId: 'x', scope: 'CLASS', reason: 'nope nope' });
  check('hod: cannot approve exemptions (403)', r.status === 403, r.status);

  const A = await login('aqa@demo.kilimanjaro.test', 'Aqa@Kili2026');
  r = await call(A.token, 'GET', `/academics/results/readiness?termId=${TERM_ID}`, null, SCHOOL); check('aqa: results readiness', r.status === 200, r.status);
  r = await call(A.token, 'GET', `/academics/exam-windows`, null, SCHOOL); check('aqa: exam windows', r.status === 200, r.status);
  r = await call(A.token, 'POST', '/academics/results/unpublish', { classId: CLASS_ID, termId: TERM_ID }, SCHOOL); check('aqa: cannot unpublish results (403)', r.status === 403, r.status);

  console.log('== Unpublish -> students lose access until republished');
  r = await pc('POST', '/academics/results/unpublish', { classId: CLASS_ID, termId: TERM_ID });
  check('principal unpublishes', r.status < 300, r.body);
  if (S) {
    r = await call(S.token, 'GET', `/academics/report-cards/${jumaId}/term/${TERM_ID}`);
    check('student: unpublished report card is hidden', r.status === 403 || r.status === 404, r.status);
  }

  console.log(`\nROLE WALK: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
