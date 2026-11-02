// End-to-end: results calculation (Asha scenario) against the isolated QA stack (gateway :3910, DB kilimanjaro_qa).
const { login, call } = require('./results-e2e-api.js');
const { execSync } = require('child_process');
const fs = require('fs');

const sql = (q) =>
  execSync('psql -h localhost -U postgres -d kilimanjaro_qa -tA -F "|" -v ON_ERROR_STOP=1', { input: q, env: { ...process.env, PGPASSWORD: 'Mtunzi123' } })
    .toString()
    .replace(/\r/g, '')
    .trim();

let pass = 0;
let fail = 0;
const failures = [];
function check(name, cond, info) {
  if (cond) {
    pass++;
    console.log('  PASS', name);
  } else {
    fail++;
    failures.push(name);
    console.log('  FAIL', name, info !== undefined ? JSON.stringify(info).slice(0, 500) : '');
  }
}
const near = (a, b, eps = 0.011) => Math.abs(a - b) <= eps;

const ASHA_SCORES = { Mathematics: 80, English: 75, Kiswahili: 70, Science: 65, 'Social Studies': 60, ICT: 55 };
const CLASS_ID = '4784066e-e304-499b-822f-c235af6a83fe'; // Standard 6
const TERM_ID = 'da0e69ef-1632-40fc-adfb-f9a8fa17c12c'; // Term 2 (current)
const YEAR_ID = '71a7faf9-72b9-44ca-9a47-aa64db0feba5';

