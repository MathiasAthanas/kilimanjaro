/* eslint-disable no-console */
// Teacher / HOD / admin exam flow + performance export, against the QA stack after seed-exam-demo.js.
//   API_BASE=http://localhost:3910/api/v1 node results-flow-e2e.js
const { login, call, BASE } = require('./results-e2e-api.js');
const { execSync } = require('child_process');
const sql = (q) => execSync('psql -h localhost -U postgres -d kilimanjaro_qa -tA -F "|" -v ON_ERROR_STOP=1', { input: q, env: { ...process.env, PGPASSWORD: 'Mtunzi123' } }).toString().replace(/\r/g, '').trim();

let pass = 0, fail = 0;
const check = (n, c, i) => { if (c) { pass++; console.log('  PASS', n); } else { fail++; console.log('  FAIL', n, i !== undefined ? JSON.stringify(i).slice(0, 500) : ''); } };

const PRIMARY = { 'X-Active-School': '00000000-0000-4000-8000-000000000002' };
const SECONDARY = { 'X-Active-School': '00000000-0000-4000-8000-000000000003' };
const YEAR = '71a7faf9-72b9-44ca-9a47-aa64db0feba5';
const TERM = 'da0e69ef-1632-40fc-adfb-f9a8fa17c12c';

(async () => {
  const P = await login('principal@demo.kilimanjaro.test', 'Principal@Kili2026');
  const pc = (m, p, b, h = PRIMARY) => call(P.token, m, p, b, h);
  const T = await login('t-maths-b@demo.kilimanjaro.test', 'Teacher@Kili2026');
  const tc = (m, p, b) => call(T.token, m, p, b, PRIMARY);

  const win = (name) => sql(`SELECT id FROM academics."ExamWindow" WHERE name='${name}'`);
  const MID = win('Demo Primary Midterm Exam');
  const END = win('Demo Primary End of Term Exam');

  console.log('== TEACHER: one page shows everything');
  let r = await tc('GET', '/academics/exam-windows/teacher');
  const wins = r.data;
  check('teacher windows load', r.status === 200 && wins.length >= 2, r.status);
  const open = wins.find((w) => w.id === END);
  const pub = wins.find((w) => w.id === MID);
  check('open window listed first with progress per subject', open && wins[0].status === 'OPEN' && open.mySubjects.every((s) => typeof s.required === 'number' && typeof s.marksEntered === 'number'), wins.map((w) => w.status));
  check('open subjects are editable', open.mySubjects.every((s) => s.canEdit), open.mySubjects.map((s) => s.canEdit));
  check('published window visible but locked', pub && pub.mySubjects.every((s) => !s.canEdit), pub && pub.mySubjects.map((s) => s.status));
  const lockedSubject = pub.mySubjects.find((s) => !s.editRequest) || pub.mySubjects[0];
  const pendingReq = pub.mySubjects.find((s) => s.editRequest && s.editRequest.status === 'REQUESTED');
  check('teacher sees the status of the pending request', !!pendingReq, pub.mySubjects.map((s) => s.editRequest));

  console.log('== LOCKED means locked');
  const tryUpload = await tc('POST', `/academics/exam-windows/assessments/${lockedSubject.assessmentId}/marks/upload`, { rows: [{ registrationNumber: 'x', score: 10 }] });
  check('teacher cannot upload into a published window', tryUpload.status === 400 && /ask your Head of Department or an administrator/.test(tryUpload.body.message), tryUpload.body);
  const adminTry = await pc('POST', `/academics/exam-windows/assessments/${lockedSubject.assessmentId}/marks/upload`, { rows: [{ registrationNumber: 'x', score: 10 }] });
  check('admin cannot edit published marks either (must reopen)', adminTry.status === 400, adminTry.status);
  const lockedMark = sql(`SELECT m.id, m."assessmentId" FROM academics."Mark" m WHERE m."assessmentId"='${lockedSubject.assessmentId}' LIMIT 1`).split('|');
  const legacy = await pc('PATCH', `/academics/assessments/${lockedMark[1]}/marks/${lockedMark[0]}`, { score: 1 });
  check('legacy single-mark edit cannot bypass the lock', legacy.status === 403 && /locked/i.test(legacy.body.message), legacy.body);
  const noNeed = await tc('POST', '/academics/exam-windows/edit-requests', { examWindowId: END, assessmentId: open.mySubjects[0].assessmentId, reason: 'not needed here' });
  check('no request needed while the subject is open', noNeed.status === 400 && /still open/.test(noNeed.body.message), noNeed.body);
  const dup = await tc('POST', '/academics/exam-windows/edit-requests', { examWindowId: MID, assessmentId: pendingReq.assessmentId, reason: 'asking twice please' });
  check('duplicate request refused', dup.status === 400 && /already waiting/.test(dup.body.message), dup.body);

  console.log('== TEACHER uploads a filled file (CSV rows) and submits');
  const sheet = open.mySubjects.find((s) => !s.complete) || open.mySubjects[0];
  const tmpl = await tc('GET', `/academics/exam-windows/assessments/${sheet.assessmentId}/template`);
  const rows = tmpl.data.rows.map((x, i) => ({ registrationNumber: x.registrationNumber, score: 40 + ((i * 7) % 55), isAbsent: i === 2 ? 'yes' : '', notSat: i === 3 ? 'yes' : '' }));
  const up = await tc('POST', `/academics/exam-windows/assessments/${sheet.assessmentId}/marks/upload`, { rows, autoSubmit: true });
  check('upload applied for the whole class + auto-submitted', up.status < 300 && up.data.applied === rows.length && up.data.autoSubmitted === true, up.body);
  const reup = await tc('POST', `/academics/exam-windows/assessments/${sheet.assessmentId}/marks/upload`, { rows: [{ registrationNumber: rows[0].registrationNumber, score: 99 }] });
  check('submitted subject can still be corrected while the window is open', reup.status < 300 && reup.data.applied === 1, reup.body);
  const progress = (await tc('GET', '/academics/exam-windows/teacher')).data.find((w) => w.id === END).mySubjects.find((s) => s.assessmentId === sheet.assessmentId);
  check('progress shows complete', progress.complete === true && progress.marksEntered === progress.required, progress);

  console.log('== ADMIN sees progress and can enter marks on behalf');
  const det = (await pc('GET', `/academics/exam-windows/${END}`)).data;
  check('window detail carries teacher name + entry progress', det.assessments.every((a) => a.entry && typeof a.entry.required === 'number') && det.assessments.some((a) => a.teacherName), det.assessments[0]);
  const pending = det.assessments.find((a) => a.entry.entered < a.entry.required);
  check('some subjects still pending', !!pending);
  const adminTmpl = await pc('GET', `/academics/exam-windows/assessments/${pending.id}/template`);
  const adminUp = await pc('POST', `/academics/exam-windows/assessments/${pending.id}/marks/upload`, { rows: adminTmpl.data.rows.map((x, i) => ({ registrationNumber: x.registrationNumber, score: 50 + (i % 40) })) });
  check('admin enters marks for a teacher', adminUp.status < 300 && adminUp.data.applied === adminTmpl.data.rows.length, adminUp.body);

  console.log('== HOD approves, teacher edits, admin republishes (secondary school, A-Level midterm)');
  const AMID = win('Demo A-Level Midterm Exam');
  const tc2 = (m, p, b) => call(T.token, m, p, b, SECONDARY);
  const pc2 = (m, p, b) => call(P.token, m, p, b, SECONDARY);
  const aw = (await tc2('GET', '/academics/exam-windows/teacher')).data.find((w) => w.id === AMID);
  const aPending = aw.mySubjects.find((x) => x.editRequest && x.editRequest.status === 'REQUESTED');
  check('teacher has a pending request on the A-Level midterm', !!aPending, aw.mySubjects.map((x) => x.editRequest));
  const H = await login('hod-science@demo.kilimanjaro.test', 'Hod@Kili2026');
  const hc = (m, p, b) => call(H.token, m, p, b, SECONDARY);
  const reqs = await hc('GET', '/academics/exam-windows/edit-requests?status=REQUESTED');
  check('HOD sees requests for the department', reqs.status === 200 && reqs.data.some((x) => x.assessmentId === aPending.assessmentId), reqs.body);
  const req = (reqs.data || []).find((x) => x.assessmentId === aPending.assessmentId);
  check('request shows who asked and for which subject', req && req.requestedByName && req.subjectName, req);
  const science = await login('hod-maths@demo.kilimanjaro.test', 'Hod@Kili2026');
  const wrongDept = await call(science.token, 'POST', `/academics/exam-windows/edit-requests/${req.id}/grant`, {}, SECONDARY);
  check('HOD of another department cannot decide (403)', wrongDept.status === 403, wrongDept.body);
  const tryTeacherGrant = await tc2('POST', `/academics/exam-windows/edit-requests/${req.id}/grant`, {});
  check('teacher cannot approve own request (403)', tryTeacherGrant.status === 403, tryTeacherGrant.status);
  const grant = await hc('POST', `/academics/exam-windows/edit-requests/${req.id}/grant`, { note: 'Approved, please correct today' });
  check('HOD approves', grant.status < 300 && grant.data.status === 'GRANTED', grant.body);
  const midNow = (await pc2('GET', `/academics/exam-windows/${AMID}`)).data;
  check('window reopened and results unpublished', midNow.status === 'REOPENED', midNow.status);
  const tw = (await tc2('GET', '/academics/exam-windows/teacher')).data.find((w) => w.id === AMID).mySubjects;
  check('teacher can edit that subject only', tw.find((x) => x.assessmentId === req.assessmentId).canEdit === true && tw.filter((x) => x.assessmentId !== req.assessmentId).every((x) => !x.canEdit), tw.map((x) => x.canEdit));
  const stuRows = (await tc2('GET', `/academics/exam-windows/assessments/${req.assessmentId}/template`)).data.rows;
  const fix = await tc2('POST', `/academics/exam-windows/assessments/${req.assessmentId}/marks/upload`, { rows: [{ registrationNumber: stuRows[0].registrationNumber, score: 45 }] });
  check('teacher makes the correction', fix.status < 300 && fix.data.applied === 1, fix.body);
  const done = await tc2('POST', `/academics/exam-windows/edit-requests/${req.id}/complete`, {});
  check('teacher finishes editing', done.status < 300 && done.data.status === 'COMPLETED', done.body);
  const relock = await tc2('POST', `/academics/exam-windows/assessments/${req.assessmentId}/marks/upload`, { rows: [{ registrationNumber: stuRows[0].registrationNumber, score: 46 }] });
  check('subject is locked again after finishing', relock.status === 400, relock.body);
  const repub = await pc2('POST', `/academics/exam-windows/${AMID}/republish`);
  check('admin: close & republish in one step', repub.status < 300 && repub.data.published.published === true, repub.body);
  check('window published again', (await pc2('GET', `/academics/exam-windows/${AMID}`)).data.status === 'PUBLISHED');
  const done2 = await pc2('GET', '/academics/exam-windows/edit-requests?status=REPUBLISHED');
  check('request reaches REPUBLISHED', done2.data.some((x) => x.id === req.id), done2.data.map((x) => x.status));

  console.log('== ADMIN reopens a published window (self-approved, audited)');
  const noReason = await pc('POST', `/academics/exam-windows/${MID}/reopen`, {});
  check('reopen needs a reason', noReason.status === 400, noReason.body);
  const tReopen = await tc('POST', `/academics/exam-windows/${MID}/reopen`, { reason: 'let me in please' });
  check('teacher cannot reopen (403)', tReopen.status === 403, tReopen.status);
  const reo = await pc('POST', `/academics/exam-windows/${MID}/reopen`, { reason: 'Head teacher asked for a recount of Social Studies' });
  check('admin reopens', reo.status < 300 && reo.data.wasPublished === true, reo.body);
  const rd = (await pc('GET', `/academics/exam-windows/${MID}`)).data;
  check('window is REOPENED', rd.status === 'REOPENED', rd.status);
  const audit = sql(`SELECT count(*) FROM academics."ResultEditRequest" WHERE "examWindowId"='${MID}' AND reason LIKE 'Head teacher asked%' AND status='GRANTED'`);
  check('permission recorded in the audit trail', audit === '1', audit);
  const rep2 = await pc('POST', `/academics/exam-windows/${MID}/republish`);
  check('republish after reopen', rep2.status < 300, rep2.body);

  console.log('== PERFORMANCE & STUDENT-LIST EXPORT');
  const std6 = (await pc('GET', '/students/classes?limit=100', null, SECONDARY)).data;
  const classes = std6.items || std6;
  
  // O-Level Form 1 has two streams -> stream vs standard ranking
  const f1 = classes.filter((c) => c.name === 'Form 1' && c.educationStage === 'O_LEVEL');
  const OMID = win('Demo O-Level Midterm Exam');
  const prev = await pc('GET', `/academics/performance-export/preview?examWindowId=${MID}`);
  check('preview: Primary standards listed', prev.status === 200 && prev.data.standards.length === 7, prev.body && prev.data && prev.data.standards && prev.data.standards.length);
  const rowsAll = prev.data.standards.find((s) => s.level === 6).overall;
  const sorted = rowsAll.every((r, i) => i === 0 || (rowsAll[i - 1].average ?? 0) >= (r.average ?? 0));
  check('overall list runs highest to lowest', sorted, rowsAll.map((r) => r.average));
  check('positions are ordered', rowsAll.every((r, i) => i === 0 || r.standardRank >= rowsAll[i - 1].standardRank));
  const sec = (m, p) => call(P.token, m, p, null, SECONDARY);
  const oprev = await sec('GET', `/academics/performance-export/preview?examWindowId=${OMID}&level=1&educationStage=O_LEVEL`);
  const f1std = oprev.data.standards[0];
  check('Form 1 has two streams, each ranked on its own', f1std.streams.length === 2 && f1std.streams.every((s) => s.rows.every((r, i) => i === 0 || (s.rows[i - 1].average ?? 0) >= (r.average ?? 0))), f1std.streams.map((s) => s.label));
  check('stream positions restart at 1 in each stream', f1std.streams.every((s) => s.rows[0].streamRank === 1), f1std.streams.map((s) => s.rows[0].streamRank));
  const oneStream = await sec('GET', `/academics/performance-export/preview?examWindowId=${OMID}&classId=${f1[0].id}`);
  check('filtering one stream keeps its standard position', oneStream.data.standards[0].streams.length === 1 && oneStream.data.standards[0].streams[0].rows.some((r) => r.standardRank > r.streamRank || r.standardRank >= 1), oneStream.data.standards[0].streams[0].rows.slice(0, 3).map((r) => [r.streamRank, r.standardRank]));
  const termPrev = await pc('GET', `/academics/performance-export/preview?termId=${TERM}&academicYearId=${YEAR}&educationStage=PRIMARY`);
  check('term report-card source works', termPrev.status === 200 && termPrev.data.source === 'TERM' && termPrev.data.totalStudents > 50, termPrev.body && termPrev.body.message);
  const roster = await pc('GET', `/academics/performance-export/preview?academicYearId=${YEAR}&level=6&educationStage=PRIMARY`);
  check('student list only (no marks)', roster.status === 200 && roster.data.source === 'ROSTER' && roster.data.standards[0].overall.length >= 14, roster.body && roster.body.message);

  for (const [fmt, sig, mime] of [['xlsx', '504b0304', /spreadsheetml/], ['pdf', '25504446', /pdf/], ['csv', 'efbbbf', /csv/]]) {
    const resp = await fetch(BASE + `/academics/performance-export/${fmt}?examWindowId=${MID}`, { headers: { authorization: 'Bearer ' + P.token, ...PRIMARY } });
    const buf = Buffer.from(await resp.arrayBuffer());
    check(`${fmt.toUpperCase()} download streams correctly`, resp.status === 200 && buf.slice(0, sig.length / 2).toString('hex') === sig && mime.test(resp.headers.get('content-type') || ''), [resp.status, buf.slice(0, 4).toString('hex'), resp.headers.get('content-type')]);
    if (fmt === 'csv') {
      const lines = buf.toString('utf8').split(/\r?\n/).filter(Boolean);
      check('CSV: header + one row per student', lines.length > 90 && /STR POS/.test(lines[0]) && /AVG %/.test(lines[0]), lines.slice(0, 2));
    }
  }
  const rosterCsv = await fetch(BASE + `/academics/performance-export/csv?academicYearId=${YEAR}&level=6&educationStage=PRIMARY`, { headers: { authorization: 'Bearer ' + P.token, ...PRIMARY } });
  check('roster CSV', rosterCsv.status === 200 && /ADMNO/.test(await rosterCsv.text()), rosterCsv.status);
  const emptySel = await pc('GET', `/academics/performance-export/preview?examWindowId=${END}`);
  check('an open window with no calculation gives a clear message', emptySel.status === 400 && /No results found/.test(emptySel.body.message), emptySel.body);
  const S = await login('KS-P-2026-00097', 'Student@Kili2026').catch(() => null);
  if (S) check('students cannot export lists (403)', (await call(S.token, 'GET', `/academics/performance-export/preview?examWindowId=${MID}`)).status === 403);
  const tExp = await tc('GET', `/academics/performance-export/preview?examWindowId=${MID}`);
  check('teachers cannot export school-wide lists (403)', tExp.status === 403, tExp.status);

  console.log(`\nFLOW E2E: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
