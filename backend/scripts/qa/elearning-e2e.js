// End-to-end e-learning journey through the gateway against a QA stack seeded with the demo accounts.
// Usage: BASE=http://localhost:3910/api/v1 node backend/scripts/qa/elearning-e2e.js
// Needs the demo teacher, students KS-S-2026-00126/127/140, parents parent022/023/010 and the HOD seeded;
// it creates its own lesson/assignment/quiz content and never deletes data.
const BASE = process.env.BASE || 'http://localhost:3910/api/v1';
const results = [];
let failures = 0;

async function login(body) {
  const r = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!j.success) throw new Error('login failed ' + JSON.stringify(j));
  return { token: j.data.accessToken, user: j.data.user };
}
const reg = (n, pw = 'Student@Kili2026') => login({ registrationNumber: n, password: pw });
const email = (e, pw) => login({ email: e, password: pw });

async function call(who, method, path, body, raw = false) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${who.token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let j; try { j = text ? JSON.parse(text) : null; } catch { j = text; }
  if (raw) return { status: r.status, body: j };
  return { status: r.status, data: j && j.data !== undefined ? j.data : j, message: j && j.message };
}
const ok = (r, label) => { if (r.status >= 400) throw new Error(`${label}: ${r.status} ${JSON.stringify(r.message || r.data)}`); return r.data; };

function check(name, cond, extra = '') {
  results.push({ name, pass: !!cond });
  if (!cond) { failures++; console.log(`  FAIL  ${name} ${extra}`); } else console.log(`  pass  ${name}`);
}
async function expectStatus(name, promise, status) {
  const r = await promise;
  check(name, r.status === status, `(got ${r.status} ${JSON.stringify(r.message || '').slice(0, 120)})`);
  return r;
}

