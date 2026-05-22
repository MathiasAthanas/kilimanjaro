/* eslint-disable no-console */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function loadEnv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index < 0) continue;
    out[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }
  return out;
}

const backendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backendRoot, '..');
const defaultEnv = loadEnv(path.join(backendRoot, 'services', 'auth-service', '.env'));
process.env.DATABASE_URL = process.env.DEMO_DATABASE_URL || process.env.DATABASE_URL || defaultEnv.DATABASE_URL;

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL or DEMO_DATABASE_URL is required.');
  process.exit(1);
}

let argon2;
try {
  argon2 = require('argon2');
} catch {
  argon2 = require(path.join(backendRoot, 'services', 'auth-service', 'node_modules', 'argon2'));
}
const { PrismaClient: AuthClient } = require('../services/auth-service/generated/prisma');
const { PrismaClient: StudentClient } = require('../services/student-service/generated/prisma');
const { PrismaClient: AcademicClient } = require('../services/academic-service/generated/prisma');
const { PrismaClient: FinanceClient } = require('../services/finance-service/generated/prisma');
const { PrismaClient: ElearningClient } = require('../services/elearning-service/generated/prisma');
const { PrismaClient: NotificationClient } = require('../services/notification-service/generated/prisma');
const { PrismaClient: AnalyticsClient } = require('../services/analytics-service/generated/prisma');
const { PrismaClient: OperationsClient } = require('../services/api-gateway/generated/prisma');

const auth = new AuthClient();
const students = new StudentClient();
const academics = new AcademicClient();
const finance = new FinanceClient();
const elearning = new ElearningClient();
const notifications = new NotificationClient();
const analytics = new AnalyticsClient();
const operations = new OperationsClient();

const DEMO_DOMAIN = 'demo.kilimanjaro.test';
const SCHOOL_YEAR_ID = uuid('academic-year-2026');
const TERM_1_ID = uuid('term-2026-1');
const TERM_2_ID = uuid('term-2026-2');
const TERM_3_ID = uuid('term-2026-3');
const CURRENT_TERM_ID = TERM_2_ID;
const SYSTEM_ID = uuid('user-system-admin');
const PASSWORDS = {
  admin: 'Admin@Kili2026',
  principal: 'Principal@Kili2026',
  aqa: 'Aqa@Kili2026',
  hod: 'Hod@Kili2026',
  teacher: 'Teacher@Kili2026',
  finance: 'Finance@Kili2026',
  parent: 'Parent@Kili2026',
  student: 'Student@Kili2026',
  staff: 'Staff@Kili2026',
};

const maleNames = ['Amani', 'Baraka', 'Daudi', 'Emmanuel', 'Faraji', 'Hassan', 'Ibrahim', 'Juma', 'Kelvin', 'Lucas', 'Musa', 'Noel', 'Omari', 'Peter', 'Rajabu', 'Samwel', 'Tito', 'Yusuph'];
const femaleNames = ['Amina', 'Beatrice', 'Clara', 'Doreen', 'Eunice', 'Fatuma', 'Grace', 'Halima', 'Irene', 'Janeth', 'Neema', 'Rehema', 'Salma', 'Theresia', 'Upendo', 'Veronica', 'Zawadi'];
const lastNames = ['Mushi', 'Mollel', 'Kimaro', 'Massawe', 'Shayo', 'Mrema', 'Kweka', 'Lema', 'Msuya', 'Tarimo', 'Swai', 'Lyimo', 'Mcharo', 'Nkya', 'Sanga', 'Ndesamburo'];
const streets = ['Moshi Urban', 'Majengo', 'Soweto', 'Pasua', 'Rau', 'Shanty Town', 'Kiboriloni', 'Himo', 'Marangu', 'Machame'];

const roleAccounts = [
  { key: 'admin', email: `admin@${DEMO_DOMAIN}`, role: 'SYSTEM_ADMIN', firstName: 'System', lastName: 'Administrator', passwordKey: 'admin' },
  { key: 'principal', email: `principal@${DEMO_DOMAIN}`, role: 'PRINCIPAL', firstName: 'Dr. Miriam', lastName: 'Kileo', passwordKey: 'principal' },
  { key: 'aqa', email: `aqa@${DEMO_DOMAIN}`, role: 'ACADEMIC_QA', firstName: 'Quality', lastName: 'Assurance', passwordKey: 'aqa' },
  { key: 'finance', email: `finance@${DEMO_DOMAIN}`, role: 'FINANCE', firstName: 'Bursar', lastName: 'Mtei', passwordKey: 'finance' },
  { key: 'registrar', email: `registrar@${DEMO_DOMAIN}`, role: 'SYSTEM_ADMIN', firstName: 'Registrar', lastName: 'Laiser', passwordKey: 'staff' },
  { key: 'librarian', email: `librarian@${DEMO_DOMAIN}`, role: 'TEACHER', firstName: 'Librarian', lastName: 'Ngalu', passwordKey: 'staff' },
  { key: 'hr', email: `hr@${DEMO_DOMAIN}`, role: 'SYSTEM_ADMIN', firstName: 'HR', lastName: 'Mwanga', passwordKey: 'staff' },
];

const teacherSpecs = [
  ['hod-science', 'HEAD_OF_DEPARTMENT', 'HOD Science', 'Msuya', 'hod', 'Science'],
  ['hod-maths', 'HEAD_OF_DEPARTMENT', 'HOD Mathematics', 'Shayo', 'hod', 'Mathematics'],
  ['hod-languages', 'HEAD_OF_DEPARTMENT', 'HOD Languages', 'Kweka', 'hod', 'Languages'],
  ['t-english', 'TEACHER', 'Mary', 'Mallya', 'teacher', 'Languages'],
  ['t-kiswahili', 'TEACHER', 'Joseph', 'Mushi', 'teacher', 'Languages'],
  ['t-maths-a', 'TEACHER', 'Daniel', 'Mrema', 'teacher', 'Mathematics'],
  ['t-maths-b', 'TEACHER', 'Agnes', 'Lyimo', 'teacher', 'Mathematics'],
  ['t-science', 'TEACHER', 'Gloria', 'Sanga', 'teacher', 'Science'],
  ['t-biology', 'TEACHER', 'Erick', 'Tarimo', 'teacher', 'Science'],
  ['t-physics', 'TEACHER', 'Victor', 'Swai', 'teacher', 'Science'],
  ['t-chemistry', 'TEACHER', 'Rose', 'Nkya', 'teacher', 'Science'],
  ['t-history', 'TEACHER', 'Brian', 'Massawe', 'teacher', 'Humanities'],
  ['t-geography', 'TEACHER', 'Leah', 'Kileo', 'teacher', 'Humanities'],
  ['t-commerce', 'TEACHER', 'Kelvin', 'Lema', 'teacher', 'Business'],
  ['t-accounts', 'TEACHER', 'Naomi', 'Mcharo', 'teacher', 'Business'],
  ['t-ict', 'TEACHER', 'Patrick', 'Kiwia', 'teacher', 'ICT'],
  ['t-primary-a', 'TEACHER', 'Upendo', 'Moshi', 'teacher', 'Primary'],
  ['t-primary-b', 'TEACHER', 'Frank', 'Mtei', 'teacher', 'Primary'],
];

const classSpecs = [
  ['nursery-a', 'Nursery', 0, 'A', 'PRIMARY', 'NURSERY', 12],
  ['preunit-a', 'Pre-Unit', 0, 'A', 'PRIMARY', 'PRE_PRIMARY', 14],
  ['std1-a', 'Standard 1', 1, 'A', 'PRIMARY', 'PRIMARY', 14],
  ['std2-a', 'Standard 2', 2, 'A', 'PRIMARY', 'PRIMARY', 14],
  ['std3-a', 'Standard 3', 3, 'A', 'PRIMARY', 'PRIMARY', 14],
  ['std4-a', 'Standard 4', 4, 'A', 'PRIMARY', 'PRIMARY', 14],
  ['std5-a', 'Standard 5', 5, 'A', 'PRIMARY', 'PRIMARY', 14],
  ['std6-a', 'Standard 6', 6, 'A', 'PRIMARY', 'PRIMARY', 14],
  ['std7-a', 'Standard 7', 7, 'A', 'PRIMARY', 'PRIMARY', 14],
  ['form1-a', 'Form 1', 1, 'A', 'O_LEVEL', 'CSEE', 14],
  ['form1-b', 'Form 1', 1, 'B', 'O_LEVEL', 'CSEE', 12],
  ['form2-a', 'Form 2', 2, 'A', 'O_LEVEL', 'CSEE', 12],
  ['form3-a', 'Form 3', 3, 'A', 'O_LEVEL', 'CSEE', 12],
  ['form4-a', 'Form 4', 4, 'A', 'O_LEVEL', 'CSEE', 12],
  ['form5-pcm', 'Form 5', 5, 'PCM', 'A_LEVEL', 'ACSEE', 8],
  ['form5-egm', 'Form 5', 5, 'EGM', 'A_LEVEL', 'ACSEE', 8],
  ['form6-pcm', 'Form 6', 6, 'PCM', 'A_LEVEL', 'ACSEE', 7],
  ['form6-hgl', 'Form 6', 6, 'HGL', 'A_LEVEL', 'ACSEE', 7],
];

