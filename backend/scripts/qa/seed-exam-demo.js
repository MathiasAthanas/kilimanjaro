/* eslint-disable no-console */
// Fills a demo database with a realistic exam history so every results screen has something to show:
//   * Monthly Test + Midterm Exam per stage group, closed, with absent / not-sat / exempt cases
//   * term report cards composed (Primary + A-Level published, O-Level left provisional)
//   * an "End of Term Exam" left OPEN with some subjects missing (teacher + admin progress views)
//   * a teacher's pending edit request on a published window
// Run against the isolated QA stack:  API_BASE=http://localhost:3910/api/v1 PGDATABASE=kilimanjaro_qa node seed-exam-demo.js
const { login, call } = require('./results-e2e-api.js');
const { execSync } = require('child_process');

const DB = process.env.PGDATABASE || 'kilimanjaro_qa';
const sql = (q) =>
  execSync(`psql -h localhost -U postgres -d ${DB} -tA -F "|" -v ON_ERROR_STOP=1`, { input: q, env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD || 'Mtunzi123' } })
    .toString().replace(/\r/g, '').trim();

const YEAR = process.env.YEAR_ID || '71a7faf9-72b9-44ca-9a47-aa64db0feba5';
const TERM = process.env.TERM_ID || 'da0e69ef-1632-40fc-adfb-f9a8fa17c12c';
const PRIMARY_SCHOOL = process.env.PRIMARY_SCHOOL || '00000000-0000-4000-8000-000000000002';
const SECONDARY_SCHOOL = process.env.SECONDARY_SCHOOL || '00000000-0000-4000-8000-000000000003';

// tiny deterministic PRNG so the demo data is the same on every run
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const hash = (str) => [...str].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