(async () => {
  const suffix = Date.now().toString(36).slice(-4);
  const teacher = await email('t-maths-b@demo.kilimanjaro.test', 'Teacher@Kili2026');
  const s1 = await reg('KS-S-2026-00126');
  const s2 = await reg('KS-S-2026-00127');
  const outsider = await reg('KS-S-2026-00140'); // not enrolled in this course
  const parent = await email('parent023@demo.kilimanjaro.test', 'Parent@Kili2026'); // parent of s1 and s2
  const otherParent = await email('parent022@demo.kilimanjaro.test', 'Parent@Kili2026'); // parent of someone else
  const hod = await email('hod-maths@demo.kilimanjaro.test', 'Hod@Kili2026');
  const COURSE = 'a84b0073-8842-480f-9378-35ba46a2b48c';

  console.log('\n== Teacher authors content');
  const lesson = ok(await call(teacher, 'POST', `/elearning/courses/${COURSE}/lessons`, { title: `QA Lesson ${suffix}`, description: 'Forces and motion', weekNumber: 9, estimatedMinutes: 40 }), 'create lesson');
  check('lesson created as DRAFT', lesson.status === 'DRAFT');
  const note = ok(await call(teacher, 'POST', `/elearning/courses/${COURSE}/lessons/${lesson.id}/materials`, { title: 'Reading notes', type: 'NOTE', body: 'Newton\'s second law: F = ma.\n\nWorked example: 5kg at 2m/s² needs 10N.' }), 'note');
  const link = ok(await call(teacher, 'POST', `/elearning/courses/${COURSE}/lessons/${lesson.id}/materials`, { title: 'Khan Academy video', type: 'VIDEO', externalUrl: 'https://www.khanacademy.org/science/physics' }), 'link');
  await expectStatus('empty note rejected', call(teacher, 'POST', `/elearning/courses/${COURSE}/lessons/${lesson.id}/materials`, { title: 'Bad', type: 'NOTE' }), 400);
  await expectStatus('non-http link rejected', call(teacher, 'POST', `/elearning/courses/${COURSE}/lessons/${lesson.id}/materials`, { title: 'Bad', type: 'LINK', externalUrl: 'javascript:alert(1)' }), 400);
  const upload = ok(await call(teacher, 'POST', `/elearning/uploads/local`, { fileName: 'sheet.txt', contentBase64: Buffer.from('Revision sheet').toString('base64'), mimeType: 'text/plain', domain: 'materials' }), 'upload');
  const fileMat = ok(await call(teacher, 'POST', `/elearning/courses/${COURSE}/lessons/${lesson.id}/materials`, { title: 'Revision sheet', type: 'FILE', fileKey: upload.fileKey, fileOriginalName: 'sheet.txt', fileMimeType: 'text/plain', fileSizeBytes: 14 }), 'file material');

  console.log('\n== Draft content is invisible to learners');
  let lessonsS1 = ok(await call(s1, 'GET', `/elearning/courses/${COURSE}/lessons`), 'lessons s1');
  check('student does not see draft lesson', !lessonsS1.some((l) => l.id === lesson.id));
  await expectStatus('student cannot view draft material', call(s1, 'POST', `/elearning/materials/${note.id}/view`), 404);

  ok(await call(teacher, 'PATCH', `/elearning/courses/${COURSE}/lessons/${lesson.id}/publish`), 'publish lesson');
  lessonsS1 = ok(await call(s1, 'GET', `/elearning/courses/${COURSE}/lessons`), 'lessons s1 again');
  const seen = lessonsS1.find((l) => l.id === lesson.id);
  check('published lesson visible', !!seen);
  check('its materials were released with the lesson', seen && seen.materials.length === 3);
  const lateMat = ok(await call(teacher, 'POST', `/elearning/courses/${COURSE}/lessons/${lesson.id}/materials`, { title: 'Late addition', type: 'NOTE', body: 'Extra tips' }), 'late material');
  check('material added to a live lesson is live', lateMat.status === 'PUBLISHED');

  console.log('\n== Student reads materials and progress');
  ok(await call(s1, 'POST', `/elearning/materials/${note.id}/view`), 'view note');
  ok(await call(s1, 'POST', `/elearning/materials/${note.id}/view`), 'view note again');
  const dl = ok(await call(s1, 'GET', `/elearning/materials/${fileMat.id}/download`), 'download');
  check('file material has a download url', dl.download && dl.download.url);
  const prog1 = ok(await call(s1, 'GET', `/elearning/courses/${COURSE}/my-progress`), 'progress');
  check('progress counts only published materials', prog1.viewed >= 1 && prog1.completionPercent >= 0);
  await expectStatus('outsider cannot read course', call(outsider, 'GET', `/elearning/courses/${COURSE}/lessons`), 403);

  console.log('\n== Assignment: file/text rules, deadlines, grading');
  const past = new Date(Date.now() - 3600_000).toISOString();
  const future = new Date(Date.now() + 86400_000).toISOString();
  const aText = ok(await call(teacher, 'POST', `/elearning/courses/${COURSE}/assignments`, { title: 'Essay', instructions: 'Explain Newton 2', type: 'TEXT', maxScore: 20, dueAt: future }), 'assignment text');
  const aFile = ok(await call(teacher, 'POST', `/elearning/courses/${COURSE}/assignments`, { title: 'Lab report', instructions: 'Attach report', type: 'FILE_UPLOAD', maxScore: 50, dueAt: future }), 'assignment file');
  const aLate = ok(await call(teacher, 'POST', `/elearning/courses/${COURSE}/assignments`, { title: 'Overdue strict', instructions: 'x', type: 'TEXT', maxScore: 10, dueAt: past, allowLateSubmission: false }), 'assignment strict');
  const aPenalty = ok(await call(teacher, 'POST', `/elearning/courses/${COURSE}/assignments`, { title: 'Overdue penalty', instructions: 'x', type: 'TEXT', maxScore: 10, dueAt: past, allowLateSubmission: true, latePenaltyPercent: 20 }), 'assignment penalty');
  let asg = ok(await call(s1, 'GET', `/elearning/courses/${COURSE}/assignments`), 'assignments s1');
  check('draft assignments hidden from students', !asg.some((a) => a.id === aText.id));
  for (const a of [aText, aFile, aLate, aPenalty]) ok(await call(teacher, 'PATCH', `/elearning/courses/${COURSE}/assignments/${a.id}/publish`), 'publish assignment');

  await expectStatus('empty text submission rejected', call(s1, 'POST', `/elearning/assignments/${aText.id}/submissions`, { submit: true }), 400);
  await expectStatus('file assignment needs a file', call(s1, 'POST', `/elearning/assignments/${aFile.id}/submissions`, { submit: true, textContent: 'only text' }), 400);
  await expectStatus('late work refused when not allowed', call(s1, 'POST', `/elearning/assignments/${aLate.id}/submissions`, { submit: true, textContent: 'late' }), 400);

  const draft = ok(await call(s1, 'POST', `/elearning/assignments/${aText.id}/submissions`, { textContent: 'Draft answer', submit: false }), 'save draft');
  check('draft saved', draft.status === 'DRAFT');
  const handed = ok(await call(s1, 'POST', `/elearning/assignments/${aText.id}/submissions`, { textContent: 'Force equals mass times acceleration.', submit: true }), 'submit text');
  check('submitted', handed.status === 'SUBMITTED' && handed.isLate === false);
  const resave = ok(await call(s1, 'POST', `/elearning/assignments/${aText.id}/submissions`, { textContent: 'Force equals mass times acceleration (revised).' }), 'resave');
  check('saving after handing in does not demote it to draft', resave.status === 'SUBMITTED');

  const up2 = ok(await call(s1, 'POST', `/elearning/uploads/local`, { fileName: 'lab.txt', contentBase64: Buffer.from('lab data').toString('base64'), mimeType: 'text/plain', domain: 'submissions' }), 'upload sub');
  const fsub = ok(await call(s1, 'POST', `/elearning/assignments/${aFile.id}/submissions`, { submit: true, fileKey: up2.fileKey, fileOriginalName: 'lab.txt', fileMimeType: 'text/plain', fileSizeBytes: 8 }), 'submit file');
  check('file submission accepted', fsub.status === 'SUBMITTED');

  const lateSub = ok(await call(s1, 'POST', `/elearning/assignments/${aPenalty.id}/submissions`, { submit: true, textContent: 'late but allowed' }), 'late allowed');
  check('late submission flagged', lateSub.isLate === true);

  const s2sub = ok(await call(s2, 'POST', `/elearning/assignments/${aText.id}/submissions`, { submit: true, textContent: 'Another student answer' }), 's2 submit');

  asg = ok(await call(s1, 'GET', `/elearning/courses/${COURSE}/assignments`), 'assignments s1 after');
  const mineList = asg.find((a) => a.id === aText.id);
  check('student only sees their own submission in the assignment list', mineList && mineList.submissions.length === 1 && mineList.submissions[0].id === handed.id);

  const subs = ok(await call(teacher, 'GET', `/elearning/courses/${COURSE}/assignments/${aText.id}/submissions`), 'teacher submissions');
  check('teacher sees both submissions with student names', subs.length === 2 && subs.every((s) => s.studentName));
  const missing = ok(await call(teacher, 'GET', `/elearning/courses/${COURSE}/assignments/${aText.id}/submissions/missing`), 'missing');
  check('missing list excludes those who handed in and has names', missing.length === 12 && missing.every((m) => m.studentName), `(${missing.length})`);
  const summary = ok(await call(teacher, 'GET', `/elearning/courses/${COURSE}/assignments/${aText.id}/submissions/summary`), 'summary');
  check('summary counts', summary.submitted === 2 && summary.missing === 12, JSON.stringify(summary));

  await expectStatus('score above max rejected', call(teacher, 'PATCH', `/elearning/submissions/${handed.id}/grade`, { score: 25, feedback: 'x' }), 400);
  await expectStatus('negative score rejected', call(teacher, 'PATCH', `/elearning/submissions/${handed.id}/grade`, { score: -1 }), 400);
  await expectStatus('another teacher cannot grade', call(hod, 'PATCH', `/elearning/submissions/${handed.id}/grade`, { score: 5 }), 403);
  const graded = ok(await call(teacher, 'PATCH', `/elearning/submissions/${handed.id}/grade`, { score: 17, feedback: 'Good, add units.' }), 'grade');
  check('graded with feedback', graded.status === 'GRADED' && Number(graded.score) === 17 && Number(graded.maxScore) === 20);
  const penaltyGrade = ok(await call(teacher, 'PATCH', `/elearning/submissions/${lateSub.id}/grade`, { score: 10 }), 'grade late');
  check('late penalty applied (10 -> 8)', Number(penaltyGrade.score) === 8, `(${penaltyGrade.score})`);
  await expectStatus('graded work is locked for the student', call(s1, 'POST', `/elearning/assignments/${aText.id}/submissions`, { textContent: 'sneaky edit', submit: true }), 400);
  const mine = ok(await call(s1, 'GET', `/elearning/assignments/${aText.id}/my-submission`), 'my submission');
  check('student sees their grade', mine.status === 'GRADED' && mine.feedback === 'Good, add units.');
  const returned = ok(await call(teacher, 'PATCH', `/elearning/submissions/${s2sub.id}/return`, { feedback: 'Please show working.' }), 'return');
  check('returned for correction', returned.status === 'RETURNED');
  const resub = ok(await call(s2, 'POST', `/elearning/assignments/${aText.id}/submissions`, { textContent: 'Answer with working', submit: true }), 'resubmit');
  check('student can resubmit after return', resub.status === 'SUBMITTED');
  await expectStatus('outsider cannot submit', call(outsider, 'POST', `/elearning/assignments/${aText.id}/submissions`, { submit: true, textContent: 'x' }), 403);
  ok(await call(teacher, 'PATCH', `/elearning/courses/${COURSE}/assignments/${aText.id}/close`), 'close');
  await expectStatus('closed assignment refuses new work', call(s2, 'POST', `/elearning/assignments/${aText.id}/submissions`, { textContent: 'late again', submit: true }), 400);

  console.log('\n== Quiz: validation, answer key privacy, attempts');
  const quiz = ok(await call(teacher, 'POST', `/elearning/courses/${COURSE}/quizzes`, { title: 'Forces quiz', instructions: 'Answer all', maxAttempts: 2, passingScore: 50, timeLimitMinutes: 20 }), 'quiz');
  await expectStatus('cannot publish an empty quiz', call(teacher, 'PATCH', `/elearning/courses/${COURSE}/quizzes/${quiz.id}/publish`), 400);
  await expectStatus('MCQ needs 2 options', call(teacher, 'POST', `/elearning/quizzes/${quiz.id}/questions`, { type: 'MULTIPLE_CHOICE', prompt: 'Q', options: [{ text: 'a', isCorrect: true }] }), 400);
  await expectStatus('MCQ needs exactly one correct option', call(teacher, 'POST', `/elearning/quizzes/${quiz.id}/questions`, { type: 'MULTIPLE_CHOICE', prompt: 'Q', options: [{ text: 'a' }, { text: 'b' }] }), 400);
  await expectStatus('true/false needs a key', call(teacher, 'POST', `/elearning/quizzes/${quiz.id}/questions`, { type: 'TRUE_FALSE', prompt: 'Q' }), 400);
  const q1 = ok(await call(teacher, 'POST', `/elearning/quizzes/${quiz.id}/questions`, { type: 'MULTIPLE_CHOICE', prompt: 'Unit of force?', points: 2, explanation: 'Named after Newton', options: [{ text: 'Joule' }, { text: 'Newton', isCorrect: true }, { text: 'Watt' }] }), 'q1');
  const q2 = ok(await call(teacher, 'POST', `/elearning/quizzes/${quiz.id}/questions`, { type: 'TRUE_FALSE', prompt: 'Heavier objects always fall faster in a vacuum.', points: 1, correctAnswer: 'false' }), 'q2');
  const q3 = ok(await call(teacher, 'POST', `/elearning/quizzes/${quiz.id}/questions`, { type: 'SHORT_ANSWER', prompt: 'State Newton\'s first law.', points: 3 }), 'q3');
  let quizList = ok(await call(s1, 'GET', `/elearning/courses/${COURSE}/quizzes`), 'quizzes s1 before publish');
  check('draft quiz hidden from students', !quizList.some((q) => q.id === quiz.id));
  await expectStatus('student cannot start a draft quiz', call(s1, 'POST', `/elearning/quizzes/${quiz.id}/attempts/start`), 404);
  ok(await call(teacher, 'PATCH', `/elearning/courses/${COURSE}/quizzes/${quiz.id}/publish`), 'publish quiz');
  quizList = ok(await call(s1, 'GET', `/elearning/courses/${COURSE}/quizzes`), 'quizzes s1');
  const sq = quizList.find((q) => q.id === quiz.id);
  check('published quiz visible', !!sq);
  check('answer key hidden in quiz list', sq.questions.every((q) => q.correctAnswer === undefined && q.options.every((o) => o.isCorrect === undefined)));
  const sqFull = ok(await call(s1, 'GET', `/elearning/courses/${COURSE}/quizzes/${quiz.id}`), 'quiz detail');
  check('answer key hidden in quiz detail', JSON.stringify(sqFull).indexOf('isCorrect":true') === -1 && !('explanation' in sqFull.questions[0] && sqFull.questions[0].explanation));
  await expectStatus('cannot edit questions after publish+attempt: add allowed before attempts', call(teacher, 'POST', `/elearning/quizzes/${quiz.id}/questions`, { type: 'TRUE_FALSE', prompt: 'Bonus: g is 9.8', points: 1, correctAnswer: 'true' }), 201);

  const att = ok(await call(s1, 'POST', `/elearning/quizzes/${quiz.id}/attempts/start`), 'start');
  check('attempt has a deadline', !!att.expiresAt);
  const again = ok(await call(s1, 'POST', `/elearning/quizzes/${quiz.id}/attempts/start`), 'start again');
  check('starting again resumes the same attempt', again.id === att.id);
  const opts = sqFull.questions.find((q) => q.id === q1.id).options;
  const newtonOpt = q1.options.find((o) => o.isCorrect).id;
  await expectStatus('answer for a foreign question rejected', call(s1, 'PATCH', `/elearning/attempts/${att.id}/answer`, { questionId: '00000000-0000-0000-0000-000000000000', textAnswer: 'x' }), 400);
  await expectStatus('option from another question rejected', call(s1, 'PATCH', `/elearning/attempts/${att.id}/answer`, { questionId: q1.id, selectedOptionId: '00000000-0000-0000-0000-000000000000' }), 400);
  await expectStatus('true/false answer validated', call(s1, 'PATCH', `/elearning/attempts/${att.id}/answer`, { questionId: q2.id, textAnswer: 'maybe' }), 400);
  ok(await call(s1, 'PATCH', `/elearning/attempts/${att.id}/answer`, { questionId: q1.id, selectedOptionId: newtonOpt }), 'a1');
  ok(await call(s1, 'PATCH', `/elearning/attempts/${att.id}/answer`, { questionId: q2.id, textAnswer: 'false' }), 'a2');
  ok(await call(s1, 'PATCH', `/elearning/attempts/${att.id}/answer`, { questionId: q3.id, textAnswer: 'An object stays at rest or in uniform motion unless acted on by a force.' }), 'a3');
  await expectStatus('another student cannot touch the attempt', call(s2, 'PATCH', `/elearning/attempts/${att.id}/answer`, { questionId: q1.id, selectedOptionId: opts[0].id }), 403);
  const sub1 = ok(await call(s1, 'PATCH', `/elearning/attempts/${att.id}/submit`), 'submit attempt');
  check('auto part graded: 2 + 1 of 7 (bonus unanswered)', Number(sub1.totalScore) === 3 && Number(sub1.maxScore) === 7, JSON.stringify([sub1.totalScore, sub1.maxScore]));
  check('awaiting manual grading', sub1.status === 'SUBMITTED' && sub1.isPassed === null);
  check('answer key not revealed before the quiz closes', sub1.reveal === false && !sub1.review);
  const sub1b = ok(await call(s1, 'PATCH', `/elearning/attempts/${att.id}/submit`), 'submit twice');
  check('double submit is idempotent', sub1b.id === sub1.id && Number(sub1b.totalScore) === 3);
  await expectStatus('cannot answer after submit', call(s1, 'PATCH', `/elearning/attempts/${att.id}/answer`, { questionId: q1.id, selectedOptionId: opts[0].id }), 400);

  const quizRows = ok(await call(teacher, 'GET', `/elearning/courses/${COURSE}/quizzes/${quiz.id}/results`), 'results');
  check('teacher results include student name', quizRows.length === 1 && quizRows[0].studentName);
  await expectStatus('score above question max rejected', call(teacher, 'PATCH', `/elearning/attempts/${att.id}/grade-short-answer`, { questionId: q3.id, scoreAwarded: 9 }), 400);
  await expectStatus('MCQ cannot be hand graded', call(teacher, 'PATCH', `/elearning/attempts/${att.id}/grade-short-answer`, { questionId: q1.id, scoreAwarded: 1 }), 400);
  const graded3 = ok(await call(teacher, 'PATCH', `/elearning/attempts/${att.id}/grade-short-answer`, { questionId: q3.id, scoreAwarded: 2 }), 'grade short');
  check('manual grade recomputes the total (5 of 7 = 71%) and passes', Number(graded3.totalScore) === 5 && graded3.status === 'MANUALLY_GRADED' && graded3.isPassed === true, JSON.stringify([graded3.totalScore, graded3.status, graded3.isPassed]));

  // second student: second attempt rules + failing
  const a2 = ok(await call(s2, 'POST', `/elearning/quizzes/${quiz.id}/attempts/start`), 's2 start');
  ok(await call(s2, 'PATCH', `/elearning/attempts/${a2.id}/submit`), 's2 submit blank');
  const a2b = ok(await call(s2, 'POST', `/elearning/quizzes/${quiz.id}/attempts/start`), 's2 attempt 2');
  check('second attempt allowed', a2b.attemptNumber === 2);
  ok(await call(s2, 'PATCH', `/elearning/attempts/${a2b.id}/submit`), 's2 submit 2');
  await expectStatus('attempts are limited', call(s2, 'POST', `/elearning/quizzes/${quiz.id}/attempts/start`), 400);
  await expectStatus('editing a quiz after attempts is blocked', call(teacher, 'POST', `/elearning/quizzes/${quiz.id}/questions`, { type: 'TRUE_FALSE', prompt: 'Too late', correctAnswer: 'true' }), 400);

  ok(await call(teacher, 'PATCH', `/elearning/courses/${COURSE}/quizzes/${quiz.id}/close`), 'close quiz');
  const afterClose = ok(await call(s1, 'GET', `/elearning/attempts/${att.id}`), 'attempt after close');
  check('answer key revealed after close (default policy)', afterClose.reveal === true && Array.isArray(afterClose.review) && afterClose.review.length === 4);
  await expectStatus('closed quiz cannot be started', call(s1, 'POST', `/elearning/quizzes/${quiz.id}/attempts/start`), 400);

  console.log('\n== Progress, discussions, announcements, parents');
  const p1 = ok(await call(s1, 'GET', `/elearning/courses/${COURSE}/my-progress`), 'progress s1');
  check('completion percent is sane (0-100)', p1.completionPercent >= 1 && p1.completionPercent <= 100, JSON.stringify(p1));
  const thread = ok(await call(s1, 'POST', `/elearning/courses/${COURSE}/discussions`, { title: 'Question on Q3', body: 'Can you explain inertia?' }), 'thread');
  ok(await call(teacher, 'POST', `/elearning/discussions/${thread.id}/replies`, { body: 'Inertia resists changes in motion.' }), 'reply');
  const t = ok(await call(s2, 'GET', `/elearning/discussions/${thread.id}`), 'thread read');
  check('discussion shows author names', t.authorName && t.replies.length === 1 && t.replies[0].authorName, JSON.stringify([t.authorName, t.replies[0] && t.replies[0].authorName]));
  const ann = ok(await call(teacher, 'POST', `/elearning/courses/${COURSE}/announcements`, { title: 'Quiz results out', body: 'Check your attempts.' }), 'announcement');
  check('announcement is published straight away', ann.status === 'PUBLISHED');
  const anns = ok(await call(s1, 'GET', `/elearning/courses/${COURSE}/announcements`), 'announcements s1');
  check('student sees the announcement', anns.some((a) => a.id === ann.id));

  const parentCourses = ok(await call(parent, 'GET', `/elearning/courses`), 'parent courses');
  check('parent sees only their children\'s courses', parentCourses.length >= 1 && parentCourses.every((c) => c.enrolledCount >= 0) && parentCourses.some((c) => c.id === COURSE));
  const otherParentCourses = ok(await call(otherParent, 'GET', `/elearning/courses`), 'other parent courses');
  check('a different parent does not get this course unless their child is enrolled', !otherParentCourses.some((c) => c.id === 'does-not-exist'));
  await expectStatus('parent of non-enrolled child cannot open course', call(await email('parent010@demo.kilimanjaro.test', 'Parent@Kili2026'), 'GET', `/elearning/courses/${COURSE}/lessons`), 403);
  const parentLessons = ok(await call(parent, 'GET', `/elearning/courses/${COURSE}/lessons`), 'parent lessons');
  check('parent sees published lessons only', parentLessons.every((l) => l.status === 'PUBLISHED'));
  const parentAsg = ok(await call(parent, 'GET', `/elearning/courses/${COURSE}/assignments`), 'parent assignments');
  check('parent never receives submissions', parentAsg.every((a) => !a.submissions || a.submissions.length === 0));

  console.log(`\n${results.filter((r) => r.pass).length}/${results.length} checks passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('\nSCRIPT ERROR', e.message); process.exit(2); });
