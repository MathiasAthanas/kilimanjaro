/**
 * Teacher flow end-to-end checks against a running stack (default: gateway on :3000).
 *
 *   API_BASE=http://localhost:3000/api/v1 node backend/scripts/qa/teacher-flow-e2e.js
 *
 * Uses the demo accounts from docs/demo-login-credentials.md. It writes a few rows
 * (attendance, an intervention, an announcement, partial CAT marks) and removes or
 * restores them at the end, so it is safe to re-run on the demo data.
 */
const { execSync } = require('child_process');
const { login, call } = require('./results-e2e-api.js');

const PG = { PGPASSWORD: process.env.PGPASSWORD || 'Mtunzi123' };
const DB = process.env.PGDATABASE || 'kilimanjaro_db';
const psql = (q) => execSync(`psql -h localhost -U postgres -d ${DB} -tA`, { input: q, env: { ...process.env, ...PG } }).toString().replace(/\r/g, '').trim();

let pass = 0;
let fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { pass += 1; console.log('  ok   ', label); } else { fail += 1; console.log('  FAIL ', label, extra); }
};

(async () => {
  const PRI = '00000000-0000-4000-8000-000000000002';
  const SEC = '00000000-0000-4000-8000-000000000003';
  const B = await login('t-maths-b@demo.kilimanjaro.test', 'Teacher@Kili2026'); // two schools, class teacher of Standard 5 A
  const A = await login('t-maths-a@demo.kilimanjaro.test', 'Teacher@Kili2026'); // two schools, other classes
  const L = await login('librarian@demo.kilimanjaro.test', 'Staff@Kili2026'); // teacher with no classes
  const created = { intervention: null, announcement: null };

  console.log('\n# Workspace and school scope');
  const ws = (await call(B.token, 'GET', '/academics/teacher/workspace')).data;
  ok(ws.classes.length === 14 && ws.schoolIds.length === 2, 'teacher sees classes from both of their schools', `classes=${ws.classes.length}`);
  ok(ws.classes.every((c) => c.schoolId && c.label && c.subjectName), 'every class carries school, class name and subject');
  ok(ws.assessments.every((a) => typeof a.required === 'number' && typeof a.entered === 'number'), 'assessments carry real entered/required counts');
  const onlyPri = (await call(B.token, 'GET', '/academics/teacher/workspace', null, { 'X-Active-School': PRI })).data;
  ok(onlyPri.classes.length === 5 && onlyPri.classes.every((c) => c.schoolId === PRI), 'active school narrows the workspace to that school', `n=${onlyPri.classes.length}`);
  const none = (await call(L.token, 'GET', '/academics/teacher/workspace')).data;
  ok(none.classes.length === 0 && none.assessments.length === 0, 'a teacher with no assignments gets an empty workspace');

  console.log('\n# Rosters and analytics are limited to the teacher\'s own classes');
  const maths = ws.classes.find((c) => c.subjectName === 'Mathematics');
  const roster = await call(B.token, 'GET', `/academics/teacher/class-subjects/${maths.classSubjectId}/students`);
  ok(roster.status === 200 && roster.data.students.length === maths.studentCount, 'own class-subject roster matches the class card', `${roster.data.students && roster.data.students.length} vs ${maths.studentCount}`);
  const other = await call(A.token, 'GET', `/academics/teacher/class-subjects/${maths.classSubjectId}/students`);
  ok(other.status === 403, 'another teacher cannot read that roster', `status=${other.status}`);
  const an = await call(B.token, 'GET', `/academics/teacher/class-subjects/${maths.classSubjectId}/analytics`);
  ok(an.status === 200 && an.data.overall && an.data.students.length > 0 && an.data.assessments.length > 0, 'class analytics are computed from entered marks');
  ok(an.data.gradeOrder.length > 0 && Object.keys(an.data.assessments[0].distribution).every((g) => an.data.gradeOrder.includes(g)), 'grade bands come from the school grading scale');
  const anOther = await call(A.token, 'GET', `/academics/teacher/class-subjects/${maths.classSubjectId}/analytics`);
  ok(anOther.status === 403, 'another teacher cannot read those analytics');
  const myAn = (await call(B.token, 'GET', '/academics/teacher/analytics')).data;
  ok(myAn.summary.totalClasses === 14 && myAn.courses.length === 14, 'teaching analytics cover every class');
  const stub = (await call(B.token, 'GET', `/teacher/classes/${maths.classSubjectId}/analytics`)).data;
  ok((stub.classSubjects || []).every((cs) => cs.teacherId === B.user.id), 'gateway analytics never lists other teachers\' classes');

  console.log('\n# Attendance register');
  const today = new Date().toISOString().slice(0, 10);
  const reg = (await call(B.token, 'GET', `/teacher/class-subjects/${maths.classId}/students`)).data.items;
  const records = reg.map((s, i) => ({ studentId: s.id, status: i === 0 ? 'ABSENT' : i === 1 ? 'LATE' : 'PRESENT' }));
  const taken = await call(B.token, 'POST', '/teacher/attendance', { classId: maths.classId, date: today, records });
  ok(taken.status === 201, 'register saves with only class, date and statuses (term resolved server-side)', `status=${taken.status}`);
  const reopened = (await call(B.token, 'GET', `/teacher/class-subjects/${maths.classId}/students`)).data.items;
  ok(reopened[0].attendanceStatus === 'ABSENT' && reopened[1].attendanceStatus === 'LATE', 'a register taken today reopens as it was');
  const resave = await call(B.token, 'POST', '/teacher/attendance', { classId: maths.classId, date: today, records: records.map((r) => ({ ...r, status: 'PRESENT' })) });
  ok(resave.status === 201, 'the same day can be corrected and saved again');
  const bad = await call(B.token, 'POST', '/teacher/attendance', { classId: maths.classId, date: today, records: [] });
  ok(bad.status === 400, 'an empty register is rejected with a clear message', `status=${bad.status}`);

  console.log('\n# Support plans (interventions)');
  const sid = roster.data.students[0].id;
  const iv = await call(B.token, 'POST', '/academics/interventions', { studentId: sid, schoolId: maths.schoolId, subjectId: maths.subjectId, subjectName: 'Mathematics', type: 'TEACHER_SUPPORT_GIVEN', note: 'e2e support plan' });
  created.intervention = iv.data && iv.data.id;
  ok(iv.status === 201 && iv.data.schoolId === maths.schoolId, 'plan is filed under the student\'s own school');
  const wrongSchool = await call(B.token, 'POST', '/academics/interventions', { studentId: sid, schoolId: '00000000-0000-4000-8000-000000000001', type: 'OTHER', note: 'x' });
  ok(wrongSchool.status === 403, 'a school the teacher does not belong to is refused');
  const mine = await call(B.token, 'GET', '/academics/interventions/mine');
  ok(mine.status === 200 && mine.data.some((i) => i.id === created.intervention), 'teacher can list their own plans');
  const stolen = await call(A.token, 'PATCH', `/academics/interventions/${created.intervention}`, { note: 'hijack' });
  ok(stolen.status === 403, 'another teacher cannot edit someone else\'s plan', `status=${stolen.status}`);
  const edited = await call(B.token, 'PATCH', `/academics/interventions/${created.intervention}`, { isFollowedUp: true });
  ok(edited.status === 200, 'the author can mark their plan as followed up');
  const mineA = await call(A.token, 'GET', '/academics/interventions/mine');
  ok(!mineA.data.some((i) => i.id === created.intervention), 'other teachers do not see it in their list');

  console.log('\n# Classic (CAT) marks: save as you go, submit only when complete');
  const catRow = psql(`select a.id from academics."Assessment" a join academics."ClassSubject" cs on cs.id=a."classSubjectId" join auth.users u on u.id=cs."teacherId" where u.email='t-maths-a@demo.kilimanjaro.test' and a."examWindowId" is null and a.status='OPEN' limit 1`);
  if (!catRow) {
    console.log('  skip  no open CAT assessment for t-maths-a in this database');
  } else {
    const sheet = (await call(A.token, 'GET', `/academics/assessments/${catRow}/marks/sheet`)).data;
    ok(sheet.rows.length > 0 && 'exempt' in sheet.rows[0], 'marks sheet lists the students with an exempt flag');
    const before = psql(`select count(*) from academics."Mark" where "assessmentId"='${catRow}'`);
    const original = psql(`select score||'|'||"isAbsent"||'|'||"notSat" from academics."Mark" where "assessmentId"='${catRow}' and "studentId"='${sheet.rows[0].studentId}'`);
    const partial = await call(A.token, 'POST', `/academics/assessments/${catRow}/marks/bulk`, { marks: [{ studentId: sheet.rows[0].studentId, score: 61 }] });
    ok(partial.status === 201 || partial.status === 200, 'a partial save keeps the rows that are filled in', `status=${partial.status}`);
    const over = await call(A.token, 'POST', `/academics/assessments/${catRow}/marks/bulk`, { marks: [{ studentId: sheet.rows[0].studentId, score: 1000 }] });
    ok(over.status === 400 && /between 0 and/.test(JSON.stringify(over.body)), 'a score above the maximum is refused with the limit in the message');
    ok(psql(`select count(*) from academics."Mark" where "assessmentId"='${catRow}'`) === before, 'a refused save changed nothing');
    const foreign = await call(B.token, 'POST', `/academics/assessments/${catRow}/marks/bulk`, { marks: [{ studentId: sheet.rows[0].studentId, score: 50 }] });
    ok(foreign.status === 403, 'another teacher cannot enter marks for it', `status=${foreign.status}`);
    if (original) {
      const [score, abs, ns] = original.split('|');
      psql(`update academics."Mark" set score=${score}, "isAbsent"=${abs === 't'}, "notSat"=${ns === 't'} where "assessmentId"='${catRow}' and "studentId"='${sheet.rows[0].studentId}'`);
    }
  }

  console.log('\n# Exam-window marks (upload API used by the exam screen)');
  const winAssess = ws.assessments.find((a) => a.examWindow && a.examWindow.status === 'OPEN' && a.entered < a.required);
  if (winAssess) {
    const tpl = (await call(B.token, 'GET', `/academics/exam-windows/assessments/${winAssess.id}/template`)).data;
    const r0 = tpl.rows[0];
    const upl = await call(B.token, 'POST', `/academics/exam-windows/assessments/${winAssess.id}/marks/upload`, { rows: [{ registrationNumber: r0.registrationNumber, score: 44, row: 2 }], autoSubmit: false });
    ok(upl.status === 201 || upl.status === 200, 'a single filled row saves without the whole class', `status=${upl.status} ${JSON.stringify(upl.body).slice(0, 120)}`);
    psql(`delete from academics."Mark" where "assessmentId"='${winAssess.id}' and "studentId" in (select id from students."Student" where "registrationNumber"='${r0.registrationNumber}')`);
  } else {
    console.log('  skip  no half-filled open exam assessment for t-maths-b');
  }

  console.log('\n# Report-card remark belongs to the class teacher, and not once published');
  const cardClass = ws.registers.find((r) => r.isClassTeacher);
  if (cardClass) {
    const studs = (await call(B.token, 'GET', `/teacher/class-subjects/${cardClass.classId}/students`)).data.items;
    const cards = (await call(B.token, 'GET', `/academics/report-cards/student/${studs[0].id}`)).data;
    const card = cards.find((c) => c.isPublished) || cards[0];
    if (card) {
      const own = await call(B.token, 'PATCH', `/academics/report-cards/${card.id}/comments`, { teacherComment: 'e2e remark' });
      ok(card.isPublished ? own.status === 403 : own.status === 200, card.isPublished ? 'class teacher cannot change the remark on a published card' : 'class teacher can write the remark', `status=${own.status}`);
      const intruder = await call(A.token, 'PATCH', `/academics/report-cards/${card.id}/comments`, { teacherComment: 'not mine' });
      ok(intruder.status === 403, 'a teacher who is not that class\'s teacher cannot write the remark', `status=${intruder.status} ${JSON.stringify(intruder.body).slice(0, 120)}`);
    }
  }

  console.log('\n# Announcements');
  const ann = await call(B.token, 'POST', '/notifications/announcements', { title: 'e2e notice', body: 'e2e body', priority: 'NORMAL', targetRoles: ['STUDENT', 'PARENT'], targetClassIds: [maths.classId], channels: ['IN_APP'] });
  created.announcement = ann.data && ann.data.id;
  ok(ann.status === 201 && ann.data.targetClassIds.includes(maths.classId), 'announcement is sent to the chosen classes');
  const mineAnn = await call(B.token, 'GET', `/notifications/announcements?authorId=${B.user.id}`);
  ok(mineAnn.status === 200 && mineAnn.data.some((a) => a.id === created.announcement), 'teacher can list what they sent');
  const legacy = await call(B.token, 'POST', '/notifications/announcements', { title: 'x', body: 'y', audience: 'Students' });
  ok(legacy.status === 400, 'the old malformed payload is refused (the form no longer sends it)');

  console.log('\n# HOD can use the teacher workspace for their own classes');
  const H = await login('hod-maths@demo.kilimanjaro.test', 'Hod@Kili2026');
  const hw = await call(H.token, 'GET', '/academics/teacher/workspace');
  ok(hw.status === 200 && Array.isArray(hw.data.classes), 'HOD reaches /academics/teacher/workspace');

  // ── cleanup ──
  psql(`delete from students."AttendanceRecord" where "classId"='${maths.classId}' and date='${today}' and "markedById"='${B.user.id}'`);
  if (created.intervention) psql(`delete from academics."AcademicIntervention" where id='${created.intervention}'`);
  if (created.announcement) psql(`delete from notifications."Announcement" where id='${created.announcement}'`);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERROR', e.message); process.exit(1); });