(async () => {
  const P = await login('principal@demo.kilimanjaro.test', 'Principal@Kili2026');
  const as = (school) => (m, p, b) => call(P.token, m, p, b, { 'X-Active-School': school });

  const groups = [
    { name: 'Primary', school: PRIMARY_SCHOOL, stage: 'PRIMARY', levels: [1, 2, 3, 4, 5, 6, 7], publishCards: true, endTerm: true },
    { name: 'O-Level', school: SECONDARY_SCHOOL, stage: 'O_LEVEL', levels: [1, 2, 3, 4], publishCards: false, endTerm: true },
    { name: 'A-Level', school: SECONDARY_SCHOOL, stage: 'A_LEVEL', levels: [5, 6], publishCards: true, endTerm: false },
  ];

  console.log('-- removing earlier demo exam data');
  sql(`
    DELETE FROM academics."ResultCalculationExemption" WHERE reason LIKE 'DEMO:%';
    DELETE FROM academics."ExamWindow" WHERE name LIKE 'Demo %';
    DELETE FROM academics."ExamType" WHERE code LIKE 'DEMO-%';
    DELETE FROM academics."ReportCardComposition" WHERE name LIKE 'Demo %';
  `);

  for (const g of groups) {
    console.log(`\n== ${g.name}`);
    const api = as(g.school);
    const mkType = async (code, name, weight) => (await api('POST', '/academics/exam-types', { name: `${name}`, code: `DEMO-${g.stage}-${code}`, defaultWeight: weight, educationStage: g.stage })).data.id;
    const monthlyType = await mkType('MON', 'Monthly Test', 30);
    const midType = await mkType('MID', 'Midterm Exam', 70);
    const endType = await mkType('END', 'End of Term Exam', 100);

    const mkWindow = async (name, typeId, maxScore, weight, extra = {}) => {
      const r = await api('POST', '/academics/exam-windows', {
        examTypeId: typeId, name, academicYearId: YEAR, termId: TERM, educationStage: g.stage, scopeType: 'STANDARDS', scopeLevels: g.levels,
        maxScore, weight, openNow: true, ...extra,
      });
      if (r.status >= 300) throw new Error(`window ${name}: ${JSON.stringify(r.body)}`);
      return r.data;
    };

    const monthly = await mkWindow(`Demo ${g.name} Monthly Test`, monthlyType, 50, 30, { instructions: 'Marks out of 50.' });
    const mid = await mkWindow(`Demo ${g.name} Midterm Exam`, midType, 100, 70, { instructions: 'Marks out of 100.' });
    console.log('windows opened', monthly.assessmentCount, 'subject sheets each');

    // exemptions first, so they are not asked for marks
    const classIds = [...new Set(sql(`SELECT DISTINCT "classId" FROM academics."Assessment" WHERE "examWindowId"='${mid.id}'`).split('\n').filter(Boolean))];
    // published seed/previous report cards block exemptions: withdraw them first, composition publishes again
    for (const cid of classIds) await api('POST', '/academics/results/unpublish', { classId: cid, termId: TERM });
    const rosterCache = {};
    const rosterOf = async (cid) => (rosterCache[cid] ??= ((await api('GET', `/students?classId=${cid}&limit=200`)).data.items || []).sort((a, b) => a.registrationNumber.localeCompare(b.registrationNumber)));
    for (const cid of classIds) {
      const roster = await rosterOf(cid);
      if (roster.length < 8) continue;
      const lastSubject = sql(`SELECT "subjectId" FROM academics."Assessment" WHERE "examWindowId"='${mid.id}' AND "classId"='${cid}' ORDER BY "subjectId" DESC LIMIT 1`);
      if (classIds.indexOf(cid) % 2 === 0) {
        const ex = await api('POST', '/academics/result-exemptions', { academicYearId: YEAR, termId: TERM, classId: cid, subjectId: lastSubject, scope: 'STUDENT', studentIds: [roster[7].id], reason: 'DEMO: medical exemption approved by the head teacher' });
        if (ex.status >= 300) console.log('exemption skipped:', JSON.stringify(ex.body).slice(0, 160));
      }
    }

    // fill every window from its readiness matrix (only expected, still-missing cells)
    const fill = async (win, max, density = 1, seedSalt = 0) => {
      const rd = (await api('GET', `/academics/exam-windows/${win.id}/readiness`)).data;
      const subjects = rd.subjects;
      const ass = sql(`SELECT a.id, a."classId", a."subjectId", a."classSubjectId", cs."teacherId" FROM academics."Assessment" a JOIN academics."ClassSubject" cs ON cs.id=a."classSubjectId" WHERE a."examWindowId"='${win.id}'`)
        .split('\n').filter(Boolean).map((l) => l.split('|'));
      const byKey = new Map(ass.map(([id, classId, subjectId, csId, teacher]) => [`${classId}:${subjectId}`, { id, csId, teacher }]));
      const vals = [];
      const skipSubject = new Set(); // subjects left empty for the "in progress" window
      subjects.forEach((s, i) => { if (density < 1 && i % 2 === 1) skipSubject.add(s.subjectId); });
      for (const cls of rd.classes) {
        const rand = rng(hash(cls.classId) + seedSalt);
        cls.students.forEach((st, si) => {
          const ability = 38 + Math.floor(hash(st.studentId) % 52); // 38..89, steady per student across windows
          for (const [sid, cell] of Object.entries(st.cells)) {
            if (cell.status !== 'MISSING') continue;
            if (skipSubject.has(sid)) continue;
            const a = byKey.get(`${cls.classId}:${sid}`);
            if (!a) continue;
            const pct = Math.max(8, Math.min(98, ability + Math.round((rand() - 0.5) * 24)));
            vals.push(`(gen_random_uuid(),'${a.id}','${a.csId}','${st.studentId}',${Math.round((pct / 100) * max * 10) / 10},'${a.teacher}',(now() at time zone 'utc'))`);
          }
        });
      }
      if (vals.length) sql(`INSERT INTO academics."Mark"(id,"assessmentId","classSubjectId","studentId",score,"enteredById","enteredAt") VALUES ${vals.join(',')} ON CONFLICT DO NOTHING;`);
      return vals.length;
    };
    console.log('marks Monthly', await fill(monthly, 50, 1, 1), ' Midterm', await fill(mid, 100, 1, 2));

    // a few absent / not-sat cases per class
    for (const cid of classIds) {
      const roster = await rosterOf(cid);
      if (roster.length < 6) continue;
      const oneAss = (win, n) => sql(`SELECT id FROM academics."Assessment" WHERE "examWindowId"='${win.id}' AND "classId"='${cid}' ORDER BY "subjectId" LIMIT 1 OFFSET ${n}`);
      const a1 = oneAss(monthly, 0), a2 = oneAss(mid, 1);
      if (a1) sql(`UPDATE academics."Mark" SET score=0, "isAbsent"=true WHERE "assessmentId"='${a1}' AND "studentId"='${roster[3].id}'`);
      if (a2) sql(`UPDATE academics."Mark" SET score=0, "isAbsent"=true, "notSat"=true WHERE "assessmentId"='${a2}' AND "studentId"='${roster[5].id}'`);
    }

    for (const w of [monthly, mid]) {
      const r = await api('POST', `/academics/exam-windows/${w.id}/close`);
      if (r.status >= 300) throw new Error(`close ${w.name}: ${JSON.stringify(r.body).slice(0, 400)}`);
      console.log('closed', w.name, `${r.data.computed} students, ${r.data.exemptSubjects} exempt, ${r.data.ungraded} ungraded`);
    }

    // withdraw seeded term results for these classes, then compose real report cards from the two windows
    for (const cid of classIds) await api('POST', '/academics/results/unpublish', { classId: cid, termId: TERM });
    // one class at a time keeps each request short (every report card also builds a PDF)
    let cards = 0;
    for (const cid of classIds) {
      const comp = await api('POST', '/academics/report-card-compositions', {
        name: `Demo ${g.name} term report cards`, academicYearId: YEAR, termId: TERM, publish: g.publishCards, scopeClassIds: [cid],
        windows: [{ examWindowId: monthly.id, weight: 30 }, { examWindowId: mid.id, weight: 70 }],
      });
      if (comp.status >= 300) throw new Error(`compose ${g.name}: ${JSON.stringify(comp.body).slice(0, 400)}`);
      cards += comp.data.reportCardsGenerated;
    }
    console.log('report cards', cards, g.publishCards ? '(published)' : '(provisional)');

    if (g.publishCards) {
      for (const w of [monthly, mid]) await api('POST', `/academics/exam-windows/${w.id}/publish`);
    } else {
      await api('POST', `/academics/exam-windows/${monthly.id}/publish`);
    }

    // an end-of-term window left OPEN, half filled
    if (g.endTerm) {
      const end = await mkWindow(`Demo ${g.name} End of Term Exam`, endType, 100, 100, {
        closesAt: new Date(Date.now() + 5 * 86400000).toISOString(),
        instructions: 'Enter marks for your subjects by the deadline. Mark absent students "Absent" and students who did not sit "Not sat".',
      });
      const n = await fill(end, 100, 0.5, 3);
      console.log('open window', end.name, 'with', n, 'marks entered (rest pending)');
    }

    // a teacher asks permission to correct a published subject
    if (g.publishCards) {
      const a = sql(`SELECT a.id, u.email FROM academics."Assessment" a JOIN academics."ClassSubject" cs ON cs.id=a."classSubjectId" JOIN auth.users u ON u.id=cs."teacherId" WHERE a."examWindowId"='${mid.id}' AND u.email='t-maths-b@demo.kilimanjaro.test' LIMIT 1`);
      if (a) {
        const [aid, email] = a.split('|');
        try {
          const T = await login(email, 'Teacher@Kili2026');
          const r = await call(T.token, 'POST', '/academics/exam-windows/edit-requests', { examWindowId: mid.id, assessmentId: aid, reason: 'DEMO: entered 54 instead of 45 for one student, please unlock so I can correct it' }, { 'X-Active-School': g.school });
          console.log('edit request', r.status < 300 ? 'created' : JSON.stringify(r.body).slice(0, 150));
        } catch (e) { console.log('edit request skipped:', e.message.slice(0, 80)); }
      }
    }
  }
  console.log('\nDemo exam data ready.');
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
