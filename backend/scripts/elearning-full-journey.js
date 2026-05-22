const assert = require('node:assert/strict');

const baseUrl = process.env.ELEARNING_TEST_BASE_URL || 'http://127.0.0.1:3007/api/v1';
const suffix = Date.now().toString(36);

const users = {
  teacher: {
    id: process.env.ELEARNING_TEST_TEACHER_ID || `teacher-${suffix}`,
    role: 'TEACHER',
    email: 'teacher.elearning@kilimanjaro.test',
  },
  student: {
    id: process.env.ELEARNING_TEST_STUDENT_ID || `student-${suffix}`,
    role: 'STUDENT',
    email: 'student.elearning@kilimanjaro.test',
  },
  hod: {
    id: process.env.ELEARNING_TEST_HOD_ID || `hod-${suffix}`,
    role: 'HEAD_OF_DEPARTMENT',
    email: 'hod.elearning@kilimanjaro.test',
  },
  principal: {
    id: process.env.ELEARNING_TEST_PRINCIPAL_ID || `principal-${suffix}`,
    role: 'PRINCIPAL',
    email: 'principal.elearning@kilimanjaro.test',
  },
  aqa: {
    id: process.env.ELEARNING_TEST_AQA_ID || `aqa-${suffix}`,
    role: 'ACADEMIC_QA',
    email: 'aqa.elearning@kilimanjaro.test',
  },
  parent: {
    id: process.env.ELEARNING_TEST_PARENT_ID || `parent-${suffix}`,
    role: 'PARENT',
    email: 'parent.elearning@kilimanjaro.test',
  },
};

function headers(user) {
  return {
    'content-type': 'application/json',
    'x-user-id': user.id,
    'x-user-role': user.role,
    'x-user-email': user.email,
  };
}

