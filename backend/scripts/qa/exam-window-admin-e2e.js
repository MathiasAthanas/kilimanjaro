/**
 * Admin-side exam window checks: creation rules, the subjects & teachers preview, omitting subjects
 * (whole window, one class, school-wide), and that results/exports follow. Runs against the dev stack
 * (gateway :3000) as the demo principal with the Primary school selected, creates its own windows and
 * deletes them at the end. It never publishes, so no report cards or analytics are touched.
 *
 *   node backend/scripts/qa/exam-window-admin-e2e.js
 */
const { execSync } = require('child_process');
const { login, call: rawCall } = require('./results-e2e-api.js');

const DB = process.env.PGDATABASE || 'kilimanjaro_db';
const psql = (q) => execSync(`psql -h localhost -U postgres -d ${DB} -tA`, { input: q, env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD || 'Mtunzi123' } }).toString().replace(/\r/g, '').trim();
const PRI = '00000000-0000-4000-8000-000000000002';
const call = (t, m, p, b) => rawCall(t, m, p, b, { 'X-Active-School': PRI });
let pass = 0;
let fail = 0;
const ok = (c, label, extra = '') => { if (c) { pass += 1; console.log('  ok   ', label); } else { fail += 1; console.log('  FAIL ', label, extra); } };
const created = [];

