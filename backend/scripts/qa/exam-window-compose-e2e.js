/**
 * Does a subject left out of ONE exam window flow correctly into the term report card?
 *
 * Two windows are composed 40% / 60%. Social Studies is left out of the first, so its report-card mark must be
 * the second window's alone (weights renormalised), while every other subject is the 40/60 blend.
 *
 * COMPOSING WRITES TERM RESULTS AND REPORT CARDS, so run this against the isolated QA stack only:
 *   API_BASE=http://localhost:3910/api/v1 PGDATABASE=kilimanjaro_qa node backend/scripts/qa/exam-window-compose-e2e.js
 * The class's existing rows for the term are backed up first and restored at the end.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { login, call: rawCall } = require('./results-e2e-api.js');

if (!/3910/.test(process.env.API_BASE || '')) {
  console.error('Refusing to run: point API_BASE at the QA gateway (…:3910/api/v1). Composing overwrites report cards.');
  process.exit(2);
}
const DB = process.env.PGDATABASE || 'kilimanjaro_qa';
const run = (cmd, input) => execSync(cmd, { input, env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD || 'Mtunzi123' } }).toString().replace(/\r/g, '').trim();
const psql = (q) => run(`psql -h localhost -U postgres -d ${DB} -tA`, q);
const PRI = '00000000-0000-4000-8000-000000000002';
const call = (t, m, p, b) => rawCall(t, m, p, b, { 'X-Active-School': PRI });
let pass = 0;
let fail = 0;
const ok = (c, label, extra = '') => { if (c) { pass += 1; console.log('  ok   ', label); } else { fail += 1; console.log('  FAIL ', label, extra); } };

(async () => {
  const P = await login('principal@demo.kilimanjaro.test', 'Principal@Kili2026');
  const years = (await call(P.token, 'GET', '/students/academic-years')).data;
  const terms = (await call(P.token, 'GET', '/students/terms')).data;
  const types = (await call(P.token, 'GET', '/academics/exam-types')).data;
  const classes = (await call(P.token, 'GET', '/students/classes?limit=500')).data;
  const rows = Array.isArray(classes) ? classes : classes.items || classes.classes;
  const year = years.find((y) => y.name === '2026 Academic Year') || years[0];
  const term = terms.find((t) => t.academicYearId === year.id && t.name === 'Term 2');
  const klass = rows.find((c) => c.name === 'Standard 7' && c.schoolId === PRI);
  const type = (types.items || types)[0];
  const stamp = Date.now().toString().slice(-5);
  const tmp = path.join(os.tmpdir(), `compose-e2e-${stamp}`);
  fs.mkdirSync(tmp, { recursive: true });

  // ── back up the class's existing term rows, restored in finally ──
  const backup = (table) => run(`psql -h localhost -U postgres -d ${DB} -c "\\copy (select * from academics.\\"${table}\\" where \\"classId\\"='${klass.id}' and \\"termId\\"='${term.id}') to '${path.join(tmp, table + '.csv').replace(/\\/g, '/')}' csv"`);
  backup('TermResult');
  backup('ReportCard');
  // Seeded cards are published, and composing refuses to overwrite published cards: withdraw them for the test.
  psql(`update academics."ReportCard" set "isPublished"=false where "classId"='${klass.id}' and "termId"='${term.id}'`);
  psql(`update academics."TermResult" set "isPublished"=false where "classId"='${klass.id}' and "termId"='${term.id}'`);
  const windowIds = [];
  try {
    const mk = async (name) => {
      const r = await call(P.token, 'POST', '/academics/exam-windows', { examTypeId: type.id, name, academicYearId: year.id, termId: term.id, scopeType: 'STREAMS', scopeClassIds: [klass.id], countsToReportCard: true });
      if (!r.data || !r.data.id) throw new Error('window create failed ' + JSON.stringify(r.body));
      windowIds.push(r.data.id);
      return r.data.id;
    };
    const w1 = await mk(`QA compose A ${stamp}`);
    const w2 = await mk(`QA compose B ${stamp}`);

    console.log('\n# One subject is left out of the first window only');
    const pv = (await call(P.token, 'GET', `/academics/exam-windows/${w1}/preview`)).data;
    const social = pv.classes[0].subjects.find((s) => /Social/.test(s.subjectName));
    ok(!!social, 'found Social Studies in the class');
    ok((await call(P.token, 'POST', `/academics/exam-windows/${w1}/subjects/omit`, { subjectId: social.subjectId, classIds: [klass.id], reason: 'Practical in window A' })).status === 201, 'Social Studies omitted from window A');
    for (const w of [w1, w2]) ok((await call(P.token, 'POST', `/academics/exam-windows/${w}/open`)).status === 201, 'window opened');

    const score = (wi, studentIdx, subjectName) => 35 + ((studentIdx * 7 + subjectName.length * 5 + wi * 13) % 60);
    const subjects = new Set();
    for (const [wi, w] of [w1, w2].entries()) {
      const plan = (await call(P.token, 'GET', `/academics/exam-windows/${w}/preview`)).data.classes[0].subjects.filter((s) => s.assessmentId);
      for (const s of plan) {
        subjects.add(s.subjectName);
        const t = (await call(P.token, 'GET', `/academics/exam-windows/assessments/${s.assessmentId}/template`)).data;
        const up = await call(P.token, 'POST', `/academics/exam-windows/assessments/${s.assessmentId}/marks/upload`, { rows: t.rows.map((r, i) => ({ registrationNumber: r.registrationNumber, score: score(wi, i, s.subjectName), row: i + 2 })), autoSubmit: true });
        if (up.status !== 201 && up.status !== 200) throw new Error('upload failed ' + JSON.stringify(up.body).slice(0, 200));
      }
    }
    for (const w of [w1, w2]) {
      const c = await call(P.token, 'POST', `/academics/exam-windows/${w}/close`);
      ok(c.status === 201, 'window closed', JSON.stringify(c.body).slice(0, 160));
    }

    console.log('\n# Composing the term report card');
    const composed = await call(P.token, 'POST', '/academics/report-card-compositions', {
      academicYearId: year.id, termId: term.id, scopeLevel: 7, publish: false,
      windows: [{ examWindowId: w1, weight: 40 }, { examWindowId: w2, weight: 60 }],
    });
    ok(composed.status === 201, 'report cards composed', JSON.stringify(composed.body).slice(0, 200));

    const tpl = (await call(P.token, 'GET', `/academics/exam-windows/assessments/${(await call(P.token, 'GET', `/academics/exam-windows/${w2}/preview`)).data.classes[0].subjects[0].assessmentId}/template`)).data;
    const regs = tpl.rows.slice(0, 4);
    for (const [idx, r] of regs.entries()) {
      const lines = psql(`select tr."subjectName"||'|'||tr."weightedTotal" from academics."TermResult" tr join students."Student" st on st.id=tr."studentId" where st."registrationNumber"='${r.registrationNumber}' and tr."termId"='${term.id}'`).split('\n').filter(Boolean);
      const map = Object.fromEntries(lines.map((l) => l.split('|')).map(([n, v]) => [n, Number(v)]));
      let allOk = true; let detail = '';
      for (const name of subjects) {
        const expected = /Social/.test(name) ? score(1, idx, name) : 0.4 * score(0, idx, name) + 0.6 * score(1, idx, name);
        if (Math.abs((map[name] ?? -999) - expected) > 0.06) { allOk = false; detail += ` ${name}: got ${map[name]} want ${expected.toFixed(2)};`; }
      }
      ok(allOk, `${r.registrationNumber}: every subject is the 40/60 blend, Social Studies is window B alone`, detail);
    }
  } finally {
    // ── restore the class's report-card state and remove the test windows ──
    for (const id of windowIds) { try { psql(`delete from academics."ExamWindow" where id='${id}'`); } catch { /* best effort */ } }
    psql(`delete from academics."TermResult" where "classId"='${klass.id}' and "termId"='${term.id}'`);
    psql(`delete from academics."ReportCard" where "classId"='${klass.id}' and "termId"='${term.id}'`);
    for (const table of ['TermResult', 'ReportCard']) {
      const f = path.join(tmp, table + '.csv').replace(/\\/g, '/');
      if (fs.existsSync(f) && fs.statSync(f).size > 0) run(`psql -h localhost -U postgres -d ${DB} -c "\\copy academics.\\"${table}\\" from '${f}' csv"`);
    }
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERROR', e.message); process.exit(1); });