async function request(method, path, user, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: headers(user),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${method} ${path} failed ${response.status}: ${text}`);
  }
  return payload && Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload;
}

async function main() {
  const health = await request('GET', '/elearning/health', users.teacher);
  assert.equal(health.status, 'ok');

  const course = await request('POST', '/elearning/courses', users.teacher, {
    classSubjectId: `class-subject-${suffix}`,
    termId: `term-${suffix}`,
    academicYearId: `year-${suffix}`,
    subjectName: 'Mathematics',
    className: 'Form 3A',
    description: 'Linear equations and functions learning space.',
    coverColor: '#6C63FF',
    coverEmoji: 'MATH',
  });
  assert.ok(course.id);

  const lesson = await request('POST', `/elearning/courses/${course.id}/lessons`, users.teacher, {
    title: 'Linear Equations Week 1',
    description: 'Concept notes, examples, homework and quiz.',
    weekNumber: 1,
    estimatedMinutes: 45,
  });
  assert.ok(lesson.id);

  const publishedLesson = await request('PATCH', `/elearning/courses/${course.id}/lessons/${lesson.id}/publish`, users.teacher);
  assert.equal(publishedLesson.status, 'PUBLISHED');

  const material = await request('POST', `/elearning/courses/${course.id}/lessons/${lesson.id}/materials`, users.teacher, {
    title: 'Linear equations low-bandwidth notes',
    type: 'NOTE',
    body: 'Solve ax + b = c by isolating x. Worked examples included.',
    downloadable: true,
    status: 'PUBLISHED',
  });
  assert.equal(material.status, 'PUBLISHED');

  const upload = await request('POST', '/elearning/uploads/local', users.teacher, {
    domain: 'materials',
    fileName: 'linear-note.txt',
    mimeType: 'text/plain',
    contentBase64: Buffer.from('Low bandwidth text note upload smoke.').toString('base64'),
  });
  assert.ok(upload.fileKey);

  const assignment = await request('POST', `/elearning/courses/${course.id}/assignments`, users.teacher, {
    lessonId: lesson.id,
    title: 'Homework 1: Solve equations',
    instructions: 'Submit answers for questions 1 to 10 with workings.',
    type: 'BOTH',
    maxScore: 20,
    dueAt: new Date(Date.now() + 86400000).toISOString(),
  });
  await request('PATCH', `/elearning/courses/${course.id}/assignments/${assignment.id}/publish`, users.teacher);

  const quiz = await request('POST', `/elearning/courses/${course.id}/quizzes`, users.teacher, {
    lessonId: lesson.id,
    title: 'Linear Equations Checkpoint',
    instructions: 'Choose the correct answer.',
    maxAttempts: 2,
    passingScore: 50,
  });
  const question = await request('POST', `/elearning/quizzes/${quiz.id}/questions`, users.teacher, {
    type: 'MULTIPLE_CHOICE',
    prompt: 'Solve 2x + 4 = 10.',
    points: 5,
    options: [
      { text: 'x = 2', isCorrect: false },
      { text: 'x = 3', isCorrect: true },
      { text: 'x = 7', isCorrect: false },
    ],
  });
  const correctOption = question.options.find((option) => option.isCorrect);
  assert.ok(correctOption.id);
  await request('PATCH', `/elearning/courses/${course.id}/quizzes/${quiz.id}/publish`, users.teacher);

  await request('POST', `/elearning/courses/${course.id}/sync-enrollments`, users.teacher, {
    studentIds: [users.student.id],
  });
  await request('PATCH', `/elearning/courses/${course.id}/publish`, users.teacher);

  const studentCourses = await request('GET', '/elearning/courses', users.student);
  assert.equal(studentCourses.some((item) => item.id === course.id), true);

  const materialProgress = await request('POST', `/elearning/materials/${material.id}/view`, users.student);
  assert.equal(materialProgress.studentId, users.student.id);

  const submission = await request('POST', `/elearning/assignments/${assignment.id}/submissions`, users.student, {
    textContent: 'Q1: x = 3. Full workings attached in text.',
    submit: true,
  });
  assert.equal(submission.status, 'SUBMITTED');

  const attempt = await request('POST', `/elearning/quizzes/${quiz.id}/attempts/start`, users.student);
  await request('PATCH', `/elearning/attempts/${attempt.id}/answer`, users.student, {
    questionId: question.id,
    selectedOptionId: correctOption.id,
  });
  const submittedAttempt = await request('PATCH', `/elearning/attempts/${attempt.id}/submit`, users.student);
  assert.equal(Number(submittedAttempt.percentScore), 100);

  const graded = await request('PATCH', `/elearning/submissions/${submission.id}/grade`, users.teacher, {
    score: 18,
    maxScore: 20,
    feedback: 'Strong working. Keep setting out each transformation.',
  });
  assert.equal(graded.status, 'GRADED');

  const missing = await request('GET', `/elearning/courses/${course.id}/assignments/${assignment.id}/submissions/missing`, users.teacher);
  assert.ok(Array.isArray(missing));

  const announcement = await request('POST', `/elearning/courses/${course.id}/announcements`, users.teacher, {
    title: 'Revision clinic',
    body: 'Bring your homework questions tomorrow.',
  });
  await request('PATCH', `/elearning/courses/${course.id}/announcements/${announcement.id}/publish`, users.teacher);

  const discussion = await request('POST', `/elearning/courses/${course.id}/discussions`, users.student, {
    lessonId: lesson.id,
    title: 'Question about isolating x',
    body: 'When do I divide both sides?',
  });
  await request('POST', `/elearning/discussions/${discussion.id}/replies`, users.teacher, {
    body: 'Divide both sides after moving constants away from the x term.',
  });

  const progress = await request('GET', `/elearning/courses/${course.id}/my-progress`, users.student);
  assert.equal(progress.studentId, users.student.id);

  const teacherAnalytics = await request('GET', `/elearning/analytics/teacher/courses/${course.id}/engagement`, users.teacher);
  assert.equal(teacherAnalytics.courseId, course.id);
  assert.ok(Array.isArray(teacherAnalytics.progress));
  assert.ok(teacherAnalytics.materialStats);
  assert.ok(teacherAnalytics.assignmentStats);
  assert.ok(teacherAnalytics.quizStats);
  await request('GET', '/elearning/analytics/hod/overview', users.hod);
  await request('GET', '/elearning/analytics/principal/overview', users.principal);
  await request('GET', '/elearning/analytics/aqa/courses', users.aqa);
  await request('GET', '/elearning/admin/audit-logs?limit=10', users.aqa);
  await request('GET', '/elearning/admin/storage-policy', { ...users.aqa, role: 'SYSTEM_ADMIN' });
  await request('GET', `/elearning/analytics/parent/${users.student.id}/summary`, users.parent);

  console.log(JSON.stringify({
    ok: true,
    courseId: course.id,
    lessonId: lesson.id,
    materialId: material.id,
    assignmentId: assignment.id,
    submissionId: submission.id,
    quizId: quiz.id,
    attemptId: attempt.id,
    studentId: users.student.id,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