const subjectsByStage = {
  PRIMARY: [
    ['PR-MATH', 'Mathematics'], ['PR-ENG', 'English'], ['PR-KIS', 'Kiswahili'], ['PR-SCI', 'Science'],
    ['PR-SOC', 'Social Studies'], ['PR-CIV', 'Civics and Moral Education'], ['PR-ICT', 'ICT Basics'],
  ],
  O_LEVEL: [
    ['OL-MATH', 'Basic Mathematics'], ['OL-ENG', 'English Language'], ['OL-KIS', 'Kiswahili'], ['OL-BIO', 'Biology'],
    ['OL-CHEM', 'Chemistry'], ['OL-PHY', 'Physics'], ['OL-HIST', 'History'], ['OL-GEO', 'Geography'],
    ['OL-CIV', 'Civics'], ['OL-BKEEP', 'Book Keeping'], ['OL-COM', 'Commerce'],
  ],
  A_LEVEL: [
    ['AL-MATH', 'Advanced Mathematics'], ['AL-PHY', 'Physics'], ['AL-CHEM', 'Chemistry'], ['AL-BIO', 'Biology'],
    ['AL-GEO', 'Geography'], ['AL-ECON', 'Economics'], ['AL-HIST', 'History'], ['AL-LIT', 'Literature in English'], ['AL-GS', 'General Studies'],
  ],
};

const credentials = [];
const ids = {
  users: {},
  teachers: [],
  guardians: [],
  students: [],
  classes: {},
  classStudents: {},
  subjects: {},
  classSubjects: [],
  feeCategories: {},
};