(async () => {
  console.log('== SETUP: ensure Standard 6 has 7 subjects (adds ICT + Agriculture)');
  sql(`
    INSERT INTO academics."Subject"(id,name,code,"educationStage","isCompulsory","isActive","updatedAt")
      SELECT gen_random_uuid(),'ICT','E2E-ICT','PRIMARY',true,true,now() WHERE NOT EXISTS (SELECT 1 FROM academics."Subject" WHERE name='ICT');
    INSERT INTO academics."Subject"(id,name,code,"educationStage","isCompulsory","isActive","updatedAt")
      SELECT gen_random_uuid(),'Agriculture','E2E-AGR','PRIMARY',true,true,now() WHERE NOT EXISTS (SELECT 1 FROM academics."Subject" WHERE name='Agriculture');
    INSERT INTO academics."ClassSubject"(id,"schoolId","classId","subjectId","academicYearId","teacherId","educationStage","classLevel","periodsPerWeek","isActive")
      SELECT gen_random_uuid(), m."schoolId", m."classId", s.id, m."academicYearId", m."teacherId", m."educationStage", m."classLevel", 3, true
      FROM academics."ClassSubject" m, academics."Subject" s
      WHERE m."classId"='${CLASS_ID}' AND m."subjectId"=(SELECT id FROM academics."Subject" WHERE name='Mathematics' LIMIT 1)
        AND s.name IN ('ICT','Agriculture')
        AND NOT EXISTS (SELECT 1 FROM academics."ClassSubject" x WHERE x."classId"=m."classId" AND x."subjectId"=s.id AND x."academicYearId"=m."academicYearId");
  `);
  const nSubj = Number(sql(`SELECT count(*) FROM academics."ClassSubject" WHERE "classId"='${CLASS_ID}' AND "isActive"`));
  check('Standard 6 has 7 active subjects', nSubj === 7, nSubj);

  const P = await login('principal@demo.kilimanjaro.test', 'Principal@Kili2026');
  const classes = (await call(P.token, 'GET', '/students/classes?limit=100')).data;
  const clsList = classes.items || classes;
  const std6 = clsList.find((c) => c.id === CLASS_ID);
  const H = { 'X-Active-School': std6.schoolId };
  const api = (m, p, b) => call(P.token, m, p, b, H);

  const students = (await api('GET', `/students?classId=${CLASS_ID}&limit=100`)).data;
  const roster = (students.items || students).sort((a, b) => a.registrationNumber.localeCompare(b.registrationNumber));
  check('Roster of 14', roster.length === 14, roster.length);
  const asha = roster[0];

  console.log('== EXAM TYPES + WINDOWS');
  const mkType = async (name, code, w) => {
    const r = await api('POST', '/academics/exam-types', { name, code, defaultWeight: w });
    return r.data.id ?? r.body.id;
  };
  const annualType = await mkType('E2E Annual Exam', 'E2EANN', 70);
  const monthlyType = await mkType('E2E Monthly Test', 'E2EMON', 30);

  const mkWindow = async (name, typeId, maxScore, weight) => {
    const r = await api('POST', '/academics/exam-windows', {
      examTypeId: typeId, name, academicYearId: YEAR_ID, termId: TERM_ID, educationStage: 'PRIMARY',
      scopeType: 'STANDARDS', scopeLevels: [6], maxScore, weight, openNow: true,
    });
    if (r.status >= 300) console.log(r.body);
    return r.data;
  };
  const annual = await mkWindow('E2E Annual 2026', annualType, 100, 70);
  const monthly = await mkWindow('E2E Monthly 2026', monthlyType, 50, 30);
  check('annual window opened', annual && annual.status === 'OPEN', annual && annual.status);
  check('annual fan-out: 7 assessments', annual && annual.assessmentCount === 7, annual && annual.assessmentCount);
  const W1 = annual.id;
  const W2 = monthly.id;

  // ---- marks helpers (SQL for bulk setup; teacher API path tested below)
  const teacherEntered = sql(`SELECT "teacherId" FROM academics."ClassSubject" WHERE "classId"='${CLASS_ID}' LIMIT 1`);
  const fillMarks = (windowId, maxScore, opts = {}) => {
    const ass = sql(`SELECT a.id, a."classSubjectId", s.name FROM academics."Assessment" a JOIN academics."Subject" s ON s.id=a."subjectId" WHERE a."examWindowId"='${windowId}' ORDER BY s.name`)
      .split('\n').map((l) => l.split('|'));
    let values = '';
    roster.forEach((st, i) => {
      ass.forEach(([aid, csid, sname], j) => {
        if (i === 0 && sname === 'Agriculture' && opts.ashaAgriMissing) return; // the missing result
        let pct;
        if (i === 0) pct = ASHA_SCORES[sname] ?? 70;
        else if (i === 1 || i === 2) pct = 50 + ((j * 9) % 40); // students 1 and 2 are identical -> a tie
        else pct = 40 + ((i * 7 + j * 11) % 55);
        const score = Math.round((pct / 100) * maxScore * 100) / 100;
        values += `('${aid}-${st.id}',gen_random_uuid(),'${aid}','${csid}','${st.id}',${score},'${teacherEntered}'),`;
      });
    });
    const rows = values.slice(0, -1).replace(/\('([^']+)-([^']+)',/g, '(').replace(/\('/g, '(\'');
    sql(`DELETE FROM academics."Mark" WHERE "assessmentId" IN (SELECT id FROM academics."Assessment" WHERE "examWindowId"='${windowId}');`);
    // build proper insert (strip the helper prefix)
    const proper = [];
    roster.forEach((st, i) => {
      ass.forEach(([aid, csid, sname], j) => {
        if (i === 0 && sname === 'Agriculture' && opts.ashaAgriMissing) return;
        let pct;
        if (i === 0) pct = ASHA_SCORES[sname] ?? 70;
        else if (i === 1 || i === 2) pct = 50 + ((j * 9) % 40);
        else pct = 40 + ((i * 7 + j * 11) % 55);
        const score = Math.round((pct / 100) * maxScore * 100) / 100;
        proper.push(`(gen_random_uuid(),'${aid}','${csid}','${st.id}',${score},'${teacherEntered}',(now() at time zone 'utc'))`);
      });
    });
    sql(`INSERT INTO academics."Mark"(id,"assessmentId","classSubjectId","studentId",score,"enteredById","enteredAt") VALUES ${proper.join(',')};`);
    return ass;
  };
  const assAnnual = fillMarks(W1, 100, { ashaAgriMissing: true });
  fillMarks(W2, 50, {});
  const agriAssessment = assAnnual.find((a) => a[2] === 'Agriculture')[0];

  console.log('== GAP 2: readiness + blocked close');
  let rd = (await api('GET', `/academics/exam-windows/${W1}/readiness`)).data;
  check('readiness: not ready', rd.ready === false && rd.canClose === false, rd.blockers);
  check('readiness: 1 missing result', rd.counts.missing === 1, rd.counts);
  check('readiness blocker names the student and subject', /is missing an Agriculture result\./.test(rd.blockers[0].message) && rd.blockers[0].message.includes(asha.firstName), rd.blockers[0]);
  check('readiness blocker has the hint', rd.blockers[0].message.includes('Enter a score, mark the student ABSENT/NOT SAT, or approve an exemption.'));
  let cl = await api('POST', `/academics/exam-windows/${W1}/close`);
  check('close refused (400)', cl.status === 400, cl.status);
  console.log('     message =>', JSON.stringify(cl.body.message));
  check('close message matches spec', /missing an Agriculture result\.\nEnter a score, mark the student ABSENT\/NOT SAT, or approve an exemption\./.test(cl.body.message || ''));
  const det = (await api('GET', `/academics/exam-windows/${W1}`)).data;
  check('GAP 3: window stays OPEN after failed close', det.status === 'OPEN', det.status);
  const locked = Number(sql(`SELECT count(*) FROM academics."Mark" WHERE "isLocked" AND "assessmentId" IN (SELECT id FROM academics."Assessment" WHERE "examWindowId"='${W1}')`));
  check('GAP 3: no marks locked after failed close', locked === 0, locked);
  const resCount = Number(sql(`SELECT count(*) FROM academics."ExamWindowResult" WHERE "examWindowId"='${W1}'`));
  check('GAP 3: no results persisted after failed close', resCount === 0, resCount);

  console.log('== OPTION 1: NOT SAT via teacher upload (zero, counts in average)');
  const T = await login('t-maths-b@demo.kilimanjaro.test', 'Teacher@Kili2026');
  const tHeaders = { 'X-Active-School': std6.schoolId };
  const up = await call(T.token, 'POST', `/academics/exam-windows/assessments/${agriAssessment}/marks/upload`, {
    rows: [{ registrationNumber: asha.registrationNumber, notSat: 'yes' }],
  }, tHeaders);
  console.log('     upload =>', up.status, JSON.stringify(up.data).slice(0, 200));
  check('teacher upload NOT SAT accepted', up.status < 300 && up.data.applied === 1, up.body);
  const tmpl = await call(T.token, 'GET', `/academics/exam-windows/assessments/${agriAssessment}/template`, null, tHeaders);
  const ashaRow = (tmpl.data.rows || []).find((r) => r.registrationNumber === asha.registrationNumber);
  check('template echoes notSat', ashaRow && ashaRow.notSat === true, ashaRow);

  rd = (await api('GET', `/academics/exam-windows/${W1}/readiness`)).data;
  check('readiness now ready', rd.ready && rd.canClose, rd.blockers);
  check('readiness counts 1 not-sat', rd.counts.notSat === 1, rd.counts);

  cl = await api('POST', `/academics/exam-windows/${W1}/close`);
  check('close succeeds', cl.status < 300 && cl.data.closed === true, cl.body);
  let ml = (await api('GET', `/academics/exam-windows/${W1}/merit-list`)).data;
  let ashaRowM = ml.rows.find((r) => r.studentId === asha.id);
  check('Option 1: average = 57.86', near(ashaRowM.mean, 57.86), ashaRowM.mean);
  check('Option 1: 7 of 7 subjects counted', ashaRowM.subjectsAssessed === 7 && ashaRowM.subjectsExpected === 7, [ashaRowM.subjectsAssessed, ashaRowM.subjectsExpected]);
  const agriCell = Object.values(ashaRowM.subjectScores).find((s) => s.subjectName === 'Agriculture');
  check('Option 1: Agriculture NOT_SAT, 0%, graded E (not X)', agriCell.status === 'NOT_SAT' && agriCell.percentage === 0 && agriCell.grade === 'E' && agriCell.points === 5, agriCell);
  check('GAP 3: marks locked after close', Number(sql(`SELECT count(*) FROM academics."Mark" WHERE NOT "isLocked" AND "assessmentId" IN (SELECT id FROM academics."Assessment" WHERE "examWindowId"='${W1}')`)) === 0);

  console.log('== GAP 4: normalized ranking + ties');
  const r1 = ml.rows.find((r) => r.studentId === roster[1].id);
  const r2 = ml.rows.find((r) => r.studentId === roster[2].id);
  check('tie: students 1 & 2 have identical averages', r1.mean === r2.mean, [r1.mean, r2.mean]);
  check('tie: identical stream rank', r1.streamRank === r2.streamRank, [r1.streamRank, r2.streamRank]);
  const sorted = [...ml.rows].sort((a, b) => b.mean - a.mean);
  check('ranks follow average order', sorted.every((r, i) => i === 0 || r.streamRank >= sorted[i - 1].streamRank), sorted.map((r) => [r.mean, r.streamRank]));

  console.log('== OPTION 2: individual exemption (Agriculture for Asha, this window)');
  const exBody = { academicYearId: YEAR_ID, termId: TERM_ID, examWindowId: W1, classId: CLASS_ID, subjectId: sql(`SELECT id FROM academics."Subject" WHERE name='Agriculture' LIMIT 1`), scope: 'STUDENT', studentIds: [asha.id] };
  const noReason = await api('POST', '/academics/result-exemptions', exBody);
  check('exemption requires a reason', noReason.status === 400, noReason.status);
  const tEx = await call(T.token, 'POST', '/academics/result-exemptions', { ...exBody, reason: 'Medical certificate on file' }, tHeaders);
  check('teacher cannot create exemptions (403)', tEx.status === 403, tEx.status);
  const pv = await api('POST', '/academics/result-exemptions/preview', { ...exBody, reason: 'Medical certificate on file' });
  const pvStu = pv.data.windows[0].students[0];
  console.log('     preview =>', JSON.stringify(pvStu));
  check('preview: 1 student affected', pv.data.studentsAffected === 1, pv.data);
  check('preview: 57.86 -> 67.5', near(pvStu.averageBefore, 57.86) && near(pvStu.averageAfter, 67.5), pvStu);
  check('preview: 7 -> 6 subjects', pvStu.subjectsAssessedBefore === 7 && pvStu.subjectsAssessedAfter === 6, pvStu);
  const mk = await api('POST', '/academics/result-exemptions', { ...exBody, reason: 'Medical certificate on file' });
  check('exemption created + approved + audited', mk.status < 300 && mk.data.exemptions[0].status === 'APPROVED' && mk.data.exemptions[0].approvedById && mk.data.exemptions[0].createdById, mk.body);
  check('recompute flagged as required', mk.data.recomputeRequired === true);
  const audit = Number(sql(`SELECT count(*) FROM academics."AcademicAuditLog" WHERE action='RESULT_EXEMPTION_CREATED'`));
  check('audit log row written', audit >= 1, audit);
  const stale = await api('POST', `/academics/exam-windows/${W1}/publish`);
  check('publish refused while results are stale vs exemption', stale.status === 400 && /Recalculate/.test(stale.body.message || ''), stale.body);

  const rc = await api('POST', `/academics/exam-windows/${W1}/compute`);
  check('explicit recompute works', rc.status < 300 && rc.data.exemptSubjects === 1, rc.body);
  ml = (await api('GET', `/academics/exam-windows/${W1}/merit-list`)).data;
  ashaRowM = ml.rows.find((r) => r.studentId === asha.id);
  check('Option 2: average = 67.50', near(ashaRowM.mean, 67.5), ashaRowM.mean);
  check('Option 2: 6 of 7 assessed', ashaRowM.subjectsAssessed === 6 && ashaRowM.subjectsExpected === 7, [ashaRowM.subjectsAssessed, ashaRowM.subjectsExpected]);
  const ex2 = Object.values(ashaRowM.subjectScores).find((s) => s.subjectName === 'Agriculture');
  check('Option 2: Agriculture EXEMPT', ex2.status === 'EXEMPT' && ex2.grade === 'EXEMPT' && ex2.percentage === null, ex2);
  check('Option 2: existing mark preserved', Number(sql(`SELECT count(*) FROM academics."Mark" WHERE "studentId"='${asha.id}' AND "assessmentId"='${agriAssessment}'`)) === 1);

  console.log('== EXPORTS handle EXEMPT');
  const csv = await fetch((process.env.API_BASE || 'http://localhost:3910/api/v1') + `/academics/exam-windows/${W1}/merit-list/csv`, { headers: { authorization: 'Bearer ' + P.token, ...H } });
  const csvText = await csv.text();
  check('CSV export contains EXEMPT cell', csv.status === 200 && csvText.includes('EXEMPT'), csv.status);

  console.log('== revoke -> recompute restores 57.86; then OPTION 3 whole class');
  const revoke = await api('POST', `/academics/result-exemptions/${mk.data.exemptions[0].id}/revoke`, { reason: 'test revert' });
  check('revoke works', revoke.status < 300 && revoke.data.status === 'REVOKED', revoke.body);
  await api('POST', `/academics/exam-windows/${W1}/compute`);
  ml = (await api('GET', `/academics/exam-windows/${W1}/merit-list`)).data;
  check('after revoke average back to 57.86', near(ml.rows.find((r) => r.studentId === asha.id).mean, 57.86));

  const classEx = { ...exBody, scope: 'CLASS', studentIds: undefined, reason: 'Nobody in Standard 6 took Agriculture this term' };
  const pv3 = await api('POST', '/academics/result-exemptions/preview', classEx);
  check('class preview: 14 students affected', pv3.data.studentsAffected === 14, pv3.data.studentsAffected);
  const mk3 = await api('POST', '/academics/result-exemptions', classEx);
  check('class exemption created', mk3.status < 300 && mk3.data.created === 1 && mk3.data.exemptions[0].scope === 'CLASS', mk3.body);
  await api('POST', `/academics/exam-windows/${W1}/compute`);
  ml = (await api('GET', `/academics/exam-windows/${W1}/merit-list`)).data;
  check('Option 3: every student shows Agriculture EXEMPT', ml.rows.every((r) => Object.values(r.subjectScores).find((s) => s.subjectName === 'Agriculture').status === 'EXEMPT'));
  check('Option 3: every student 6 of 7', ml.rows.every((r) => r.subjectsAssessed === 6 && r.subjectsExpected === 7));
  check('Option 3: Asha average 67.5', near(ml.rows.find((r) => r.studentId === asha.id).mean, 67.5));
  const agrSummary = ml.summaries.bySubject.find((s) => s.subjectName === 'Agriculture');
  check('Option 3: Agriculture excluded from subject summary', !agrSummary || agrSummary.entries === 0, agrSummary);
  await api('POST', `/academics/result-exemptions/${mk3.data.exemptions[0].id}/revoke`, { reason: 'revert' });
  await api('POST', `/academics/exam-windows/${W1}/compute`);

  console.log('== GAP 5 + window-level exemption renormalization (Monthly 30% / Annual 70%)');
  const rd2 = (await api('GET', `/academics/exam-windows/${W2}/readiness`)).data;
  check('monthly window ready (max 50)', rd2.ready, rd2.blockers);
  const c2 = await api('POST', `/academics/exam-windows/${W2}/close`);
  check('monthly closed', c2.status < 300, c2.body);

  const badW = await api('POST', '/academics/report-card-compositions', { academicYearId: YEAR_ID, termId: TERM_ID, windows: [{ examWindowId: W1, weight: 50 }, { examWindowId: W2, weight: 20 }] });
  check('weights not totalling 100 rejected', badW.status === 400 && /100%/.test(badW.body.message), badW.body);
  const zeroW = await api('POST', '/academics/report-card-compositions', { academicYearId: YEAR_ID, termId: TERM_ID, windows: [{ examWindowId: W1, weight: 0 }, { examWindowId: W2, weight: 100 }] });
  check('zero weight rejected', zeroW.status === 400, zeroW.body);
  const noDefaultW = await api('POST', '/academics/report-card-compositions', { academicYearId: YEAR_ID, termId: TERM_ID, windows: [{ examWindowId: W1 }, { examWindowId: W2 }] });
  check('default window weights 70+30 accepted by validator', noDefaultW.status < 300 || !/total/i.test(noDefaultW.body.message || ''), noDefaultW.body);

  // Asha exempt from Maths in the MONTHLY window only
  const mathsId = sql(`SELECT id FROM academics."Subject" WHERE name='Mathematics' LIMIT 1`);
  const wEx = await api('POST', '/academics/result-exemptions', { academicYearId: YEAR_ID, termId: TERM_ID, examWindowId: W2, classId: CLASS_ID, subjectId: mathsId, scope: 'STUDENT', studentIds: [asha.id], reason: 'Missed monthly test: hospital' });
  check('window-scoped exemption created', wEx.status < 300, wEx.body);
  const staleCompose = await api('POST', '/academics/report-card-compositions', { academicYearId: YEAR_ID, termId: TERM_ID, windows: [{ examWindowId: W1, weight: 70 }, { examWindowId: W2, weight: 30 }] });
  check('compose refuses stale window results', staleCompose.status === 400 && /Recalculate/.test(staleCompose.body.message || ''), staleCompose.body);
  await api('POST', `/academics/exam-windows/${W2}/compute`);

  const comp = await api('POST', '/academics/report-card-compositions', { name: 'E2E term 2', academicYearId: YEAR_ID, termId: TERM_ID, windows: [{ examWindowId: W1, weight: 70 }, { examWindowId: W2, weight: 30 }] });
  console.log('     compose =>', comp.status, JSON.stringify(comp.body).slice(0, 300));
  check('compose succeeds', comp.status < 300 && comp.data.reportCardsGenerated >= 14, comp.body);

  const trAsha = sql(`SELECT s.name, tr."weightedTotal", tr."resultStatus", tr.grade FROM academics."TermResult" tr JOIN academics."Subject" s ON s.id=tr."subjectId" WHERE tr."studentId"='${asha.id}' AND tr."termId"='${TERM_ID}' ORDER BY s.name`);
  console.log(tr_format(trAsha));
  const mathsRow = trAsha.split('\n').map((l) => l.split('|')).find((c) => c[0] === 'Mathematics');
  check('window exemption: Asha Maths term % = Annual only (80), not 80x0.7', near(Number(mathsRow[1]), 80), mathsRow);
  const englishRow = trAsha.split('\n').map((l) => l.split('|')).find((c) => c[0] === 'English');
  check('other subjects blend 70/30 normally (English 75 both)', near(Number(englishRow[1]), 75), englishRow);

  const rcard = (await api('GET', `/academics/report-cards/${asha.id}/term/${TERM_ID}`)).data;
  const rcardRow = sql(`SELECT "overallAverage","subjectCount","subjectsExpected","exemptSubjectCount","overallGrade", "divisionSummary"->>'descriptor', rank FROM academics."ReportCard" WHERE "studentId"='${asha.id}' AND "termId"='${TERM_ID}'`);
  console.log('     report card =>', rcardRow, rcard ? '' : '(GET shape unknown)');
  const rcCols = rcardRow.split('|');
  check('report card average: Agriculture = 70% x 0 (not sat in Annual) + 30% x 70 (Monthly) = 21 -> 60.86', near(Number(rcCols[0]), 60.86), rcCols);
  check('report card subject counts', rcCols[1] === '7' && rcCols[2] === '7' && rcCols[3] === '0', rcCols);

  console.log('== TERM-WIDE exemption removes subject completely + PDF');
  await api('POST', `/academics/exam-windows/${W2}/unpublish`).catch(() => {});
  const termEx = await api('POST', '/academics/result-exemptions', { academicYearId: YEAR_ID, termId: TERM_ID, classId: CLASS_ID, subjectId: sql(`SELECT id FROM academics."Subject" WHERE name='Agriculture' LIMIT 1`), scope: 'STUDENT', studentIds: [asha.id], reason: 'Curriculum exemption approved for the whole term' });
  check('term-wide exemption created', termEx.status < 300, termEx.body);
  await api('POST', `/academics/exam-windows/${W1}/compute`);
  await api('POST', `/academics/exam-windows/${W2}/compute`);
  const comp2 = await api('POST', '/academics/report-card-compositions', { name: 'E2E term 2 b', academicYearId: YEAR_ID, termId: TERM_ID, windows: [{ examWindowId: W1, weight: 70 }, { examWindowId: W2, weight: 30 }] });
  check('re-compose succeeds', comp2.status < 300, comp2.body);
  const rc2 = sql(`SELECT "overallAverage","subjectCount","subjectsExpected","exemptSubjectCount","divisionSummary"->>'subjectsAssessed' FROM academics."ReportCard" WHERE "studentId"='${asha.id}' AND "termId"='${TERM_ID}'`).split('|');
  console.log('     report card (term exempt) =>', rc2.join(' | '));
  check('report card: Subjects assessed 6 of 7, avg 67.5', near(Number(rc2[0]), 67.5) && rc2[1] === '6' && rc2[2] === '7' && rc2[3] === '1', rc2);
  const trExempt = sql(`SELECT "resultStatus", grade FROM academics."TermResult" tr JOIN academics."Subject" s ON s.id=tr."subjectId" WHERE tr."studentId"='${asha.id}' AND tr."termId"='${TERM_ID}' AND s.name='Agriculture'`);
  check('TermResult Agriculture = EXEMPT', trExempt === 'EXEMPT|EXEMPT', trExempt);

  const pdf = await fetch((process.env.API_BASE || 'http://localhost:3910/api/v1') + `/academics/report-cards/${asha.id}/term/${TERM_ID}/pdf`, { headers: { authorization: 'Bearer ' + P.token, ...H } });
  const buf = Buffer.from(await pdf.arrayBuffer());
  fs.writeFileSync(process.env.PDF_OUT || 'asha-report.pdf', buf);
  check('PDF generated (%PDF)', pdf.status === 200 && buf.slice(0, 4).toString() === '%PDF', [pdf.status, buf.length]);

  console.log('== PUBLISH GUARDS');
  const pub = await api('POST', `/academics/exam-windows/${W1}/publish`);
  check('publish window', pub.status < 300, pub.body);
  const blocked = await api('POST', '/academics/result-exemptions', { academicYearId: YEAR_ID, termId: TERM_ID, examWindowId: W1, classId: CLASS_ID, subjectId: mathsId, scope: 'STUDENT', studentIds: [roster[3].id], reason: 'late request after publication' });
  check('exemption blocked on a published window (409)', blocked.status === 409, [blocked.status, blocked.body.message]);
  const computePub = await api('POST', `/academics/exam-windows/${W1}/compute`);
  check('recompute blocked on a published window', computePub.status === 400, computePub.body);
  const stuTry = await login('student001@demo.kilimanjaro.test', 'Student@Kili2026').catch(() => null);
  if (stuTry) {
    const s403 = await call(stuTry.token, 'GET', `/academics/exam-windows/${W1}/readiness`);
    check('student cannot read readiness (403)', s403.status === 403, s403.status);
  }
  await api('POST', `/academics/exam-windows/${W1}/unpublish`, { reason: 'e2e' });

  console.log('== PUBLISHED REPORT CARDS: edit requires unpublish');
  await api('POST', `/academics/exam-windows/${W2}/compute`);
  await api('POST', `/academics/exam-windows/${W1}/compute`);
  const pubCompose = await api('POST', '/academics/report-card-compositions', { name: 'E2E publish', publish: true, academicYearId: YEAR_ID, termId: TERM_ID, windows: [{ examWindowId: W1, weight: 70 }, { examWindowId: W2, weight: 30 }] });
  check('compose + publish report cards', pubCompose.status < 300 && pubCompose.data.published === true, pubCompose.body);
  const stuView = await login('student001@demo.kilimanjaro.test', 'Student@Kili2026').catch(() => null);
  const exBlocked = await api('POST', '/academics/result-exemptions', { academicYearId: YEAR_ID, termId: TERM_ID, examWindowId: W1, classId: CLASS_ID, subjectId: mathsId, scope: 'STUDENT', studentIds: [roster[4].id], reason: 'Too late: cards are published' });
  check('exemption blocked while report cards are published', exBlocked.status === 409 && /Report cards/.test(exBlocked.body.message), exBlocked.body);
  const reCompose = await api('POST', '/academics/report-card-compositions', { name: 'E2E again', academicYearId: YEAR_ID, termId: TERM_ID, windows: [{ examWindowId: W1, weight: 70 }, { examWindowId: W2, weight: 30 }] });
  check('re-compose blocked while cards are published', reCompose.status === 400 && /already published/.test(reCompose.body.message), reCompose.body);
  const tUnpub = await call(T.token, 'POST', '/academics/results/unpublish', { classId: CLASS_ID, termId: TERM_ID }, tHeaders);
  check('teacher cannot unpublish (403)', tUnpub.status === 403, tUnpub.status);
  const unpub = await api('POST', '/academics/results/unpublish', { classId: CLASS_ID, termId: TERM_ID });
  check('principal unpublishes class results', unpub.status < 300 && unpub.data.unpublished === true && unpub.data.reportCards >= 14, unpub.body);
  const exOk = await api('POST', '/academics/result-exemptions', { academicYearId: YEAR_ID, termId: TERM_ID, examWindowId: W1, classId: CLASS_ID, subjectId: mathsId, scope: 'STUDENT', studentIds: [roster[4].id], reason: 'Allowed after unpublish' });
  check('exemption allowed after unpublish', exOk.status < 300, exOk.body);

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  if (fail) console.log('FAILED:', failures);
  fs.writeFileSync('e2e-state.json', JSON.stringify({ W1, W2, annualType, monthlyType }));
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});

function tr_format(s) {
  return s.split('\n').map((l) => '       ' + l).join('\n');
}
