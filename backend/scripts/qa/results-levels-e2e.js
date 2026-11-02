// O-Level + A-Level + optional subjects + grading-scale readiness, against the QA stack.
const { login, call } = require('./results-e2e-api.js');
const { execSync } = require('child_process');

const sql = (q) =>
  execSync('psql -h localhost -U postgres -d kilimanjaro_qa -tA -F "|" -v ON_ERROR_STOP=1', { input: q, env: { ...process.env, PGPASSWORD: 'Mtunzi123' } })
    .toString().replace(/\r/g, '').trim();

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, info) {
  if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; failures.push(name); console.log('  FAIL', name, info !== undefined ? JSON.stringify(info).slice(0, 600) : ''); }
}
const near = (a, b, eps = 0.011) => Math.abs(a - b) <= eps;

const YEAR_ID = '71a7faf9-72b9-44ca-9a47-aa64db0feba5';
const TERM_ID = '61566801-8ac1-4b61-9f2b-855c1c4ded40'; // Term 3 (no seeded report cards)
const FORM4 = '6db5dd84-6a03-4570-9038-9a6de8d8a155';
const FORM6_PCM = 'e581fd49-3a51-4073-87b6-c1f7da3597c7';

(async () => {
  const P = await login('principal@demo.kilimanjaro.test', 'Principal@Kili2026');
  const classes = (await call(P.token, 'GET', '/students/classes?limit=100')).data;
  const list = classes.items || classes;
  const f4 = list.find((c) => c.id === FORM4);
  const api = (school) => (m, p, b) => call(P.token, m, p, b, { 'X-Active-School': school });
  const sec = api(f4.schoolId);
  const rosterOf = async (classId) => {
    const r = (await sec('GET', `/students?classId=${classId}&limit=100`)).data;
    return (r.items || r).sort((a, b) => a.registrationNumber.localeCompare(b.registrationNumber));
  };
  const mkType = async (code) => (await sec('POST', '/academics/exam-types', { name: 'E2E ' + code, code: 'E2E' + code, defaultWeight: 100 })).data.id;
  const teacher = sql(`SELECT "teacherId" FROM academics."ClassSubject" WHERE "classId"='${FORM4}' LIMIT 1`);

  // pctFor(studentIndex, subjectIndex, subjectName) -> percentage | null (missing) | 'ABS'
  const fill = async (windowId, classIds, pctFor, max = 100) => {
    const ass = sql(`SELECT a.id, a."classSubjectId", a."classId", s.name FROM academics."Assessment" a JOIN academics."Subject" s ON s.id=a."subjectId" WHERE a."examWindowId"='${windowId}' ORDER BY a."classId", s.name`)
      .split('\n').filter(Boolean).map((l) => l.split('|'));
    const rosters = {};
    for (const c of classIds) rosters[c] = await rosterOf(c);
    const vals = [];
    for (const [aid, csid, cid, sname] of ass) {
      const sj = ass.filter((x) => x[2] === cid).findIndex((x) => x[0] === aid);
      rosters[cid].forEach((st, i) => {
        const v = pctFor(i, sj, sname, cid);
        if (v === null || v === undefined) return;
        const absent = v === 'ABS';
        const nsat = v === 'NS';
        const score = absent || nsat ? 0 : Math.round((v / 100) * max * 100) / 100;
        vals.push(`(gen_random_uuid(),'${aid}','${csid}','${st.id}',${score},${absent || nsat},${nsat},'${teacher}',(now() at time zone 'utc'))`);
      });
    }
    sql(`INSERT INTO academics."Mark"(id,"assessmentId","classSubjectId","studentId",score,"isAbsent","notSat","enteredById","enteredAt") VALUES ${vals.join(',')};`);
    return rosters;
  };
  const mkWindow = async (name, typeId, stage, level) => {
    const r = await sec('POST', '/academics/exam-windows', { examTypeId: typeId, name, academicYearId: YEAR_ID, termId: TERM_ID, educationStage: stage, scopeType: 'STANDARDS', scopeLevels: [level], maxScore: 100, weight: 100, openNow: true });
    if (r.status >= 300) console.log(r.body);
    return r.data;
  };

  console.log('== O-LEVEL (Form 4): divisions, ungraded, gap-proof grading, NOT SAT points');
  const t1 = await mkType('OL');
  const w = await mkWindow('E2E O-Level 2026', t1, 'O_LEVEL', 4);
  check('Form 4 window opened with 8 subjects', w.assessmentCount === 8, w.assessmentCount);
  const subjNames = sql(`SELECT s.name FROM academics."Assessment" a JOIN academics."Subject" s ON s.id=a."subjectId" WHERE a."examWindowId"='${w.id}' ORDER BY s.name`).split('\n');
  const rosters = await fill(w.id, [FORM4], (i, j, sname) => {
    if (i === 0) return 85;                       // all A  -> 8 subjects, best 7 = 7 pts
    if (i === 1) return 80;                       // will get 2 exemptions -> 6 left -> Ungraded
    if (i === 2) return sname === subjNames[0] ? 74.6 : 78; // fractional 74.6 -> B (gap between 74 and 75)
    if (i === 3) return sname === subjNames[1] ? 'NS' : 80; // not sat -> F (5 pts), not X(0)
    return 50 + ((i * 3 + j) % 30);
  });
  const stu = rosters[FORM4];
  const subjIds = Object.fromEntries(sql(`SELECT s.name, s.id FROM academics."Subject" s JOIN academics."Assessment" a ON a."subjectId"=s.id WHERE a."examWindowId"='${w.id}'`).split('\n').map((l) => l.split('|')));
  for (const sn of [subjNames[2], subjNames[3]]) {
    const ex = await sec('POST', '/academics/result-exemptions', { academicYearId: YEAR_ID, termId: TERM_ID, examWindowId: w.id, classId: FORM4, subjectId: subjIds[sn], scope: 'STUDENT', studentIds: [stu[1].id], reason: 'Exempt for e2e (O-Level)' });
    check(`exemption ${sn} for student 1`, ex.status < 300, ex.body);
  }
  const ex1 = await sec('POST', '/academics/result-exemptions', { academicYearId: YEAR_ID, termId: TERM_ID, examWindowId: w.id, classId: FORM4, subjectId: subjIds[subjNames[4]], scope: 'STUDENT', studentIds: [stu[2].id], reason: 'Exempt for e2e (one only)' });
  check('single exemption for student 2', ex1.status < 300, ex1.body);

  // Gap 1: no grading scale -> blocked, clear message
  sql(`UPDATE academics."GradingScale" SET "isActive"=false WHERE "educationStage"='O_LEVEL';`);
  await sec('GET', `/academics/grading-scales`); // noop
  // cache keys are per-process in redis (disabled in QA) so the change is immediately visible
  let rd = (await sec('GET', `/academics/exam-windows/${w.id}/readiness`)).data;
  check('GAP 1: readiness reports missing grading scale', rd && rd.ready === false && rd.blockers.some((b) => b.code === 'GRADING_SCALE_MISSING'), rd && rd.blockers);
  const clBlocked = await sec('POST', `/academics/exam-windows/${w.id}/close`);
  check('GAP 1: close blocked without a scale (400, clear message)', clBlocked.status === 400 && /No active grading scale/.test(clBlocked.body.message || ''), clBlocked.body);
  check('GAP 1/3: window still OPEN', (await sec('GET', `/academics/exam-windows/${w.id}`)).data.status === 'OPEN');
  sql(`UPDATE academics."GradingScale" SET "isActive"=true WHERE "educationStage"='O_LEVEL';`);

  const cl = await sec('POST', `/academics/exam-windows/${w.id}/close`);
  check('O-Level close succeeds', cl.status < 300, cl.body);
  const ml = (await sec('GET', `/academics/exam-windows/${w.id}/merit-list`)).data;
  const row = (i) => ml.rows.find((r) => r.studentId === stu[i].id);
  check('student 0: Division I, 7 best of 8', row(0).division === 'Division I' && row(0).divisionPoints === 7 && row(0).subjectsAssessed === 8, [row(0).division, row(0).divisionPoints]);
  check('student 1: only 6 eligible -> Ungraded', row(1).division === 'Ungraded' && row(1).subjectsAssessed === 6 && /fewer than 7 eligible subjects/.test(row(1).divisionNote), [row(1).division, row(1).divisionNote]);
  check('student 1: average still calculated (80)', near(row(1).mean, 80), row(1).mean);
  check('student 2: 7 eligible -> still graded Division I', row(2).subjectsAssessed === 7 && /Division/.test(row(2).division), [row(2).division, row(2).subjectsAssessed]);
  const frac = Object.values(row(2).subjectScores).find((s) => s.subjectName === subjNames[0]);
  check('GAP 6: 74.6% falls in the 74->75 gap and resolves to B', frac.percentage === 74.6 && frac.grade === 'B', frac);
  const ns = Object.values(row(3).subjectScores).find((s) => s.subjectName === subjNames[1]);
  check('NOT SAT in O-Level = F with 5 points (not X/0)', ns.status === 'NOT_SAT' && ns.grade === 'F' && ns.points === 5, ns);
  check('student 3: the NOT SAT F is counted as a failing subject (best-7 sum unchanged at 7)', row(3).divisionPoints === 7 && /1 failing subject/.test(row(3).divisionNote), [row(3).divisionPoints, row(3).divisionNote]);
  const ranks = ml.rows.map((r) => r.standardRank);
  check('ranks computed for every candidate', ranks.every((x) => x >= 1), ranks);

  console.log('== OPTIONAL SUBJECTS: only enrolled students are expected');
  const optSubj = subjNames[5];
  sql(`UPDATE academics."Subject" SET "isCompulsory"=false WHERE id='${subjIds[optSubj]}';`);
  // wipe optional-subject marks for students not enrolled (they never sat it)
  const enrolled = stu.slice(0, 6);
  sql(`DELETE FROM academics."Mark" WHERE "assessmentId" IN (SELECT id FROM academics."Assessment" WHERE "examWindowId"='${w.id}' AND "subjectId"='${subjIds[optSubj]}') AND "studentId" NOT IN (${enrolled.map((s) => `'${s.id}'`).join(',')});`);
  sql(`INSERT INTO academics."StudentSubjectEnrollment"(id,"studentId","classId","subjectId","academicYearId",\"isActive\") VALUES ${enrolled.map((s) => `(gen_random_uuid(),'${s.id}','${FORM4}','${subjIds[optSubj]}','${YEAR_ID}',true)`).join(',')};`);
  rd = (await sec('POST', `/academics/exam-windows/${w.id}/compute`));
  check('recompute after optional-subject setup', rd.status < 300, rd.body);
  const rd2 = (await sec('GET', `/academics/exam-windows/${w.id}/readiness`)).data;
  const stud11 = rd2.classes[0].students.find((s) => s.studentId === stu[11].id);
  const stud0 = rd2.classes[0].students.find((s) => s.studentId === stu[0].id);
  check('non-enrolled student is NOT expected to take the optional subject', stud11 && !stud11.cells[subjIds[optSubj]] && stud11.subjectsExpected === 7, stud11 && [stud11.subjectsExpected, Object.keys(stud11.cells).length]);
  check('enrolled student IS expected to take it', stud0 && !!stud0.cells[subjIds[optSubj]] && stud0.subjectsExpected === 8);
  check('no missing results (non-enrolled need no exemption)', rd2.counts.missing === 0, rd2.counts);
  // inactive class subject is not expected
  sql(`UPDATE academics."ClassSubject" SET "isActive"=false WHERE "classId"='${FORM4}' AND "subjectId"='${subjIds[subjNames[7]]}';`);
  const rd3 = (await sec('GET', `/academics/exam-windows/${w.id}/readiness`)).data;
  check('inactive class-subject drops out (no exemption needed)', rd3.classes[0].students[0].subjectsExpected <= 7 && !rd3.subjects.some((s) => s.subjectName === subjNames[7]), rd3.subjects.map((s) => s.subjectName));
  sql(`UPDATE academics."ClassSubject" SET "isActive"=true WHERE "classId"='${FORM4}' AND "subjectId"='${subjIds[subjNames[7]]}';`);

  console.log('== A-LEVEL (Form 6 PCM): combination subjects, principal-only divisions');
  const t2 = await mkType('AL');
  const wa = await mkWindow('E2E A-Level 2026', t2, 'A_LEVEL', 6);
  check('A-Level window opened', wa && wa.status === 'OPEN', wa && wa.status);
  const alRoster = await fill(wa.id, [FORM6_PCM, '54c1b7f4-a47b-44d6-b1c4-48552cf3c13a'], (i, j, sname) => {
    if (i === 0) return sname === 'General Studies' ? 30 : 85; // 3 principals A, GS weak -> Division I from principals only
    if (i === 1) return 70;
    return 55;
  });
  const a0 = alRoster[FORM6_PCM];
  const chemId = sql(`SELECT s.id FROM academics."Assessment" a JOIN academics."Subject" s ON s.id=a."subjectId" WHERE a."examWindowId"='${wa.id}' AND a."classId"='${FORM6_PCM}' AND s.name='Chemistry' LIMIT 1`);
  const exA = await api(list.find((c) => c.id === FORM6_PCM).schoolId)('POST', '/academics/result-exemptions', { academicYearId: YEAR_ID, termId: TERM_ID, examWindowId: wa.id, classId: FORM6_PCM, subjectId: chemId, scope: 'STUDENT', studentIds: [a0[1].id], reason: 'Exempt Chemistry A-Level e2e' });
  check('A-Level exemption created', exA.status < 300, exA.body);
  const clA = await sec('POST', `/academics/exam-windows/${wa.id}/close`);
  check('A-Level close succeeds', clA.status < 300, clA.body);
  const mlA = (await sec('GET', `/academics/exam-windows/${wa.id}/merit-list`)).data;
  const ar = (id) => mlA.rows.find((r) => r.studentId === id);
  console.log('     A-Level rows =>', mlA.rows.filter((r) => r.classId === FORM6_PCM).map((r) => `${r.studentName.split(' ')[0]}:${r.division}/${r.divisionPoints}/${r.subjectsAssessed}of${r.subjectsExpected}`).join('  '));
  check('A-Level student 0: Division I from 3 principal A grades (GS ignored)', ar(a0[0].id).division === 'Division I' && ar(a0[0].id).divisionPoints === 3, [ar(a0[0].id).division, ar(a0[0].id).divisionPoints]);
  check('A-Level student 1: Chemistry exempt -> Ungraded (insufficient principal subjects)', ar(a0[1].id).division === 'Ungraded' && /fewer than 3 eligible principal/.test(ar(a0[1].id).divisionNote), [ar(a0[1].id).division, ar(a0[1].id).divisionNote]);
  check('A-Level subjects come from the combination (4 per student)', ar(a0[0].id).subjectsExpected === 4, ar(a0[0].id).subjectsExpected);

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  if (fail) console.log('FAILED:', failures);
  // cleanup (only what this script created)
  sql(`UPDATE academics."Subject" SET "isCompulsory"=true WHERE name IN (${subjNames.map((n) => `'${n}'`).join(',')});
       DELETE FROM academics."StudentSubjectEnrollment" WHERE "classId"='${FORM4}' AND "subjectId"='${subjIds[optSubj]}';
       DELETE FROM academics."ResultCalculationExemption" WHERE reason LIKE 'Exempt%e2e%' OR reason LIKE '%e2e%';
       DELETE FROM academics."ExamWindow" WHERE name LIKE 'E2E%';
       DELETE FROM academics."ExamType" WHERE code LIKE 'E2E%';
       UPDATE academics."GradingScale" SET "isActive"=true;`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