function uuid(key) {
  const h = crypto.createHash('sha1').update(`kilimanjaro-demo:${key}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${((parseInt(h.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)}${h.slice(18, 20)}-${h.slice(20, 32)}`;
}

function date(daysFromNow) {
  const d = new Date('2026-05-23T09:00:00.000Z');
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d;
}

function pick(arr, index) {
  return arr[index % arr.length];
}

function scoreFor(studentIndex, subjectIndex, assessmentIndex) {
  const base = 52 + ((studentIndex * 7 + subjectIndex * 11 + assessmentIndex * 5) % 43);
  if ((studentIndex + subjectIndex) % 17 === 0) return Math.max(28, base - 24);
  if ((studentIndex + subjectIndex) % 19 === 0) return Math.min(98, base + 12);
  return base;
}

function grade(stage, score) {
  if (stage === 'A_LEVEL') {
    if (score >= 80) return ['A', 1, 'Excellent', true];
    if (score >= 70) return ['B', 2, 'Very good', true];
    if (score >= 60) return ['C', 3, 'Good', true];
    if (score >= 50) return ['D', 4, 'Satisfactory', true];
    if (score >= 40) return ['E', 5, 'Basic pass', true];
    if (score >= 35) return ['S', 6, 'Subsidiary pass', true];
    return ['F', 7, 'Needs urgent support', false];
  }
  if (stage === 'PRIMARY') {
    if (score >= 80) return ['A', 1, 'Excellent', true];
    if (score >= 65) return ['B', 2, 'Very good', true];
    if (score >= 50) return ['C', 3, 'Good progress', true];
    if (score >= 35) return ['D', 4, 'Needs support', false];
    return ['E', 5, 'At risk', false];
  }
  if (score >= 75) return ['A', 1, 'Excellent', true];
  if (score >= 65) return ['B', 2, 'Very good', true];
  if (score >= 45) return ['C', 3, 'Good', true];
  if (score >= 30) return ['D', 4, 'Weak pass', true];
  return ['F', 5, 'Failing', false];
}

async function upsertUser(account, passwordHash) {
  const id = uuid(`user-${account.key}`);
  ids.users[account.key] = id;
  await auth.user.upsert({
    where: { email: account.email },
    update: {
      passwordHash,
      role: account.role,
      firstName: account.firstName,
      lastName: account.lastName,
      phoneNumber: account.phone || `+2557${String(Math.abs(id.length * 937) % 100000000).padStart(8, '0')}`,
      isActive: true,
      isEmailVerified: true,
    },
    create: {
      id,
      email: account.email,
      registrationNumber: account.registrationNumber,
      passwordHash,
      role: account.role,
      firstName: account.firstName,
      lastName: account.lastName,
      phoneNumber: account.phone || `+2557${String(Math.abs(id.length * 937) % 100000000).padStart(8, '0')}`,
      isActive: true,
      isEmailVerified: true,
      createdBy: SYSTEM_ID,
    },
  });
  credentials.push({
    label: account.label || account.key,
    role: account.role,
    email: account.email,
    registrationNumber: account.registrationNumber || '',
    password: PASSWORDS[account.passwordKey],
  });
  return id;
}

async function seedAuthUsers() {
  console.log('Seeding auth users...');
  const hashes = {};
  for (const [key, password] of Object.entries(PASSWORDS)) {
    hashes[key] = await argon2.hash(password, { timeCost: 2, memoryCost: 19456, parallelism: 1 });
  }
  for (const account of roleAccounts) await upsertUser(account, hashes[account.passwordKey]);
  for (const spec of teacherSpecs) {
    const [key, role, firstName, lastName, passwordKey, department] = spec;
    const id = await upsertUser({
      key,
      role,
      firstName,
      lastName,
      passwordKey,
      email: `${key}@${DEMO_DOMAIN}`,
      label: `${firstName} ${lastName} (${department})`,
    }, hashes[passwordKey]);
    ids.teachers.push({ id, key, department, firstName, lastName, role });
  }
  return hashes;
}

async function seedStudentStructure() {
  console.log('Seeding academic years, terms, classes and pathways...');
  await students.academicYear.upsert({
    where: { name: '2026 Academic Year' },
    update: { isCurrent: true, startDate: date(-142), endDate: date(222) },
    create: { id: SCHOOL_YEAR_ID, name: '2026 Academic Year', isCurrent: true, startDate: date(-142), endDate: date(222) },
  });
  for (const term of [
    [TERM_1_ID, 'Term 1', -130, -20, false],
    [TERM_2_ID, 'Term 2', -10, 95, true],
    [TERM_3_ID, 'Term 3', 110, 210, false],
  ]) {
    await students.term.upsert({
      where: { academicYearId_name: { academicYearId: SCHOOL_YEAR_ID, name: term[1] } },
      update: { startDate: date(term[2]), endDate: date(term[3]), isCurrent: term[4] },
      create: { id: term[0], academicYearId: SCHOOL_YEAR_ID, name: term[1], startDate: date(term[2]), endDate: date(term[3]), isCurrent: term[4] },
    });
  }
  for (let i = 0; i < classSpecs.length; i++) {
    const [key, name, level, stream, stage, curriculumCode, capacity] = classSpecs[i];
    const classTeacher = pick(ids.teachers, i);
    const classId = uuid(`class-${key}`);
    ids.classes[key] = { id: classId, key, name, level, stream, stage, capacity };
    ids.classStudents[classId] = [];
    await students.class.upsert({
      where: { name_stream_academicYearId: { name, stream, academicYearId: SCHOOL_YEAR_ID } },
      update: { level, educationStage: stage, curriculumCode, terminalYear: key.includes('std7') || key.includes('form4') || key.includes('form6'), classTeacherId: classTeacher.id, capacity, sortOrder: i },
      create: { id: classId, name, level, stream, educationStage: stage, curriculumCode, terminalYear: key.includes('std7') || key.includes('form4') || key.includes('form6'), academicYearId: SCHOOL_YEAR_ID, classTeacherId: classTeacher.id, capacity, sortOrder: i },
    });
  }
  for (let i = 0; i < classSpecs.length - 1; i++) {
    const from = ids.classes[classSpecs[i][0]];
    const to = ids.classes[classSpecs[i + 1][0]];
    await students.classPathway.upsert({
      where: { fromClassId_academicYearId: { fromClassId: from.id, academicYearId: SCHOOL_YEAR_ID } },
      update: { toClassId: to.id, transitionType: from.stage === to.stage ? 'PROMOTION' : 'CROSS_STAGE', note: `Normal progression from ${from.name} ${from.stream}` },
      create: { id: uuid(`pathway-${from.key}`), fromClassId: from.id, toClassId: to.id, academicYearId: SCHOOL_YEAR_ID, transitionType: from.stage === to.stage ? 'PROMOTION' : 'CROSS_STAGE', note: `Normal progression from ${from.name} ${from.stream}` },
    });
  }
}

async function seedStudentsAndGuardians(hashes) {
  console.log('Seeding 200 students, guardians, enrolments, attendance and discipline...');
  let count = 0;
  let guardianCounter = 0;
  for (let c = 0; c < classSpecs.length; c++) {
    const classInfo = ids.classes[classSpecs[c][0]];
    const target = classSpecs[c][6];
    for (let j = 0; j < target; j++) {
      count += 1;
      const gender = count % 2 === 0 ? 'FEMALE' : 'MALE';
      const firstName = gender === 'MALE' ? pick(maleNames, count) : pick(femaleNames, count);
      const lastName = pick(lastNames, count + c);
      const regPrefix = classInfo.stage === 'PRIMARY' ? 'KS-P' : classInfo.stage === 'A_LEVEL' ? 'KS-A' : 'KS-S';
      const reg = `${regPrefix}-2026-${String(count).padStart(5, '0')}`;
      const studentUserId = uuid(`user-student-${count}`);
      const studentId = uuid(`student-${count}`);
      const email = `student${String(count).padStart(3, '0')}@${DEMO_DOMAIN}`;
      await auth.user.upsert({
        where: { registrationNumber: reg },
        update: { email, passwordHash: hashes.student, firstName, lastName, role: 'STUDENT', isActive: true, isEmailVerified: true },
        create: { id: studentUserId, email, registrationNumber: reg, passwordHash: hashes.student, role: 'STUDENT', firstName, lastName, isActive: true, isEmailVerified: true, createdBy: SYSTEM_ID },
      });
      if (count <= 8) credentials.push({ label: `${firstName} ${lastName}`, role: 'STUDENT', email, registrationNumber: reg, password: PASSWORDS.student });
      await students.student.upsert({
        where: { registrationNumber: reg },
        update: {
          authUserId: studentUserId,
          firstName,
          lastName,
          dateOfBirth: date(-(365 * (classInfo.level + 6 + (classInfo.stage === 'A_LEVEL' ? 6 : classInfo.stage === 'O_LEVEL' ? 7 : 0)) + j * 11)),
          gender,
          profilePhotoUrl: `/demo/students/${reg}.jpg`,
          status: 'ACTIVE',
          notes: `Demo learner in ${classInfo.name} ${classInfo.stream}. Medical: ${count % 13 === 0 ? 'mild asthma, inhaler kept at nurse office' : 'no critical condition'}.`,
          nectaCandidateNumber: classInfo.key.includes('form4') || classInfo.key.includes('form6') ? `S${2026}${String(count).padStart(4, '0')}` : null,
          psleIndexNumber: classInfo.key.includes('std7') ? `P${2026}${String(count).padStart(4, '0')}` : null,
          nationalExamYear: classInfo.key.includes('std7') || classInfo.key.includes('form4') || classInfo.key.includes('form6') ? 2026 : null,
        },
        create: {
          id: studentId,
          registrationNumber: reg,
          authUserId: studentUserId,
          firstName,
          lastName,
          dateOfBirth: date(-(365 * (classInfo.level + 6 + (classInfo.stage === 'A_LEVEL' ? 6 : classInfo.stage === 'O_LEVEL' ? 7 : 0)) + j * 11)),
          gender,
          profilePhotoUrl: `/demo/students/${reg}.jpg`,
          status: 'ACTIVE',
          admissionDate: date(-500 + count),
          createdBy: SYSTEM_ID,
          notes: `Demo learner in ${classInfo.name} ${classInfo.stream}. Medical: ${count % 13 === 0 ? 'mild asthma, inhaler kept at nurse office' : 'no critical condition'}.`,
          nectaCandidateNumber: classInfo.key.includes('form4') || classInfo.key.includes('form6') ? `S${2026}${String(count).padStart(4, '0')}` : null,
          psleIndexNumber: classInfo.key.includes('std7') ? `P${2026}${String(count).padStart(4, '0')}` : null,
          nationalExamYear: classInfo.key.includes('std7') || classInfo.key.includes('form4') || classInfo.key.includes('form6') ? 2026 : null,
        },
      });
      ids.students.push({ id: studentId, index: count, classId: classInfo.id, classKey: classInfo.key, stage: classInfo.stage, level: classInfo.level, name: `${firstName} ${lastName}` });
      ids.classStudents[classInfo.id].push(studentId);
      await students.enrolment.upsert({
        where: { studentId_classId_academicYearId: { studentId, classId: classInfo.id, academicYearId: SCHOOL_YEAR_ID } },
        update: { termId: CURRENT_TERM_ID, isActive: true },
        create: { id: uuid(`enrolment-${count}`), studentId, classId: classInfo.id, academicYearId: SCHOOL_YEAR_ID, termId: CURRENT_TERM_ID, isActive: true },
      });

      if (count % 2 === 1 || guardianCounter < 80) {
        guardianCounter += 1;
        const parentFirst = count % 3 === 0 ? pick(femaleNames, count + 3) : pick(maleNames, count + 5);
        const parentLast = lastName;
        const parentEmail = `parent${String(guardianCounter).padStart(3, '0')}@${DEMO_DOMAIN}`;
        const parentUserId = uuid(`user-parent-${guardianCounter}`);
        const guardianId = uuid(`guardian-${guardianCounter}`);
        await auth.user.upsert({
          where: { email: parentEmail },
          update: { passwordHash: hashes.parent, firstName: parentFirst, lastName: parentLast, role: 'PARENT', isActive: true, isEmailVerified: true },
          create: { id: parentUserId, email: parentEmail, passwordHash: hashes.parent, role: 'PARENT', firstName: parentFirst, lastName: parentLast, phoneNumber: `+2557${String(10000000 + guardianCounter * 7919).slice(0, 8)}`, isActive: true, isEmailVerified: true, createdBy: SYSTEM_ID },
        });
        await students.guardian.upsert({
          where: { authUserId: parentUserId },
          update: { firstName: parentFirst, lastName: parentLast, phoneNumber: `+2557${String(10000000 + guardianCounter * 7919).slice(0, 8)}`, email: parentEmail, occupation: pick(['Business Owner', 'Nurse', 'Teacher', 'Farmer', 'Civil Servant', 'Driver', 'Accountant'], guardianCounter), address: pick(streets, guardianCounter) },
          create: { id: guardianId, authUserId: parentUserId, firstName: parentFirst, lastName: parentLast, relationship: count % 3 === 0 ? 'MOTHER' : 'FATHER', phoneNumber: `+2557${String(10000000 + guardianCounter * 7919).slice(0, 8)}`, email: parentEmail, occupation: pick(['Business Owner', 'Nurse', 'Teacher', 'Farmer', 'Civil Servant', 'Driver', 'Accountant'], guardianCounter), address: pick(streets, guardianCounter) },
        });
        ids.guardians.push({ id: guardianId, userId: parentUserId, email: parentEmail });
        if (guardianCounter <= 8) credentials.push({ label: `${parentFirst} ${parentLast}`, role: 'PARENT', email: parentEmail, registrationNumber: '', password: PASSWORDS.parent });
      }
      const guardian = pick(ids.guardians, count - 1);
      await students.studentGuardianLink.upsert({
        where: { studentId_guardianId: { studentId, guardianId: guardian.id } },
        update: { isPrimary: true, isActive: true },
        create: { id: uuid(`guardian-link-${studentId}-${guardian.id}`), studentId, guardianId: guardian.id, isPrimary: true, isActive: true },
      });
    }
  }
  for (const s of ids.students) {
    for (let d = -60; d <= 0; d += 1) {
      const day = date(d);
      if ([0, 6].includes(day.getUTCDay())) continue;
      const mod = (s.index + Math.abs(d)) % 29;
      const status = mod === 0 ? 'ABSENT' : mod === 7 ? 'LATE' : mod === 13 ? 'EXCUSED' : 'PRESENT';
      await students.attendanceRecord.upsert({
        where: { studentId_date_classId: { studentId: s.id, date: day, classId: s.classId } },
        update: { status, termId: CURRENT_TERM_ID, markedById: pick(ids.teachers, s.index).id, note: status === 'PRESENT' ? null : `${status.toLowerCase()} recorded during demo term` },
        create: { id: uuid(`attendance-${s.id}-${d}`), studentId: s.id, classId: s.classId, date: day, termId: CURRENT_TERM_ID, status, markedById: pick(ids.teachers, s.index).id, note: status === 'PRESENT' ? null : `${status.toLowerCase()} recorded during demo term` },
      });
    }
    if (s.index % 11 === 0) {
      await students.disciplineRecord.upsert({
        where: { id: uuid(`discipline-${s.id}`) },
        update: {},
        create: { id: uuid(`discipline-${s.id}`), studentId: s.id, incidentDate: date(-((s.index % 30) + 5)), category: s.index % 22 === 0 ? 'ABSENTEEISM' : 'MISCONDUCT', severity: s.index % 22 === 0 ? 'MODERATE' : 'MINOR', description: 'Demo behaviour incident with documented follow-up.', actionTaken: 'Counselling session and parent notification completed.', reportedById: pick(ids.teachers, s.index).id, resolvedAt: date(-2), resolutionNote: 'Improved conduct observed.', requiresParentNotification: true },
      });
    }
  }
}

async function seedAcademics() {
  console.log('Seeding subjects, class subjects, grading, assessments, marks, results and report cards...');
  const allSubjects = [...subjectsByStage.PRIMARY.map((x) => [...x, 'PRIMARY']), ...subjectsByStage.O_LEVEL.map((x) => [...x, 'O_LEVEL']), ...subjectsByStage.A_LEVEL.map((x) => [...x, 'A_LEVEL'])];
  for (const [code, name, stage] of allSubjects) {
    const id = uuid(`subject-${code}`);
    ids.subjects[code] = { id, code, name, stage };
    await academics.subject.upsert({
      where: { code },
      update: { name, educationStage: stage, isActive: true },
      create: { id, code, name, educationStage: stage, isCompulsory: !code.includes('BKEEP') && !code.includes('COM'), isActive: true },
    });
  }

  for (const combo of [
    ['PCM', 'Physics Chemistry Mathematics', ['AL-PHY', 'AL-CHEM', 'AL-MATH', 'AL-GS']],
    ['EGM', 'Economics Geography Mathematics', ['AL-ECON', 'AL-GEO', 'AL-MATH', 'AL-GS']],
    ['HGL', 'History Geography Literature', ['AL-HIST', 'AL-GEO', 'AL-LIT', 'AL-GS']],
  ]) {
    const comboId = uuid(`combo-${combo[0]}`);
    await academics.subjectCombination.upsert({
      where: { code_academicYearId: { code: combo[0], academicYearId: SCHOOL_YEAR_ID } },
      update: { name: combo[1], isActive: true },
      create: { id: comboId, code: combo[0], name: combo[1], educationStage: 'A_LEVEL', academicYearId: SCHOOL_YEAR_ID, isActive: true },
    });
    for (let i = 0; i < combo[2].length; i++) {
      const subject = ids.subjects[combo[2][i]];
      await academics.subjectCombinationSubject.upsert({
        where: { combinationId_subjectId: { combinationId: comboId, subjectId: subject.id } },
        update: { displayOrder: i, subjectRole: combo[2][i] === 'AL-GS' ? 'COMPULSORY_SUBSIDIARY' : 'PRINCIPAL' },
        create: { id: uuid(`combo-subject-${combo[0]}-${subject.code}`), combinationId: comboId, subjectId: subject.id, displayOrder: i, subjectRole: combo[2][i] === 'AL-GS' ? 'COMPULSORY_SUBSIDIARY' : 'PRINCIPAL', isPrincipal: combo[2][i] !== 'AL-GS' },
      });
    }
  }

  for (const [stage, boundaries] of Object.entries({
    PRIMARY: [['A', 80, 100, 1, 'Excellent'], ['B', 65, 79, 2, 'Very good'], ['C', 50, 64, 3, 'Good progress'], ['D', 35, 49, 4, 'Needs support'], ['E', 0, 34, 5, 'At risk']],
    O_LEVEL: [['A', 75, 100, 1, 'Excellent'], ['B', 65, 74, 2, 'Very good'], ['C', 45, 64, 3, 'Good'], ['D', 30, 44, 4, 'Weak pass'], ['F', 0, 29, 5, 'Failing']],
    A_LEVEL: [['A', 80, 100, 1, 'Excellent'], ['B', 70, 79, 2, 'Very good'], ['C', 60, 69, 3, 'Good'], ['D', 50, 59, 4, 'Satisfactory'], ['E', 40, 49, 5, 'Basic pass'], ['S', 35, 39, 6, 'Subsidiary pass'], ['F', 0, 34, 7, 'Failing']],
  })) {
    const scaleId = uuid(`grading-${stage}`);
    await academics.gradingScale.upsert({
      where: { id: scaleId },
      update: { isActive: true },
      create: { id: scaleId, name: `${stage.replace('_', ' ')} Demo Scale 2026`, academicYearId: SCHOOL_YEAR_ID, educationStage: stage, isActive: true },
    });
    for (const b of boundaries) {
      await academics.gradeBoundary.upsert({
        where: { gradingScaleId_grade: { gradingScaleId: scaleId, grade: b[0] } },
        update: { minScore: b[1], maxScore: b[2], points: b[3], remark: b[4], isPassing: !['E', 'F'].includes(b[0]) || stage === 'A_LEVEL' && b[0] === 'E' },
        create: { id: uuid(`grade-${stage}-${b[0]}`), gradingScaleId: scaleId, grade: b[0], minScore: b[1], maxScore: b[2], points: b[3], remark: b[4], isPassing: !['E', 'F'].includes(b[0]) || stage === 'A_LEVEL' && b[0] === 'E' },
      });
    }
  }

  const assessmentTypes = [];
  for (const [code, name, weight, stage] of [
    ['CAT1', 'Continuous Assessment 1', 20, 'PRIMARY'], ['MIDTERM', 'Mid-Term Test', 30, 'PRIMARY'], ['FINAL', 'End-Term Exam', 50, 'PRIMARY'],
    ['CAT1', 'Continuous Assessment 1', 20, 'O_LEVEL'], ['MIDTERM', 'Mid-Term Test', 30, 'O_LEVEL'], ['FINAL', 'Terminal Exam', 50, 'O_LEVEL'],
    ['CAT1', 'Continuous Assessment', 30, 'A_LEVEL'], ['FINAL', 'Terminal Exam', 70, 'A_LEVEL'],
  ]) {
    const id = uuid(`assessment-type-${stage}-${code}`);
    assessmentTypes.push({ id, code, stage, weight });
    const existingType = await academics.assessmentType.findFirst({
      where: { code, academicYearId: SCHOOL_YEAR_ID, educationStage: stage, classLevel: null, subjectId: null },
    });
    if (existingType) {
      await academics.assessmentType.update({
        where: { id: existingType.id },
        data: { name, weightPercentage: weight, isActive: true },
      });
      continue;
    }
    await academics.assessmentType.create({
      data: { id, code, name, weightPercentage: weight, academicYearId: SCHOOL_YEAR_ID, educationStage: stage, isActive: true },
    });
  }

  const weekdays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
  for (const classInfo of Object.values(ids.classes)) {
    const subjectCodes = classInfo.stage === 'PRIMARY'
      ? ['PR-MATH', 'PR-ENG', 'PR-KIS', 'PR-SCI', 'PR-SOC']
      : classInfo.stage === 'O_LEVEL'
        ? ['OL-MATH', 'OL-ENG', 'OL-KIS', 'OL-BIO', 'OL-CHEM', 'OL-PHY', 'OL-HIST', 'OL-GEO']
        : classInfo.stream === 'EGM'
          ? ['AL-ECON', 'AL-GEO', 'AL-MATH', 'AL-GS']
          : classInfo.stream === 'HGL'
            ? ['AL-HIST', 'AL-GEO', 'AL-LIT', 'AL-GS']
            : ['AL-PHY', 'AL-CHEM', 'AL-MATH', 'AL-GS'];
    for (let i = 0; i < subjectCodes.length; i++) {
      const subject = ids.subjects[subjectCodes[i]];
      const teacher = pick(ids.teachers, i + classInfo.level);
      const comboId = classInfo.stage === 'A_LEVEL' ? uuid(`combo-${classInfo.stream}`) : null;
      const classSubjectId = uuid(`class-subject-${classInfo.id}-${subject.id}-${comboId || 'core'}`);
      ids.classSubjects.push({ id: classSubjectId, classId: classInfo.id, subjectId: subject.id, subjectName: subject.name, stage: classInfo.stage, level: classInfo.level, teacherId: teacher.id, subjectIndex: i });
      const existingClassSubject = await academics.classSubject.findFirst({
        where: { classId: classInfo.id, subjectId: subject.id, academicYearId: SCHOOL_YEAR_ID, combinationId: comboId },
      });
      if (existingClassSubject) {
        await academics.classSubject.update({
          where: { id: existingClassSubject.id },
          data: { teacherId: teacher.id, educationStage: classInfo.stage, classLevel: classInfo.level, isActive: true },
        });
      } else {
        await academics.classSubject.create({
          data: { id: classSubjectId, classId: classInfo.id, subjectId: subject.id, academicYearId: SCHOOL_YEAR_ID, teacherId: teacher.id, educationStage: classInfo.stage, classLevel: classInfo.level, combinationId: comboId, isActive: true },
        });
      }
      await academics.syllabusTracker.upsert({
        where: { classSubjectId_termId: { classSubjectId, termId: CURRENT_TERM_ID } },
        update: { totalTopics: 14, coveredTopics: 7 + (i % 6), completionPercentage: Math.round(((7 + (i % 6)) / 14) * 100), lastUpdatedById: teacher.id, notes: 'Demo weekly progress based on term scheme of work.' },
        create: { id: uuid(`syllabus-${classSubjectId}`), classSubjectId, termId: CURRENT_TERM_ID, totalTopics: 14, coveredTopics: 7 + (i % 6), completionPercentage: Math.round(((7 + (i % 6)) / 14) * 100), lastUpdatedById: teacher.id, notes: 'Demo weekly progress based on term scheme of work.' },
      });
      await academics.timetable.upsert({
        where: { id: uuid(`timetable-${classSubjectId}`) },
        update: {},
        create: { id: uuid(`timetable-${classSubjectId}`), classId: classInfo.id, subjectId: subject.id, teacherId: teacher.id, termId: CURRENT_TERM_ID, academicYearId: SCHOOL_YEAR_ID, combinationId: comboId, dayOfWeek: weekdays[i % weekdays.length], startTime: `${8 + (i % 5)}:00`, endTime: `${9 + (i % 5)}:00`, room: `Room ${classInfo.level}${classInfo.stream}` },
      });
      const relevantTypes = assessmentTypes.filter((t) => t.stage === classInfo.stage).slice(0, 2);
      for (const type of relevantTypes) {
        const assessmentId = uuid(`assessment-${classSubjectId}-${type.code}`);
        await academics.assessment.upsert({
          where: { classSubjectId_assessmentTypeId_termId: { classSubjectId, assessmentTypeId: type.id, termId: CURRENT_TERM_ID } },
          update: { status: type.code === 'CAT1' ? 'HOD_APPROVED' : 'SUBMITTED', submittedAt: date(-5), submittedById: teacher.id },
          create: { id: assessmentId, classSubjectId, assessmentTypeId: type.id, subjectId: subject.id, classId: classInfo.id, educationStage: classInfo.stage, classLevel: classInfo.level, combinationId: comboId, termId: CURRENT_TERM_ID, academicYearId: SCHOOL_YEAR_ID, name: `${subject.name} ${type.code} Term 2`, maxScore: 100, date: date(-20 + i), status: type.code === 'CAT1' ? 'HOD_APPROVED' : 'SUBMITTED', submittedAt: date(-5), submittedById: teacher.id },
        });
        await academics.approvalLog.upsert({
          where: { id: uuid(`approval-${assessmentId}`) },
          update: {},
          create: { id: uuid(`approval-${assessmentId}`), assessmentId, action: type.code === 'CAT1' ? 'APPROVED' : 'SUBMITTED', performedById: type.code === 'CAT1' ? ids.users['hod-science'] || teacher.id : teacher.id, performedByRole: type.code === 'CAT1' ? 'HEAD_OF_DEPARTMENT' : 'TEACHER', note: 'Demo marks workflow event.' },
        });
        const enrolled = ids.classStudents[classInfo.id] || [];
        for (let si = 0; si < enrolled.length; si++) {
          const score = scoreFor(si + classInfo.level, i, type.code === 'CAT1' ? 1 : 2);
          await academics.mark.upsert({
            where: { assessmentId_studentId: { assessmentId, studentId: enrolled[si] } },
            update: { score, enteredById: teacher.id },
            create: { id: uuid(`mark-${assessmentId}-${enrolled[si]}`), assessmentId, classSubjectId, studentId: enrolled[si], score, enteredById: teacher.id, lastEditedById: teacher.id },
          });
        }
      }
    }
  }

  for (const cs of ids.classSubjects) {
    const enrolled = ids.classStudents[cs.classId] || [];
    for (let si = 0; si < enrolled.length; si++) {
      const total = Math.round((scoreFor(si + cs.level, cs.subjectIndex, 1) * 0.4 + scoreFor(si + cs.level, cs.subjectIndex, 2) * 0.6) * 10) / 10;
      const [g, points, remark, pass] = grade(cs.stage, total);
      await academics.termResult.upsert({
        where: { studentId_classSubjectId_termId: { studentId: enrolled[si], classSubjectId: cs.id, termId: CURRENT_TERM_ID } },
        update: { weightedTotal: total, grade: g, gradePoints: points, remark, isPassing: pass, rank: si + 1, totalStudentsInClass: enrolled.length, isPublished: true, publishedAt: date(-1), publishedById: ids.users.principal },
        create: { id: uuid(`term-result-${enrolled[si]}-${cs.id}`), studentId: enrolled[si], classId: cs.classId, classSubjectId: cs.id, subjectId: cs.subjectId, subjectName: cs.subjectName, educationStage: cs.stage, classLevel: cs.level, termId: CURRENT_TERM_ID, academicYearId: SCHOOL_YEAR_ID, assessmentScores: { CAT1: scoreFor(si + cs.level, cs.subjectIndex, 1), FINAL: scoreFor(si + cs.level, cs.subjectIndex, 2) }, weightedTotal: total, grade: g, gradePoints: points, remark, isPassing: pass, rank: si + 1, totalStudentsInClass: enrolled.length, teacherId: cs.teacherId, isPublished: true, publishedAt: date(-1), publishedById: ids.users.principal },
      });
      await students.performanceSnapshot.upsert({
        where: { studentId_subjectId_termId: { studentId: enrolled[si], subjectId: cs.subjectId, termId: CURRENT_TERM_ID } },
        update: { score: total, grade: g },
        create: { id: uuid(`snapshot-${enrolled[si]}-${cs.subjectId}`), studentId: enrolled[si], subjectId: cs.subjectId, subjectName: cs.subjectName, classId: cs.classId, termId: CURRENT_TERM_ID, academicYearId: SCHOOL_YEAR_ID, score: total, grade: g, assessmentBreakdown: { CAT1: scoreFor(si + cs.level, cs.subjectIndex, 1), FINAL: scoreFor(si + cs.level, cs.subjectIndex, 2) }, rank: si + 1, totalStudentsInClass: enrolled.length, teacherId: cs.teacherId },
      });
      await students.performanceTrend.upsert({
        where: { studentId_subjectId: { studentId: enrolled[si], subjectId: cs.subjectId } },
        update: { currentScore: total, averageScore: total - 2, highestScore: Math.min(100, total + 7), lowestScore: Math.max(0, total - 12) },
        create: { id: uuid(`trend-${enrolled[si]}-${cs.subjectId}`), studentId: enrolled[si], subjectId: cs.subjectId, subjectName: cs.subjectName, currentScore: total, previousScore: total - 5, averageScore: total - 2, highestScore: Math.min(100, total + 7), lowestScore: Math.max(0, total - 12), trendDirection: total >= 70 ? 'IMPROVING' : total < 45 ? 'DECLINING' : 'STABLE', trendSlope: total >= 70 ? 4 : total < 45 ? -6 : 1, consecutiveDeclines: total < 45 ? 2 : 0, consecutiveImprovements: total >= 70 ? 2 : 0, termCount: 3 },
      });
      if (total < 45 || total > 85) {
        const snapId = uuid(`snapshot-${enrolled[si]}-${cs.subjectId}`);
        await students.performanceAlert.upsert({
          where: { id: uuid(`alert-${enrolled[si]}-${cs.subjectId}`) },
          update: {},
          create: { id: uuid(`alert-${enrolled[si]}-${cs.subjectId}`), studentId: enrolled[si], subjectId: cs.subjectId, subjectName: cs.subjectName, alertType: total < 45 ? 'AT_RISK' : 'CONSISTENT_EXCELLENCE', severity: total < 45 ? 'HIGH' : 'LOW', message: total < 45 ? `${cs.subjectName} requires intervention.` : `${cs.subjectName} excellence trend detected.`, triggeredBySnapshotId: snapId, currentScore: total, thresholdValue: total < 45 ? 50 : 85, trendSlope: total < 45 ? -6 : 4, isResolved: total > 85, resolvedAt: total > 85 ? date(-1) : null, resolvedById: total > 85 ? cs.teacherId : null, resolutionNote: total > 85 ? 'Recognized as a model learner.' : null },
        });
      }
    }
  }

  for (const classInfo of Object.values(ids.classes)) {
    const enrolled = ids.classStudents[classInfo.id] || [];
    const subjectsInClass = ids.classSubjects.filter((cs) => cs.classId === classInfo.id);
    for (let si = 0; si < enrolled.length; si++) {
      const totals = subjectsInClass.map((cs) => scoreFor(si + classInfo.level, cs.subjectIndex, 2));
      const avg = Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10;
      const [g, points, remark] = grade(classInfo.stage, avg);
      await academics.reportCard.upsert({
        where: { studentId_termId: { studentId: enrolled[si], termId: CURRENT_TERM_ID } },
        update: { overallAverage: avg, overallGrade: g, overallPoints: points, overallRemark: remark, isPublished: true },
        create: { id: uuid(`report-card-${enrolled[si]}`), studentId: enrolled[si], classId: classInfo.id, educationStage: classInfo.stage, classLevel: classInfo.level, combinationId: classInfo.stage === 'A_LEVEL' ? uuid(`combo-${classInfo.stream}`) : null, termId: CURRENT_TERM_ID, academicYearId: SCHOOL_YEAR_ID, overallAverage: avg, overallGrade: g, overallPoints: points, overallRemark: remark, divisionSummary: { division: avg > 75 ? 'I' : avg > 60 ? 'II' : avg > 45 ? 'III' : 'IV' }, rank: si + 1, totalStudentsInClass: enrolled.length, subjectCount: subjectsInClass.length, failingSubjectCount: totals.filter((t) => t < 40).length, teacherComment: 'Consistent effort observed. Maintain revision discipline.', principalComment: 'Approved for parent review.', principalSignedAt: date(-1), principalSignedById: ids.users.principal, isPublished: true, publishedAt: date(-1), publishedById: ids.users.principal, behaviourGrade: classInfo.stage === 'PRIMARY' ? 'A' : null, socialSkillsGrade: classInfo.stage === 'PRIMARY' ? 'B' : null, extraCurricularNote: 'Participates in clubs and games.', readingAbility: classInfo.stage === 'PRIMARY' ? 'Age appropriate' : null, writingAbility: classInfo.stage === 'PRIMARY' ? 'Good' : null, numeracyAbility: classInfo.stage === 'PRIMARY' ? 'Good' : null },
      });
    }
  }
}

async function seedFinance() {
  console.log('Seeding finance structures, invoices, payments, receipts, assets and audits...');
  for (let i = 0; i < [['TUITION', 'Tuition Fee', false], ['MEAL', 'Meal Plan', true], ['TRANSPORT', 'Transport Fee', true], ['BOARDING', 'Boarding Fee', true], ['EXAM', 'Exam Fee', false]].length; i++) {
    const [code, name, optional] = [['TUITION', 'Tuition Fee', false], ['MEAL', 'Meal Plan', true], ['TRANSPORT', 'Transport Fee', true], ['BOARDING', 'Boarding Fee', true], ['EXAM', 'Exam Fee', false]][i];
    const id = uuid(`fee-category-${code}`);
    ids.feeCategories[code] = id;
    await finance.feeCategory.upsert({
      where: { code },
      update: { name, isOptional: optional, isActive: true },
      create: { id, code, name, isOptional: optional, isBillablePerTerm: true, isActive: true, displayOrder: i, createdById: ids.users.finance },
    });
  }
  for (const group of [['BOARDING', 'Boarding Students'], ['TRANSPORT-NORTH', 'Transport Route North'], ['SCHOLARSHIP', 'Scholarship Students']]) {
    await finance.studentGroup.upsert({
      where: { code: group[0] },
      update: { name: group[1], isActive: true },
      create: { id: uuid(`student-group-${group[0]}`), code: group[0], name: group[1], description: `Demo ${group[1].toLowerCase()}`, createdById: ids.users.finance },
    });
  }
  for (const classInfo of Object.values(ids.classes)) {
    const base = classInfo.stage === 'PRIMARY' ? 450000 : classInfo.stage === 'O_LEVEL' ? 700000 : 950000;
    for (const [code, amount] of [['TUITION', base], ['MEAL', 180000], ['EXAM', classInfo.level >= 4 ? 90000 : 50000]]) {
      await finance.feeStructure.upsert({
        where: { feeCategoryId_classId_termId_academicYearId: { feeCategoryId: ids.feeCategories[code], classId: classInfo.id, termId: CURRENT_TERM_ID, academicYearId: SCHOOL_YEAR_ID } },
        update: { amount, isActive: true },
        create: { id: uuid(`fee-structure-${classInfo.id}-${code}`), feeCategoryId: ids.feeCategories[code], classId: classInfo.id, educationStage: classInfo.stage, classLevel: classInfo.level, academicYearId: SCHOOL_YEAR_ID, termId: CURRENT_TERM_ID, amount, isActive: true, createdById: ids.users.finance },
      });
    }
  }
  for (const s of ids.students) {
    if (s.index % 5 === 0) {
      await finance.studentFeeAssignment.upsert({
        where: { studentId_feeCategoryId_academicYearId_termId: { studentId: s.id, feeCategoryId: ids.feeCategories.TRANSPORT, academicYearId: SCHOOL_YEAR_ID, termId: CURRENT_TERM_ID } },
        update: { isActive: true },
        create: { id: uuid(`fee-assignment-${s.id}-transport`), studentId: s.id, feeCategoryId: ids.feeCategories.TRANSPORT, academicYearId: SCHOOL_YEAR_ID, termId: CURRENT_TERM_ID, assignedById: ids.users.finance, notes: 'Uses school transport.' },
      });
    }
    const classInfo = Object.values(ids.classes).find((c) => c.id === s.classId);
    const total = classInfo.stage === 'PRIMARY' ? 680000 : classInfo.stage === 'O_LEVEL' ? 1020000 : 1320000;
    const paidRatio = s.index % 9 === 0 ? 0.15 : s.index % 5 === 0 ? 0.55 : s.index % 4 === 0 ? 1 : 0.82;
    const paid = Math.round(total * paidRatio);
    const status = paid >= total ? 'PAID' : paid > 0 ? 'PARTIALLY_PAID' : 'ISSUED';
    const invoiceId = uuid(`invoice-${s.id}`);
    await finance.invoice.upsert({
      where: { studentId_termId_academicYearId: { studentId: s.id, termId: CURRENT_TERM_ID, academicYearId: SCHOOL_YEAR_ID } },
      update: { totalAmount: total, paidAmount: paid, outstandingBalance: total - paid, status },
      create: { id: invoiceId, invoiceNumber: `INV-2026-${String(s.index).padStart(5, '0')}`, studentId: s.id, classId: s.classId, educationStage: s.stage, classLevel: s.level, academicYearId: SCHOOL_YEAR_ID, termId: CURRENT_TERM_ID, subtotal: total, totalAmount: total, paidAmount: paid, outstandingBalance: total - paid, status, dueDate: date(21), issuedAt: date(-25), issuedById: ids.users.finance },
    });
    for (const code of ['TUITION', 'MEAL', 'EXAM']) {
      await finance.invoiceLineItem.upsert({
        where: { id: uuid(`line-${invoiceId}-${code}`) },
        update: {},
        create: { id: uuid(`line-${invoiceId}-${code}`), invoiceId, feeStructureId: uuid(`fee-structure-${s.classId}-${code}`), feeCategoryId: ids.feeCategories[code], feeCategoryName: code, amount: code === 'TUITION' ? total - 230000 : code === 'MEAL' ? 180000 : 50000, isPaid: paid >= total },
      });
    }
    if (paid > 0) {
      const paymentId = uuid(`payment-${s.id}`);
      const receiptId = uuid(`receipt-${s.id}`);
      await finance.payment.upsert({
        where: { paymentNumber: `PAY-2026-${String(s.index).padStart(5, '0')}` },
        update: { amount: paid, status: 'CONFIRMED', receiptId },
        create: { id: paymentId, paymentNumber: `PAY-2026-${String(s.index).padStart(5, '0')}`, invoiceId, studentId: s.id, amount: paid, method: s.index % 3 === 0 ? 'CASH' : s.index % 3 === 1 ? 'MOBILE_MONEY' : 'BANK_TRANSFER', status: 'CONFIRMED', referenceNumber: `REF${2026}${String(s.index).padStart(5, '0')}`, payerName: `${s.name} Guardian`, payerPhone: '+255712345678', paidAt: date(-10 + (s.index % 8)), confirmedAt: date(-9 + (s.index % 8)), confirmedById: ids.users.finance, receiptId },
      });
      await finance.receipt.upsert({
        where: { receiptNumber: `RCT-2026-${String(s.index).padStart(5, '0')}` },
        update: { amount: paid },
        create: { id: receiptId, receiptNumber: `RCT-2026-${String(s.index).padStart(5, '0')}`, paymentId, invoiceId, studentId: s.id, studentName: s.name, classId: s.classId, educationStage: s.stage, classLevel: s.level, termId: CURRENT_TERM_ID, academicYearId: SCHOOL_YEAR_ID, amount: paid, method: s.index % 3 === 0 ? 'CASH' : s.index % 3 === 1 ? 'MOBILE_MONEY' : 'BANK_TRANSFER', referenceNumber: `REF${2026}${String(s.index).padStart(5, '0')}`, paidAt: date(-10 + (s.index % 8)), issuedById: ids.users.finance },
      });
    }
  }
  for (let i = 1; i <= 18; i++) {
    await finance.asset.upsert({
      where: { assetNumber: `AST-2026-${String(i).padStart(4, '0')}` },
      update: { status: i % 9 === 0 ? 'UNDER_MAINTENANCE' : 'ACTIVE' },
      create: { id: uuid(`asset-${i}`), assetNumber: `AST-2026-${String(i).padStart(4, '0')}`, name: pick(['School Bus', 'Physics Lab Microscope', 'Library Shelf', 'Classroom Desks', 'Projector', 'Generator', 'Water Tank', 'ICT Lab Desktop'], i), category: pick(['VEHICLE', 'LABORATORY', 'LIBRARY', 'FURNITURE', 'ELECTRONICS', 'EQUIPMENT'], i), type: i % 2 === 0 ? 'FIXED' : 'MOVABLE', purchaseDate: date(-500 - i), purchaseCost: 1200000 + i * 250000, currentValue: 900000 + i * 180000, location: pick(['Main Campus', 'Science Lab', 'Library', 'ICT Lab', 'Administration Block'], i), condition: i % 5 === 0 ? 'FAIR' : 'GOOD', status: i % 9 === 0 ? 'UNDER_MAINTENANCE' : 'ACTIVE', assignedTo: pick(ids.teachers, i).id, createdById: ids.users.finance },
    });
  }
}

async function seedElearning() {
  console.log('Seeding e-learning courses, lessons, materials, assignments, quizzes and progress...');
  const targetClassSubjects = ids.classSubjects.filter((_, i) => i % 5 === 0).slice(0, 16);
  for (const cs of targetClassSubjects) {
    const classInfo = Object.values(ids.classes).find((c) => c.id === cs.classId);
    const courseId = uuid(`course-${cs.id}`);
    await elearning.courseSpace.upsert({
      where: { classSubjectId_termId: { classSubjectId: cs.id, termId: CURRENT_TERM_ID } },
      update: { status: 'ACTIVE', enrolledCount: (ids.classStudents[cs.classId] || []).length },
      create: { id: courseId, classSubjectId: cs.id, teacherId: cs.teacherId, termId: CURRENT_TERM_ID, academicYearId: SCHOOL_YEAR_ID, subjectName: cs.subjectName, className: `${classInfo.name} ${classInfo.stream}`, educationStage: cs.stage, classLevel: cs.level, combinationId: classInfo.stage === 'A_LEVEL' ? uuid(`combo-${classInfo.stream}`) : null, description: `Complete ${cs.subjectName} learning space with notes, assignments and quizzes.`, coverColor: pick(['#0f766e', '#1d4ed8', '#b45309', '#7c3aed'], cs.subjectIndex), coverEmoji: 'BOOK', status: 'ACTIVE', publishedAt: date(-30), enrolledCount: (ids.classStudents[cs.classId] || []).length },
    });
    for (const studentId of ids.classStudents[cs.classId] || []) {
      await elearning.courseEnrollment.upsert({
        where: { courseSpaceId_studentId: { courseSpaceId: courseId, studentId } },
        update: { status: 'ACTIVE', lastActivityAt: date(-1) },
        create: { id: uuid(`course-enrol-${courseId}-${studentId}`), courseSpaceId: courseId, studentId, status: 'ACTIVE', lastActivityAt: date(-1) },
      });
    }
    for (let w = 1; w <= 4; w++) {
      const lessonId = uuid(`lesson-${courseId}-${w}`);
      await elearning.lesson.upsert({
        where: { id: lessonId },
        update: { status: 'PUBLISHED' },
        create: { id: lessonId, courseSpaceId: courseId, title: `Week ${w}: ${pick(['Foundations', 'Worked Examples', 'Applied Practice', 'Revision Clinic'], w)}`, description: `Structured week ${w} lesson for ${cs.subjectName}.`, orderIndex: w, weekNumber: w, status: 'PUBLISHED', publishedAt: date(-28 + w), estimatedMinutes: 45 + w * 5 },
      });
      for (const material of [
        ['NOTE', 'Teacher Notes', 'Text-based notes with definitions, examples and practice prompts.'],
        ['PDF', 'Printable Revision Sheet', null],
        ['VIDEO', 'Recorded Explanation', null],
      ]) {
        const materialId = uuid(`material-${lessonId}-${material[0]}`);
        await elearning.material.upsert({
          where: { id: materialId },
          update: { status: 'PUBLISHED' },
          create: { id: materialId, lessonId, courseSpaceId: courseId, title: `${material[1]} - Week ${w}`, type: material[0], status: 'PUBLISHED', orderIndex: w, body: material[2], fileKey: material[0] === 'PDF' ? `demo/elearning/${courseId}/week-${w}.pdf` : null, fileOriginalName: material[0] === 'PDF' ? `week-${w}-${cs.subjectName}.pdf` : null, fileMimeType: material[0] === 'PDF' ? 'application/pdf' : null, fileSizeBytes: material[0] === 'PDF' ? BigInt(240000 + w * 1000) : null, externalUrl: material[0] === 'VIDEO' ? 'https://example.com/demo-lesson-video' : null, downloadable: true, viewCount: 8 + w, publishedAt: date(-28 + w) },
        });
        for (const studentId of (ids.classStudents[cs.classId] || []).slice(0, 10)) {
          await elearning.materialProgress.upsert({
            where: { materialId_studentId: { materialId, studentId } },
            update: { viewedAt: date(-w), completedAt: date(-w), isDownloaded: material[0] === 'PDF' },
            create: { id: uuid(`material-progress-${materialId}-${studentId}`), materialId, courseSpaceId: courseId, studentId, viewedAt: date(-w), completedAt: date(-w), isDownloaded: material[0] === 'PDF', viewDurationSec: 300 + w * 30 },
          });
        }
      }
      const assignmentId = uuid(`assignment-${lessonId}`);
      await elearning.assignment.upsert({
        where: { id: assignmentId },
        update: { status: 'PUBLISHED' },
        create: { id: assignmentId, courseSpaceId: courseId, lessonId, title: `Week ${w} Homework`, instructions: `Answer all questions for ${cs.subjectName}. Show working and submit before the due date.`, type: 'BOTH', maxScore: 20, dueAt: date(5 + w), allowLateSubmission: true, latePenaltyPercent: 10, status: 'PUBLISHED', publishedAt: date(-20 + w) },
      });
      for (const studentId of (ids.classStudents[cs.classId] || []).slice(0, 8)) {
        const submissionId = uuid(`submission-${assignmentId}-${studentId}`);
        const score = 12 + ((studentId.charCodeAt(0) + w) % 8);
        await elearning.submission.upsert({
          where: { assignmentId_studentId: { assignmentId, studentId } },
          update: { status: 'GRADED', score, feedback: 'Good attempt. Review corrections before the next lesson.' },
          create: { id: submissionId, assignmentId, studentId, courseSpaceId: courseId, textContent: 'Demo answer: completed exercises and explanation submitted.', submittedAt: date(-2), isLate: false, status: 'GRADED', score, maxScore: 20, feedback: 'Good attempt. Review corrections before the next lesson.', gradedAt: date(-1), gradedBy: cs.teacherId },
        });
      }
    }
    const quizId = uuid(`quiz-${courseId}`);
    await elearning.quiz.upsert({
      where: { id: quizId },
      update: { status: 'PUBLISHED', totalPoints: 5 },
      create: { id: quizId, courseSpaceId: courseId, lessonId: uuid(`lesson-${courseId}-2`), title: `${cs.subjectName} Quick Check`, instructions: 'Answer all questions. Auto-marked where possible.', timeLimitMinutes: 20, maxAttempts: 2, shuffleQuestions: true, shuffleOptions: true, showCorrectAfter: 'IMMEDIATELY', passingScore: 50, status: 'PUBLISHED', publishedAt: date(-10), totalPoints: 5 },
    });
    for (let q = 1; q <= 5; q++) {
      const questionId = uuid(`quiz-question-${quizId}-${q}`);
      await elearning.quizQuestion.upsert({
        where: { id: questionId },
        update: {},
        create: { id: questionId, quizId, type: q % 3 === 0 ? 'TRUE_FALSE' : 'MULTIPLE_CHOICE', prompt: `Demo question ${q} for ${cs.subjectName}`, points: 1, orderIndex: q, explanation: 'Review the lesson notes for the explanation.', correctAnswer: q % 3 === 0 ? 'true' : null },
      });
      for (let o = 1; o <= 4; o++) {
        await elearning.quizOption.upsert({
          where: { id: uuid(`quiz-option-${questionId}-${o}`) },
          update: {},
          create: { id: uuid(`quiz-option-${questionId}-${o}`), questionId, text: q % 3 === 0 ? (o === 1 ? 'True' : o === 2 ? 'False' : `Option ${o}`) : `Option ${o}`, isCorrect: o === 1, orderIndex: o },
        });
      }
    }
    for (const studentId of (ids.classStudents[cs.classId] || []).slice(0, 8)) {
      const attemptId = uuid(`quiz-attempt-${quizId}-${studentId}`);
      const percent = 60 + (studentId.charCodeAt(1) % 35);
      await elearning.quizAttempt.upsert({
        where: { quizId_studentId_attemptNumber: { quizId, studentId, attemptNumber: 1 } },
        update: { status: 'AUTO_GRADED', percentScore: percent, isPassed: percent >= 50 },
        create: { id: attemptId, quizId, studentId, courseSpaceId: courseId, attemptNumber: 1, startedAt: date(-4), submittedAt: date(-4), timeTakenSeconds: 600, status: 'AUTO_GRADED', totalScore: Math.round(percent / 20), maxScore: 5, percentScore: percent, isPassed: percent >= 50 },
      });
    }
    await elearning.courseAnnouncement.upsert({
      where: { id: uuid(`course-announcement-${courseId}`) },
      update: { status: 'PUBLISHED' },
      create: { id: uuid(`course-announcement-${courseId}`), courseSpaceId: courseId, title: 'Weekly learning plan published', body: `New materials and homework are available for ${cs.subjectName}.`, status: 'PUBLISHED', isPinned: true, publishedAt: date(-5), createdBy: cs.teacherId },
    });
    await elearning.discussionThread.upsert({
      where: { id: uuid(`discussion-${courseId}`) },
      update: {},
      create: { id: uuid(`discussion-${courseId}`), courseSpaceId: courseId, lessonId: uuid(`lesson-${courseId}-2`), title: 'Ask questions about this week lesson', body: 'Use this thread for controlled Q&A.', authorId: cs.teacherId, authorRole: 'TEACHER', isPinned: true },
    });
  }
}

async function seedNotificationsAnalyticsOperations() {
  console.log('Seeding notifications, analytics snapshots and operational records...');
  for (const ann of [
    ['Term 2 Parent Meeting', 'Parents are invited for academic consultation and finance statement review.', ['PARENT']],
    ['Mock Examination Timetable', 'Form 4 and Form 6 mock examination timetable has been published.', ['STUDENT', 'PARENT', 'TEACHER']],
    ['E-Learning Week', 'All teachers should publish weekly materials by Monday 10:00.', ['TEACHER', 'HEAD_OF_DEPARTMENT']],
  ]) {
    await notifications.announcement.upsert({
      where: { id: uuid(`announcement-${ann[0]}`) },
      update: { status: 'PUBLISHED' },
      create: { id: uuid(`announcement-${ann[0]}`), title: ann[0], body: ann[1], authorId: ids.users.principal, authorRole: 'PRINCIPAL', targetRoles: ann[2], targetClassIds: [], channels: ['IN_APP', 'EMAIL'], priority: 'HIGH', status: 'PUBLISHED', publishedAt: date(-3), expiresAt: date(30) },
    });
  }
  for (const recipient of [...ids.students.slice(0, 25).map((s) => ({ id: s.id, role: 'STUDENT' })), ...ids.guardians.slice(0, 25).map((g) => ({ id: g.userId, role: 'PARENT' }))]) {
    await notifications.notification.upsert({
      where: { id: uuid(`notification-${recipient.id}`) },
      update: { status: 'DELIVERED' },
      create: { id: uuid(`notification-${recipient.id}`), recipientId: recipient.id, recipientRole: recipient.role, recipientEmail: `${recipient.id}@${DEMO_DOMAIN}`, channel: 'IN_APP', eventType: 'DEMO_ANNOUNCEMENT', subject: 'Demo school update', body: 'You have a new school update to review.', status: 'DELIVERED', attemptCount: 1, deliveredAt: date(-1), sourceService: 'demo-seed', metadata: { demo: true } },
    });
  }
  for (const snapshot of [
    ['school_overview', 'school', null, { students: ids.students.length, activeTeachers: ids.teachers.length, attendanceRate: 91.4, collectionRate: 82.7 }],
    ['academic_overview', 'school', null, { passRate: 78.3, atRisk: 18, excellence: 31, syllabusCompletion: 68 }],
    ['finance_collection', 'school', null, { billed: 190000000, collected: 157000000, outstanding: 33000000, collectionRate: 82.7 }],
    ['elearning_engagement', 'school', null, { activeCourses: 16, submissions: 128, quizAttempts: 128, materialViews: 480 }],
  ]) {
    await analytics.dashboardSnapshot.upsert({
      where: { snapshotType_scope_scopeId_period: { snapshotType: snapshot[0], scope: snapshot[1], scopeId: snapshot[2], period: '2026-T2' } },
      update: { data: snapshot[3], expiresAt: date(7) },
      create: { id: uuid(`snapshot-${snapshot[0]}`), snapshotType: snapshot[0], scope: snapshot[1], scopeId: snapshot[2], period: '2026-T2', data: snapshot[3], expiresAt: date(7) },
    });
  }
  for (const kpi of [['attendance_rate', 91.4], ['collection_rate', 82.7], ['pass_rate', 78.3], ['elearning_completion', 64.2]]) {
    await analytics.kpiHistory.upsert({
      where: { kpiName_scope_period: { kpiName: kpi[0], scope: 'school', period: '2026-T2' } },
      update: { value: kpi[1] },
      create: { id: uuid(`kpi-${kpi[0]}`), kpiName: kpi[0], scope: 'school', value: kpi[1], period: '2026-T2', academicYearId: SCHOOL_YEAR_ID, termId: CURRENT_TERM_ID },
    });
  }

  const opCollections = {
    'system-settings': [{ id: 'global', value: { academicYearMode: 'term-based', auditRetentionDays: 365, notificationChannels: ['in_app', 'email', 'sms'], exportFormats: ['pdf', 'xlsx', 'csv'], school: { name: 'Kilimanjaro Schools Demo Campus', timezone: 'Africa/Nairobi', currency: 'TZS' } } }],
    'staff-profiles': roleAccounts.concat(teacherSpecs.map((t) => ({ key: t[0], role: t[1], firstName: t[2], lastName: t[3], department: t[5] }))).map((s, i) => ({ id: uuid(`staff-profile-${s.key}`), staffNo: `KS-STF-${String(i + 1).padStart(3, '0')}`, name: `${s.firstName} ${s.lastName}`, role: s.role, department: s.department || 'Administration', status: 'ACTIVE', salaryBand: pick(['A', 'B', 'C', 'D'], i), reportsTo: i < 2 ? null : ids.users.principal })),
    'payroll-runs': [{ id: uuid('payroll-may-2026'), month: '2026-05', status: 'APPROVED', grossPay: 41500000, deductions: 5200000, netPay: 36300000, approvedById: ids.users.principal }],
    'leave-requests': ids.teachers.slice(0, 6).map((t, i) => ({ id: uuid(`leave-${t.id}`), staffId: t.id, type: pick(['SICK', 'ANNUAL', 'EMERGENCY'], i), status: i % 3 === 0 ? 'APPROVED' : 'PENDING', startDate: date(i + 2).toISOString(), endDate: date(i + 4).toISOString(), reason: 'Demo leave workflow' })),
    'library-books': Array.from({ length: 40 }, (_, i) => ({ id: uuid(`book-${i}`), accessionNo: `LIB-${String(i + 1).padStart(4, '0')}`, title: pick(['Advanced Biology', 'Primary English Reader', 'Mathematics Workbook', 'History of East Africa', 'Physics Practical Guide'], i), category: pick(['Science', 'Languages', 'Mathematics', 'Humanities'], i), copies: 3 + (i % 4), available: 1 + (i % 3) })),
    'library-borrowings': ids.students.slice(0, 30).map((s, i) => ({ id: uuid(`borrow-${s.id}`), studentId: s.id, bookId: uuid(`book-${i % 40}`), borrowedAt: date(-10 + i % 5).toISOString(), dueAt: date(7 + i % 3).toISOString(), status: i % 9 === 0 ? 'OVERDUE' : 'BORROWED', fineAmount: i % 9 === 0 ? 3000 : 0 })),
    'hostel-rooms': Array.from({ length: 12 }, (_, i) => ({ id: uuid(`hostel-room-${i}`), hostel: i % 2 === 0 ? 'Kibo House' : 'Mawenzi House', roomNo: `H-${i + 1}`, capacity: 8, occupied: 5 + (i % 4), wardenId: ids.users.registrar })),
    'hostel-allocations': ids.students.filter((s) => s.index % 6 === 0).slice(0, 30).map((s, i) => ({ id: uuid(`hostel-allocation-${s.id}`), studentId: s.id, roomId: uuid(`hostel-room-${i % 12}`), bedNo: `B${i % 8 + 1}`, status: 'ACTIVE' })),
    'transport-routes': Array.from({ length: 6 }, (_, i) => ({ id: uuid(`route-${i}`), code: `R${i + 1}`, name: pick(['Marangu Route', 'Machame Route', 'Himo Route', 'Moshi Urban Route', 'Rau Route', 'Kiboriloni Route'], i), busRegNo: `T${100 + i} KSC`, driverName: pick(['Mr Kessy', 'Mr Msangi', 'Mr Mrema'], i), morningPickup: '06:20' })),
    'transport-allocations': ids.students.filter((s) => s.index % 5 === 0).slice(0, 35).map((s, i) => ({ id: uuid(`transport-allocation-${s.id}`), studentId: s.id, routeId: uuid(`route-${i % 6}`), stopName: pick(streets, i), status: 'ACTIVE' })),
    'budget-lines': ['Academic', 'Transport', 'Boarding', 'ICT', 'Maintenance', 'Library'].map((name, i) => ({ id: uuid(`budget-${name}`), department: name, allocated: 8000000 + i * 2500000, spent: 3500000 + i * 1100000, fiscalYear: '2026' })),
    'cash-drawers': [{ id: uuid('cash-drawer-open'), status: 'OPEN', openedById: ids.users.finance, openingFloat: 250000, openedAt: date(0).toISOString(), note: 'Demo front office collection drawer' }],
    'bank-reconciliation-matches': Array.from({ length: 12 }, (_, i) => ({ id: uuid(`bank-match-${i}`), bankReference: `BANKREF${i + 100}`, paymentNumber: `PAY-2026-${String(i + 1).padStart(5, '0')}`, amount: 250000 + i * 50000, status: i % 4 === 0 ? 'PENDING' : 'CONFIRMED' })),
    'engine-runs': [{ id: uuid('engine-run-current'), status: 'COMPLETED', startedAt: date(-1).toISOString(), completedAt: date(-1).toISOString(), alertsGenerated: 42, pairingsSuggested: 18, runById: ids.users.aqa }],
    'report-jobs': [{ id: uuid('report-job-board'), type: 'BOARD_EXECUTIVE', title: 'Board Executive Demo Report', status: 'READY', requestedById: ids.users.principal, requestedByRole: 'PRINCIPAL', format: 'PDF', rowCount: 120, completedAt: date(-1).toISOString() }],
    'feature-flags': [{ id: 'mobile-live-api', key: 'mobile-live-api', enabled: false, audienceJson: {} }, { id: 'finance-reconciliation', key: 'finance-reconciliation', enabled: true, audienceJson: { roles: ['FINANCE'] } }],
  };

  for (const [collection, records] of Object.entries(opCollections)) {
    await operations.operationRecord.deleteMany({ where: { collection } });
    for (const record of records) {
      const now = new Date().toISOString();
      const data = { ...record, createdAt: record.createdAt || now, updatedAt: record.updatedAt || now };
      await operations.operationRecord.upsert({
        where: { collection_id: { collection, id: record.id } },
        update: { data, updatedAt: new Date(data.updatedAt) },
        create: { collection, id: record.id, data, createdAt: new Date(data.createdAt), updatedAt: new Date(data.updatedAt) },
      });
    }
  }
}

function writeCredentials() {
  const lines = [
    '# Demo Login Credentials',
    '',
    'Generated by `backend/scripts/seed-production-demo.js`.',
    '',
    '| Label | Role | Email | Registration Number | Password |',
    '|---|---|---|---|---|',
  ];
  for (const c of credentials) {
    lines.push(`| ${c.label} | ${c.role} | ${c.email} | ${c.registrationNumber || '-'} | ${c.password} |`);
  }
  lines.push('', '## Main Role Passwords', '');
  for (const [key, password] of Object.entries(PASSWORDS)) lines.push(`- ${key}: \`${password}\``);
  fs.writeFileSync(path.join(repoRoot, 'docs', 'demo-login-credentials.md'), `${lines.join('\n')}\n`);
}

async function validateCounts() {
  const counts = {
    authUsers: await auth.user.count(),
    students: await students.student.count(),
    guardians: await students.guardian.count(),
    attendance: await students.attendanceRecord.count(),
    subjects: await academics.subject.count(),
    classSubjects: await academics.classSubject.count(),
    assessments: await academics.assessment.count(),
    marks: await academics.mark.count(),
    reportCards: await academics.reportCard.count(),
    invoices: await finance.invoice.count(),
    payments: await finance.payment.count(),
    courses: await elearning.courseSpace.count(),
    lessons: await elearning.lesson.count(),
    assignments: await elearning.assignment.count(),
    quizzes: await elearning.quiz.count(),
    notifications: await notifications.notification.count(),
    operationRecords: await operations.operationRecord.count(),
  };
  console.log('Demo seed counts:', JSON.stringify(counts, null, 2));
  if (counts.students < 200) throw new Error(`Expected at least 200 students, found ${counts.students}`);
  if (!counts.courses || !counts.invoices || !counts.reportCards) throw new Error('Critical demo modules are empty.');
}

async function main() {
  console.log(`Using database: ${process.env.DATABASE_URL.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@')}`);
  const hashes = await seedAuthUsers();
  await seedStudentStructure();
  await seedStudentsAndGuardians(hashes);
  await seedAcademics();
  await seedFinance();
  await seedElearning();
  await seedNotificationsAnalyticsOperations();
  writeCredentials();
  await validateCounts();
  console.log('Production-like demo seed completed.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all([
      auth.$disconnect(),
      students.$disconnect(),
      academics.$disconnect(),
      finance.$disconnect(),
      elearning.$disconnect(),
      notifications.$disconnect(),
      analytics.$disconnect(),
      operations.$disconnect(),
    ]);
  });