(async () => {
  const P = await login('principal@demo.kilimanjaro.test', 'Principal@Kili2026');
  const T = await login('t-maths-b@demo.kilimanjaro.test', 'Teacher@Kili2026'); // teaches Science in Standard 3 A (Primary)
  const years = (await call(P.token, 'GET', '/students/academic-years')).data;
  const terms = (await call(P.token, 'GET', '/students/terms')).data;
  const types = (await call(P.token, 'GET', '/academics/exam-types')).data;
  const year = years.find((y) => y.name === '2026 Academic Year');
  const otherYear = years.find((y) => y.id !== year.id);
  const term = terms.find((t) => t.academicYearId === year.id && t.name === 'Term 2');
  const type = (types.items || types)[0];
  const base = { examTypeId: type.id, academicYearId: year.id, termId: term.id, scopeType: 'STANDARDS', scopeLevels: [3, 4] };
  const mk = async (name, extra = {}) => {
    const r = await call(P.token, 'POST', '/academics/exam-windows', { ...base, name, ...extra });
    if (r.data && r.data.id) created.push(r.data.id);
    return r;
  };
  const stamp = Date.now().toString().slice(-5);

  console.log('\n# Creating a window is validated up front');
  ok((await mk('x', { academicYearId: otherYear.id })).status === 400, 'a term from another academic year is refused');
  ok((await mk('x', { scopeLevels: [99] })).status === 400, 'a scope that matches no classes is refused');
  ok((await mk('x', { opensAt: '2026-11-10T00:00:00Z', closesAt: '2026-11-01T00:00:00Z' })).status === 400, 'closing before opening is refused');
  ok((await mk('Demo Primary End of Term Exam')).status === 400, 'a duplicate name in the same term is refused');

  console.log('\n# Preview before opening: subjects and the teachers responsible');
  const w1 = await mk(`QA admin window A ${stamp}`, { instructions: 'qa', closesAt: '2026-12-01T10:00:00Z' });
  ok(w1.status === 201 && w1.data.status === 'DRAFT' && w1.data.assessmentCount === 0, 'window is created as a DRAFT with no marks sheets yet');
  const id1 = w1.data.id;
  const pv = (await call(P.token, 'GET', `/academics/exam-windows/${id1}/preview`)).data;
  const flat = pv.classes.flatMap((c) => c.subjects.map((s) => ({ ...s, classId: c.classId, classLabel: c.label })));
  ok(pv.summary.classes === 2 && flat.length > 0 && pv.summary.marksSheets === flat.length, 'preview lists every class and subject that would get a marks sheet', JSON.stringify(pv.summary));
  ok(flat.every((s) => s.teacherName && s.state === 'INCLUDED'), 'every subject names its teacher');
  ok(pv.editable === true, 'a draft can be edited');
  const science = flat.find((s) => s.subjectName === 'Science' && s.teacherId === T.user.id);
  ok(!!science, 'found Science (taught by the demo teacher) to omit', JSON.stringify(flat.slice(0, 2)));
  const classA = pv.classes.find((c) => c.classId === science.classId);
  const classOther = pv.classes.find((c) => c.classId !== science.classId);

  console.log('\n# Omit one subject for one class (draft)');
  const bad = await call(P.token, 'POST', `/academics/exam-windows/${id1}/subjects/omit`, { subjectId: science.subjectId, classIds: [science.classId], reason: '' });
  ok(bad.status === 400, 'a reason is required');
  const om = await call(P.token, 'POST', `/academics/exam-windows/${id1}/subjects/omit`, { subjectId: science.subjectId, classIds: [science.classId], reason: 'Practical only this term' });
  ok(om.status === 201 && om.data.omitted, 'subject is omitted for that class');
  const dup = await call(P.token, 'POST', `/academics/exam-windows/${id1}/subjects/omit`, { subjectId: science.subjectId, classIds: [science.classId], reason: 'again' });
  ok(dup.status === 409, 'omitting it twice is refused');
  const pv2 = (await call(P.token, 'GET', `/academics/exam-windows/${id1}/preview`)).data;
  const sci2 = pv2.classes.find((c) => c.classId === science.classId).subjects.find((s) => s.subjectId === science.subjectId);
  const sciOther = (pv2.classes.find((c) => c.classId !== science.classId) || {subjects: []}).subjects.find((s) => s.subjectId === science.subjectId);
  ok(sci2.state === 'OMITTED' && sci2.exclusion.reason === 'Practical only this term', 'preview shows it as omitted with the reason');
  ok(!sciOther || sciOther.state === 'INCLUDED', 'the same subject in another class is untouched');
  ok(pv2.summary.omitted === 1 && pv2.summary.marksSheets === flat.length - 1, 'summary counts follow');

  console.log('\n# Opening skips omitted subjects; teachers do not see them');
  const open1 = await call(P.token, 'POST', `/academics/exam-windows/${id1}/open`);
  ok(open1.status === 201 && open1.data.assessmentsCreated === flat.length - 1 && open1.data.omitted === 1, 'open creates one fewer marks sheet', JSON.stringify(open1.body).slice(0, 200));
  const teacherView = (await call(T.token, 'GET', '/academics/exam-windows/teacher')).data.find((w) => w.id === id1);
  ok(teacherView && !teacherView.mySubjects.some((s) => s.subjectId === science.subjectId && s.classId === science.classId), 'the teacher no longer has a sheet for the omitted subject and class');
  ok(await Promise.resolve(psql(`select count(*) from academics."Assessment" where "examWindowId"='${id1}'`)) === String(flat.length - 1), 'database holds exactly the included sheets');

  console.log('\n# Omitting after marks exist needs confirmation');
  const sheet = (await call(P.token, 'GET', `/academics/exam-windows/${id1}/preview`)).data.classes.flatMap((c) => c.subjects).find((s) => s.assessmentId && s.subjectName !== 'Science');
  const tpl = (await call(P.token, 'GET', `/academics/exam-windows/assessments/${sheet.assessmentId}/template`)).data;
  const put = await call(P.token, 'POST', `/academics/exam-windows/assessments/${sheet.assessmentId}/marks/upload`, { rows: tpl.rows.slice(0, 2).map((r, i) => ({ registrationNumber: r.registrationNumber, score: 50 + i, row: i + 2 })), autoSubmit: false });
  ok(put.status === 201 || put.status === 200, 'admin can enter marks on a teacher\'s behalf');
  const cls = flat.find((s) => s.subjectId === sheet.subjectId && s.classSubjectId === sheet.classSubjectId).classId;
  const guard = await call(P.token, 'POST', `/academics/exam-windows/${id1}/subjects/omit`, { subjectId: sheet.subjectId, classIds: [cls], reason: 'Test guard' });
  ok(guard.status === 409 && /2 mark\(s\) have already been entered/.test(JSON.stringify(guard.body)), 'marks already entered block the omission until confirmed', JSON.stringify(guard.body).slice(0, 200));
  ok(psql(`select count(*) from academics."Mark" where "assessmentId"='${sheet.assessmentId}'`) === '2', 'nothing was deleted by the refused omission');
  const discard = await call(P.token, 'POST', `/academics/exam-windows/${id1}/subjects/omit`, { subjectId: sheet.subjectId, classIds: [cls], reason: 'Test guard', discardMarks: true });
  ok(discard.status === 201 && discard.data.marksDiscarded === 2 && discard.data.sheetsRemoved === 1, 'confirming discards the sheet and its marks');
  ok(psql(`select count(*) from academics."Assessment" where id='${sheet.assessmentId}'`) === '0', 'the marks sheet is gone');

  console.log('\n# Restore brings the sheet back');
  const pv3 = (await call(P.token, 'GET', `/academics/exam-windows/${id1}/preview`)).data;
  const sciRow = pv3.classes.find((c) => c.classId === science.classId).subjects.find((s) => s.subjectId === science.subjectId);
  const restored = await call(P.token, 'DELETE', `/academics/exam-windows/${id1}/subjects/omissions/${sciRow.exclusion.id}`);
  ok(restored.status === 200 && restored.data.sheetsAdded === 1, 'restoring on an open window recreates the marks sheet', JSON.stringify(restored.body).slice(0, 160));
  const pv4 = (await call(P.token, 'GET', `/academics/exam-windows/${id1}/preview`)).data;
  ok(pv4.classes.find((c) => c.classId === science.classId).subjects.find((s) => s.subjectId === science.subjectId).state === 'INCLUDED', 'preview shows it included again');

  console.log('\n# Omit a subject from every class in the window');
  const allOm = await call(P.token, 'POST', `/academics/exam-windows/${id1}/subjects/omit`, { subjectId: science.subjectId, reason: 'Not examined this term' });
  ok(allOm.status === 201 && allOm.data.classes === 'all', 'omitted for all classes');
  const pv5 = (await call(P.token, 'GET', `/academics/exam-windows/${id1}/preview`)).data;
  ok(pv5.classes.every((c) => c.subjects.filter((s) => s.subjectId === science.subjectId).every((s) => s.state === 'OMITTED')), 'every class shows it omitted');

  console.log('\n# Results follow the omission');
  const full = (await call(P.token, 'GET', `/academics/exam-windows/${id1}/preview`)).data.classes.flatMap((c) => c.subjects.map((s) => ({ ...s, classId: c.classId }))).filter((s) => s.assessmentId);
  let filled = 0;
  for (const s of full) {
    const t = (await call(P.token, 'GET', `/academics/exam-windows/assessments/${s.assessmentId}/template`)).data;
    const r = await call(P.token, 'POST', `/academics/exam-windows/assessments/${s.assessmentId}/marks/upload`, { rows: t.rows.map((x, i) => ({ registrationNumber: x.registrationNumber, score: 40 + ((i * 7) % 50), row: i + 2 })), autoSubmit: true });
    if (r.status === 201 || r.status === 200) filled += 1;
  }
  ok(filled === full.length, 'marks entered for every remaining sheet', `${filled}/${full.length}`);
  const ready = (await call(P.token, 'GET', `/academics/exam-windows/${id1}/readiness`)).data;
  ok(ready.canClose === true, 'readiness: nothing is missing, so the window can close', JSON.stringify((ready.blockers || [])[0]));
  const closed = await call(P.token, 'POST', `/academics/exam-windows/${id1}/close`);
  ok(closed.status === 201 && closed.data.closed, 'window closes and calculates');
  const merit = (await call(P.token, 'GET', `/academics/exam-windows/${id1}/merit-list`)).data;
  ok(!merit.subjects.some((s) => s.subjectId === science.subjectId), 'the merit list has no column for the omitted subject');
  ok(merit.rows.length > 0 && merit.rows.every((r) => !(science.subjectId in (r.subjectScores || {}))), 'no student carries a score for it');
  const sheetsByClass = {};
  for (const s of full) sheetsByClass[s.classId] = (sheetsByClass[s.classId] || 0) + 1;
  ok(merit.rows.every((r) => r.subjectsExpected === sheetsByClass[r.classId]), 'every student is expected to take exactly the subjects examined in their class', JSON.stringify(merit.rows.slice(0, 2).map((r) => [r.classId, r.subjectsExpected])) + JSON.stringify(sheetsByClass));
  const blocked = await call(P.token, 'POST', `/academics/exam-windows/${id1}/subjects/omit`, { subjectId: full[0].subjectId, reason: 'late change' });
  ok(blocked.status === 400 && /Reopen/.test(JSON.stringify(blocked.body)), 'a closed window cannot change its subjects without reopening');
  const archived = await call(P.token, 'POST', `/academics/exam-windows/${id1}/archive`);
  ok(archived.status === 201, 'a closed window can be archived');
  const listed = (await call(P.token, 'GET', '/academics/exam-windows')).data;
  ok(!listed.some((w) => w.id === id1), 'archived windows are hidden from the default list');

  console.log('\n# School-wide rule seeds later windows');
  const w2 = await mk(`QA admin window B ${stamp}`);
  const id2 = w2.data.id;
  const pvB = (await call(P.token, 'GET', `/academics/exam-windows/${id2}/preview`)).data;
  const biology = pvB.classes.flatMap((c) => c.subjects).find((s) => s.subjectName !== 'Science') ;
  const rule = await call(P.token, 'POST', `/academics/exam-windows/${id2}/subjects/omit`, { subjectId: biology.subjectId, reason: 'Never examined in exam windows', applyToAllWindows: true });
  ok(rule.status === 201 && rule.data.standingRule, 'omit with "every exam window" also records a school-wide rule');
  const standing = (await call(P.token, 'GET', '/academics/exam-windows/subject-rules')).data;
  ok(standing.some((r) => r.subjectId === biology.subjectId), 'school-wide rules can be listed');
  const w3 = await mk(`QA admin window C ${stamp}`);
  const id3 = w3.data.id;
  const pvC = (await call(P.token, 'GET', `/academics/exam-windows/${id3}/preview`)).data;
  const inC = pvC.classes.flatMap((c) => c.subjects).filter((s) => s.subjectId === biology.subjectId);
  ok(inC.length > 0 && inC.every((s) => s.state === 'OMITTED' && s.exclusion.source === 'STANDING'), 'a new draft window starts without that subject, marked as a school rule');
  const openC = await call(P.token, 'POST', `/academics/exam-windows/${id3}/open`);
  ok(openC.status === 201 && openC.data.omitted === inC.length, 'opening honours the school rule');
  const pvC2 = (await call(P.token, 'GET', `/academics/exam-windows/${id3}/preview`)).data;
  ok(pvC2.classes.flatMap((c) => c.subjects).filter((s) => s.subjectId === biology.subjectId).every((s) => s.exclusion && s.exclusion.source === 'WINDOW'), 'the rule becomes the window\'s own once opened');
  const ruleId = standing.find((r) => r.subjectId === biology.subjectId).id;
  ok((await call(P.token, 'DELETE', `/academics/exam-windows/subject-rules/${ruleId}`)).status === 200, 'a school-wide rule can be removed');
  const pvC3 = (await call(P.token, 'GET', `/academics/exam-windows/${id3}/preview`)).data;
  ok(pvC3.classes.flatMap((c) => c.subjects).filter((s) => s.subjectId === biology.subjectId).every((s) => s.state === 'OMITTED'), 'removing the rule does not change a window that already opened');

  console.log('\n# Editing an open window');
  const upd = await call(P.token, 'PATCH', `/academics/exam-windows/${id3}`, { maxScore: 60 });
  ok(upd.status === 200, 'max score can change while open');
  ok(psql(`select count(distinct "maxScore") from academics."Assessment" where "examWindowId"='${id3}'`) === '1' && psql(`select max("maxScore") from academics."Assessment" where "examWindowId"='${id3}'`) === '60', 'the new maximum reaches every marks sheet');
  const scope = await call(P.token, 'PATCH', `/academics/exam-windows/${id3}`, { scopeLevels: [3] });
  ok(scope.status === 400, 'scope cannot change once teachers have sheets');
  const tooLate = await call(P.token, 'POST', `/academics/exam-windows/${id2}/archive`);
  ok(tooLate.status === 201, 'a draft can be archived');
  ok((await call(T.token, 'GET', `/academics/exam-windows/${id3}`)).status === 403, 'teachers cannot read the admin window detail');

  // ── cleanup ──
  for (const id of created) psql(`delete from academics."ExamWindow" where id='${id}'`);
  psql(`delete from academics."ExamSubjectExclusion" where "examWindowId" is null and reason in ('Never examined in exam windows')`);
  psql(`delete from academics."AcademicAuditLog" where action like 'EXAM_SUBJECT_%' and payload::text like '%Never examined%'`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('ERROR', e.message);
  for (const id of created) { try { psql(`delete from academics."ExamWindow" where id='${id}'`); } catch { /* best effort */ } }
  process.exit(1);
});
