// Run only against a disposable database initialized with scripts/prepare-school-test.py.
require('reflect-metadata');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { ConfigService } = require('@nestjs/config');
const { JwtService } = require('../services/auth-service/node_modules/@nestjs/jwt');
const { UsersService } = require('../services/auth-service/dist/src/users/users.service');
const { AuthService } = require('../services/auth-service/dist/src/auth/auth.service');
const { PrismaClient } = require('../services/auth-service/generated/prisma');
const { PrismaService: StudentPrisma } = require('../services/student-service/dist/prisma/prisma.service');
const { PrismaService: AcademicPrisma } = require('../services/academic-service/dist/src/prisma/prisma.service');
const { runWithIdentity, hasAnyRole, isTeacherOnly, identityHeaders, installSchoolScope } = require('../shared/security');
const url = process.env.SCHOOL_TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.includes('test')) throw new Error('SCHOOL_TEST_DATABASE_URL must explicitly identify a disposable test database');
process.env.DATABASE_URL = url;
const p = new PrismaClient({ datasources: { db: { url } } });
const students = new StudentPrisma();
const academics = new AcademicPrisma();
const config = new ConfigService({ LOGIN_MAX_ATTEMPTS: 10 });
const published = [];
const rmq = { publish: async (key, value) => published.push({ key, value }) };
const audit = { createLog: async data => p.auditLog.create({ data }) };
const users = new UsersService(p, audit, rmq, config);
const fakeRedis = { incrWithExpiry: async () => 1, get: async () => null, set: async () => {} };
const auth = new AuthService(users, p, new JwtService({ secret: 'integration-only-secret' }), config, audit, fakeRedis, rmq);
const a = randomUUID(), b = randomUUID();
let global, adminA, adminB, dual, yearA, yearB, classA, classB;
const scope = (schoolId, fn) => runWithIdentity({ id: adminA?.id, role: 'SYSTEM_ADMIN', roles: ['SYSTEM_ADMIN'], schoolId }, fn);
const userData = (email, schoolId, role = 'SYSTEM_ADMIN') => ({ email, schoolId, firstName: 'Test', lastName: 'Admin', passwordHash: 'fixture', role, roles: { create: { role } } });
before(async () => {
 await p.school.createMany({ data: [{ id: a, code: a, name: 'School A' }, { id: b, code: b, name: 'School B' }] });
 global = await p.user.create({ data: userData(`${randomUUID()}@test.local`, null) });
 adminA = await p.user.create({ data: userData(`${randomUUID()}@test.local`, a) });
 adminB = await p.user.create({ data: userData(`${randomUUID()}@test.local`, b) });
 yearA = await scope(a, () => students.academicYear.create({ data: { name: `Year-${a}`, startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), isCurrent: true } }));
 yearB = await scope(b, () => students.academicYear.create({ data: { name: `Year-${b}`, startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), isCurrent: true } }));
 classA = await scope(a, () => students.class.create({ data: { name: 'Form A', level: 1, academicYearId: yearA.id } }));
 classB = await scope(b, () => students.class.create({ data: { name: 'Form A', level: 1, academicYearId: yearB.id } }));
});
after(async () => { await Promise.all([p.$disconnect(), students.$disconnect(), academics.$disconnect()]); });

test('multi-role creation persists school, assignments, primary alias and safe fields', async () => {
 dual = await users.createUser({ firstName: ' Asha ', lastName: ' Mushi ', email: `DUAL-${a}@TEST.LOCAL`, roles: ['TEACHER','HEAD_OF_DEPARTMENT'], primaryRole: 'HEAD_OF_DEPARTMENT' }, adminA.id);
 assert.equal(dual.schoolId, a); assert.equal(dual.role, 'HEAD_OF_DEPARTMENT'); assert.equal(dual.primaryRole, dual.role);
 assert.deepEqual(dual.roles, ['HEAD_OF_DEPARTMENT','TEACHER']); assert.equal(dual.passwordHash, undefined);
 assert.equal(dual.email, `dual-${a}@test.local`);
 assert.equal(published.at(-1).value.schoolId, a);
});
test('role validation rejects empty, duplicate and absent primary roles', async () => {
 for (const roles of [[], ['TEACHER','TEACHER'], ['TEACHER']]) await assert.rejects(users.createUser({ firstName:'A',lastName:'B',email:`${randomUUID()}@test.local`,roles,primaryRole:'HEAD_OF_DEPARTMENT' }, adminA.id));
});
test('school admin cannot create or list in another school', async () => {
 await assert.rejects(users.createUser({firstName:'A',lastName:'B',email:`${randomUUID()}@test.local`,role:'TEACHER',schoolId:b},adminA.id), /another school/);
 await assert.rejects(users.listUsers({ schoolId:b,page:1,limit:100 },adminA.id), /another school/);
 const list=await users.listUsers({page:1,limit:100},adminA.id); assert.ok(list.items.every(u=>u.schoolId===a));
});
test('all user administration actions reject another-school targets', async () => {
 const actions=[()=>users.authorizeTarget(adminB.id,adminA.id),()=>users.updateUser(adminB.id,{email:'x@test.local'},adminA.id),()=>users.activateUser(adminB.id,adminA.id),()=>users.deactivateUser(adminB.id,adminA.id),()=>users.unlockUser(adminB.id,adminA.id),()=>users.resetPassword(adminB.id,{},adminA.id),()=>users.inviteUser(adminB.id,adminA.id),()=>users.listSessions(adminB.id,adminA.id),()=>users.revokeAllSessions(adminB.id,adminA.id)];
 for(const action of actions) await assert.rejects(action,/User not found/);
});
test('global administrator must select an active school', async () => {
 const dto={firstName:'A',lastName:'B',email:`${randomUUID()}@test.local`,role:'TEACHER'};
 await assert.rejects(users.createUser(dto,global.id),/Select a school/);
 assert.equal((await users.createUser({...dto,schoolId:b},global.id)).schoolId,b);
});
test('profile update normalizes fields, revokes sessions, and writes dedicated audits', async () => {
 await p.user.update({where:{id:dual.id},data:{isEmailVerified:true}});
 await p.refreshToken.create({data:{tokenHash:randomUUID(),userId:dual.id,expiresAt:new Date(Date.now()+60000)}});
 const old=await p.user.findUnique({where:{id:dual.id}});
 const updated=await users.updateUser(dual.id,{email:` NEW-${a}@TEST.LOCAL `,phoneNumber:'0712 345 678',department:'Science'},adminA.id);
 assert.equal(updated.email,`new-${a}@test.local`);assert.equal(updated.phoneNumber,'+255712345678');assert.equal(updated.isEmailVerified,false);
 const persisted=await p.user.findUnique({where:{id:dual.id}});assert.ok(persisted.tokenVersion>old.tokenVersion);
 assert.equal(await p.refreshToken.count({where:{userId:dual.id,isRevoked:false}}),0);
 assert.ok(await p.auditLog.findFirst({where:{action:'USER_EMAIL_CHANGED',metadata:{path:['targetUserId'],equals:dual.id}}}));
 await assert.rejects(users.updateUser(dual.id,{email:adminA.email},adminA.id),/already exists/);
});
test('login keeps legacy role and emits all role and school claims; old email fails', async () => {
 const result=await auth.login({email:`new-${a}@test.local`,password:dual.temporaryPassword},{ip:'test',userAgent:'test'});
 const payload=new JwtService({secret:'integration-only-secret'}).verify(result.accessToken);
 assert.equal(payload.schoolId,a);assert.equal(payload.role,payload.primaryRole);assert.ok(payload.roles.includes('TEACHER'));assert.ok(payload.roles.includes('HEAD_OF_DEPARTMENT'));assert.equal(typeof payload.tokenVersion,'number');
 await assert.rejects(auth.login({email:dual.email,password:dual.temporaryPassword},{ip:'test',userAgent:'test'}),/Invalid credentials/);
 const refreshed=await auth.refresh(result.refreshToken,{ip:'test',userAgent:'test'});assert.equal(refreshed.user.schoolId,a);
 await assert.rejects(auth.refresh(result.refreshToken,{ip:'test',userAgent:'test'}));
});
test('any assigned role grants permission without losing HOD scope', () => {
 const identity={role:'TEACHER',roles:['TEACHER','HEAD_OF_DEPARTMENT'],schoolId:a};
 assert.ok(hasAnyRole(identity,['HEAD_OF_DEPARTMENT']));assert.ok(hasAnyRole(identity,['TEACHER']));assert.equal(isTeacherOnly(identity),false);assert.equal(hasAnyRole(identity,['FINANCE']),false);
 assert.equal(identityHeaders(identity)['X-User-Roles'],'TEACHER,HEAD_OF_DEPARTMENT');
});
test('role lookup includes multi-role user exactly once and requires school', async () => {
 const data=await auth.getUsersByRoleInternal('TEACHER,HEAD_OF_DEPARTMENT',a);assert.equal(data.users.filter(u=>u.id===dual.id).length,1);assert.ok(data.users.every(u=>u.schoolId===a));
 await assert.rejects(auth.getUsersByRoleInternal('TEACHER'));
});
test('staff validation and commit are school-fixed and all-or-nothing', async () => {
 const prefix=randomUUID();const rows=Array.from({length:50},(_,i)=>({rowNumber:i+2,firstName:'Import',lastName:String(i),email:`${prefix}-${i}@test.local`,roles:['TEACHER','HEAD_OF_DEPARTMENT'],primaryRole:'HEAD_OF_DEPARTMENT'}));
 const validated=await users.bulkCreate({schoolId:b,mode:'VALIDATE_ONLY',rows},global.id);assert.equal(validated.valid,true);assert.equal(validated.createdCount,0);
 assert.equal(await p.user.count({where:{email:{startsWith:prefix}}}),0);
 const bad=await users.bulkCreate({schoolId:b,mode:'COMMIT',rows:[...rows,{...rows[0],rowNumber:52}]},global.id);assert.equal(bad.valid,false);assert.equal(await p.user.count({where:{email:{startsWith:prefix}}}),0);
 const malicious=await users.bulkCreate({schoolId:b,mode:'COMMIT',rows:[{...rows[0],schoolId:a}]},global.id);assert.equal(malicious.valid,false);
 const committed=await users.bulkCreate({schoolId:b,mode:'COMMIT',rows},global.id);assert.equal(committed.createdCount,50);assert.equal(await p.user.count({where:{schoolId:b,email:{startsWith:prefix}}}),50);
});
test('domain list, count, direct lookup and mutation enforce school scope', async () => {
 const rows=await scope(a,()=>students.class.findMany());assert.ok(rows.every(row=>row.schoolId===a));
 assert.equal(await scope(a,()=>students.class.findUnique({where:{id:classB.id}})),null);
 await assert.rejects(scope(a,()=>students.class.update({where:{id:classB.id},data:{name:'Leaked'}})));
 assert.equal((await scope(a,()=>students.class.updateMany({where:{id:classB.id},data:{name:'Leaked'}}))).count,0);
 await assert.rejects(students.class.findMany(),/School context/);
 await assert.rejects(scope(a,()=>students.class.create({data:{name:'Bad',level:1,academicYearId:yearB.id}})));
});
test('nested relations inherit school and reject cross-school links', async () => {
 const subject=await scope(a,()=>academics.subject.create({data:{name:'Science',code:randomUUID()}}));
 await assert.rejects(scope(b,()=>academics.classSubject.create({data:{classId:classB.id,subjectId:subject.id,academicYearId:yearB.id,teacherId:dual.id}})));
 const scale=await scope(a,()=>academics.gradingScale.create({data:{name:'Scale',academicYearId:yearA.id,grades:{create:{grade:'A',minScore:80,maxScore:100,points:1,remark:'Excellent'}}},include:{grades:true}}));
 assert.equal(scale.grades[0].schoolId,a);
});
test('student import creates one school-owned graph and retry does not duplicate it', async () => {
 const batchId=randomUUID();const rows=[{first_name:'Student',last_name:'Imported',date_of_birth:'2012-01-01',gender:'FEMALE',class_name:'Form A',guardian_first_name:'Parent',guardian_phone:'0712999888'}];
 const dto={schoolId:a,batchId,rows,mode:'VALIDATE_ONLY'};assert.equal((await users.bulkStudents(dto,adminA.id)).valid,true);
 const result=await users.bulkStudents({...dto,mode:'COMMIT'},adminA.id);assert.equal(result.createdCount,1);
 assert.deepEqual(await users.bulkStudents({...dto,mode:'COMMIT'},adminA.id),result);
 const imported=await scope(a,()=>students.student.findMany({where:{lastName:'Imported'},include:{enrolments:true,parentLinks:{include:{guardian:true}}}}));
 assert.equal(imported.length,1);assert.equal(imported[0].enrolments[0].classId,classA.id);assert.equal(imported[0].parentLinks[0].guardian.schoolId,a);
 assert.equal(await scope(b,()=>students.student.count({where:{id:imported[0].id}})),0);
});
test('final administrator and school moves with dependencies are protected', async () => {
 await assert.rejects(users.deactivateUser(adminA.id,adminA.id),/final active/);
 await assert.rejects(users.updateUser(adminA.id,{roles:['TEACHER'],primaryRole:'TEACHER'},adminA.id),/final active/);
 await scope(a,()=>students.class.update({where:{id:classA.id},data:{classTeacherId:dual.id}}));
 await assert.rejects(users.updateUser(dual.id,{schoolId:b,schoolChangeReason:'Move'},global.id),/dependencies/);
});

test('HTTP user editing uses verified JWTs, invalidates old access, and scopes detail responses', async () => {
 const { Test } = require('@nestjs/testing');
 const { ValidationPipe } = require('@nestjs/common');
 const { generateKeyPairSync } = require('node:crypto');
 const request = require('supertest');
 const { UsersController } = require('../services/auth-service/dist/src/users/users.controller');
 const { JwtStrategy } = require('../services/auth-service/dist/src/auth/strategies/jwt.strategy');
 const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
 const strategy = new JwtStrategy(new ConfigService({ JWT_PUBLIC_KEY: publicKey }), fakeRedis, p);
 const module = await Test.createTestingModule({ controllers: [UsersController], providers: [{ provide: UsersService, useValue: users }, { provide: JwtStrategy, useValue: strategy }] }).compile();
 const app = module.createNestApplication();
 app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
 await app.init();
 const jwt = new JwtService({ privateKey, signOptions: { algorithm: 'RS256', expiresIn: '5m' } });
 const token = u => jwt.sign({ sub: u.id, role: u.role, tokenVersion: u.tokenVersion, jti: randomUUID() });
 try {
  const adminToken = token(await p.user.findUnique({ where: { id: adminA.id } }));
  await request(app.getHttpServer()).get(`/auth/users/${adminB.id}`).set('Authorization', `Bearer ${adminToken}`).set('x-school-id', b).expect(404);
  const edited = await request(app.getHttpServer()).patch(`/auth/users/${dual.id}`).set('Authorization', `Bearer ${adminToken}`).send({ email: `http-${a}@test.local`, firstName: 'HTTP Asha' }).expect(200);
  assert.equal(edited.body.firstName, 'HTTP Asha');
  await request(app.getHttpServer()).patch(`/auth/users/${dual.id}`).set('Authorization', `Bearer ${adminToken}`).send({ name: 'Wrong DTO' }).expect(400);
  await request(app.getHttpServer()).post('/auth/users/bulk').set('Authorization', `Bearer ${adminToken}`).send({ mode: 'COMMIT', rows: [{ rowNumber: 2, firstName: 'Bad', lastName: 'Email', email: 'invalid', roles: ['TEACHER'] }] }).expect(400);
  const old = token(await p.user.findUnique({ where: { id: adminA.id } }));
  await users.updateUser(adminA.id, { firstName: 'Updated Admin' }, adminA.id);
  await request(app.getHttpServer()).get(`/auth/users/${dual.id}`).set('Authorization', `Bearer ${old}`).expect(401);
  const hod = token(await p.user.findUnique({ where: { id: dual.id } }));
  // Method policy widens list to HOD but retains admin-only editing.
  await request(app.getHttpServer()).get('/auth/users').set('Authorization', `Bearer ${hod}`).expect(200);
  await request(app.getHttpServer()).patch(`/auth/users/${dual.id}`).set('Authorization', `Bearer ${hod}`).send({ firstName: 'Forbidden' }).expect(403);
 } finally { await app.close(); }
});

test('duplicate phone accounts never choose an arbitrary school at login', async () => {
 const phone = '+255799' + String(Date.now()).slice(-6);
 await p.user.create({ data: { ...userData(`${randomUUID()}@test.local`, a, 'PARENT'), phoneNumber: phone } });
 await p.user.create({ data: { ...userData(`${randomUUID()}@test.local`, b, 'PARENT'), phoneNumber: phone } });
 assert.equal(await users.findByPhoneNumber(phone), null);
});

test('finance, notification, analytics and e-learning direct records remain school-scoped', async () => {
 const clients = ['finance-service','notification-service','analytics-service','elearning-service'].map(service => {
  const { PrismaClient } = require(`../services/${service}/generated/prisma`);
  const client = new PrismaClient({ datasources: { db: { url } } }); installSchoolScope(client); return client;
 });
 const [finance, notification, analytics, elearning] = clients;
 try {
  const category = { name: `Tuition-${a}`, code: a, createdById: adminA.id };
  const fee = await scope(a, () => finance.feeCategory.create({ data: category }));
  const otherFee = await scope(b, () => finance.feeCategory.create({ data: { ...category, createdById: adminB.id } }));
  assert.equal(await scope(b, () => finance.feeCategory.findUnique({ where: { id: fee.id } })), null);
  assert.equal(await scope(a, () => analytics.feeCategory.findUnique({ where: { id: otherFee.id } })), null);
  const template = { eventType: a, channel: 'IN_APP', name: 'Welcome', body: 'Welcome', variables: [], createdById: adminA.id };
  const notice = await scope(a, () => notification.notificationTemplate.create({ data: template }));
  await scope(b, () => notification.notificationTemplate.create({ data: { ...template, createdById: adminB.id } }));
  assert.equal(await scope(b, () => notification.notificationTemplate.findUnique({ where: { id: notice.id } })), null);
  const term = await scope(a, () => students.term.create({ data: { name: 'Term 1', academicYearId: yearA.id, startDate: new Date('2026-01-01'), endDate: new Date('2026-06-01') } }));
  const subject = await scope(a, () => academics.subject.create({ data: { name: 'English', code: randomUUID() } }));
  const teaching = await scope(a, () => academics.classSubject.create({ data: { classId: classA.id, subjectId: subject.id, teacherId: dual.id, academicYearId: yearA.id } }));
  const course = await scope(a, () => elearning.courseSpace.create({ data: { classSubjectId: teaching.id, teacherId: dual.id, academicYearId: yearA.id, termId: term.id, subjectName: 'English', className: 'Form A' } }));
  assert.equal(await scope(b, () => elearning.courseSpace.findUnique({ where: { id: course.id } })), null);
  await assert.rejects(scope(b, () => elearning.courseSpace.update({ where: { id: course.id }, data: { description: 'Forbidden' } })));
 } finally { await Promise.all(clients.map(c => c.$disconnect())); }
});

test('every downstream identity middleware rejects untrusted headers and keeps verified roles', () => {
 const previous = process.env.INTERNAL_API_KEY; process.env.INTERNAL_API_KEY = 'test-internal-only';
 const { context } = require('../shared/security');
 try {
  for (const service of ['student-service','academic-service','finance-service','notification-service','analytics-service','elearning-service']) {
   const prefix = ['student-service','notification-service'].includes(service) ? '' : 'src/';
   const { IdentityMiddleware } = require(`../services/${service}/dist/${prefix}common/middleware/identity.middleware`);
   const middleware = new IdentityMiddleware();
   assert.throws(() => middleware.use({ path:'/records', header: () => 'spoofed' }, {}, () => {}), /Invalid internal API key/);
   const headers = { 'x-internal-api-key':'test-internal-only', 'x-user-id':dual.id, 'x-user-role':'HEAD_OF_DEPARTMENT', 'x-user-roles':'TEACHER,HEAD_OF_DEPARTMENT', 'x-school-id':a };
   middleware.use({ path:'/records', header:key=>headers[key] }, {}, () => { assert.equal(context().schoolId,a); assert.ok(context().roles.includes('TEACHER')); });
  }
 } finally { if (previous === undefined) delete process.env.INTERNAL_API_KEY; else process.env.INTERNAL_API_KEY = previous; }
});

test('cache and event identities are isolated and require explicit school context', () => {
 const { cacheKey, schoolEvent } = require('../shared/security');
 assert.notEqual(scope(a, () => cacheKey('summary')), scope(b, () => cacheKey('summary')));
 assert.equal(scope(a, () => schoolEvent({ type: 'test' })).schoolId, a);
 assert.throws(() => cacheKey('summary'), /School context/);
 assert.throws(() => scope(a, () => schoolEvent({ schoolId: b })), /override/);
});

test('single student enrolment resolves selected IDs and rejects other-school IDs before writing', async () => {
 const rows=[{first_name:'Single',last_name:'Enrolment',date_of_birth:'2012-02-20',gender:'MALE',class_id:classA.id,academic_year_id:yearA.id,guardian_first_name:'Guardian',guardian_phone:'+255712399999'}];
 const dto={schoolId:a,batchId:randomUUID(),mode:'COMMIT',rows};
 const invalid=await users.bulkStudents({...dto,batchId:randomUUID(),rows:[{...rows[0],class_id:classB.id}]},adminA.id);
 assert.equal(invalid.valid,false);
 const result=await users.bulkStudents(dto,adminA.id);assert.equal(result.createdCount,1);assert.ok(result.students[0].registrationNumber);
 const student=await scope(a,()=>students.student.findUnique({where:{id:result.students[0].id}}));
 const updated=await users.updateUser(student.authUserId,{registrationNumber:`EDIT-${a}`},adminA.id);
 assert.equal(updated.registrationNumber,`EDIT-${a}`);
 assert.equal((await scope(a,()=>students.student.findUnique({where:{id:student.id}}))).registrationNumber,`EDIT-${a}`);
});

test('an in-flight credential snapshot cannot create refresh sessions after security changes', async () => {
 const snapshot=await p.user.findUnique({where:{id:dual.id}});
 await users.updateUser(dual.id,{department:'Updated department'},adminA.id);
 await assert.rejects(auth.issueTokens(snapshot,{ip:'test',userAgent:'test'}),/Session changed/);
 assert.equal(await p.refreshToken.count({where:{userId:dual.id,isRevoked:false}}),0);
});

test('notification queue statistics count only jobs belonging to the selected school', async () => {
 const { QueuesService } = require('../services/notification-service/dist/queues/queues.service');
 const queue = { getJobs: async () => [{ data: { schoolId: a } }, { data: { schoolId: b } }, { data: {} }] };
 const stats = await scope(a, () => QueuesService.prototype.stats.call({ sms: queue, email: queue, push: queue, inApp: queue }));
 for (const channel of Object.values(stats)) assert.deepEqual(Object.values(channel), [1,1,1,1,1,1]);
});

test('gateway operation records persist separately even with the same client-visible ID', async () => {
 const { OperationsStoreService } = require('../services/api-gateway/dist/src/operations/operations-store.service');
 const { OperationsController } = require('../services/api-gateway/dist/src/operations/operations.controller');
 const store = new OperationsStoreService();
 await store.onModuleInit();
 try {
  const id = randomUUID();
  scope(a, () => store.create('files', { id, originalName: 'School A file' }));
  assert.equal(scope(b, () => store.get('files', id)), undefined);
  scope(b, () => store.create('files', { id, originalName: 'School B file' }));
  assert.equal(scope(a, () => store.get('files', id)).originalName, 'School A file');
  const controller = new OperationsController(store, { envelope: data => data });
  assert.throws(() => scope(a, () => controller.createFile({ id: adminA.id, role: 'SYSTEM_ADMIN' }, { storageKey: 'disk://school-b-file.pdf' })), /upload endpoint/);
 } finally { await store.onModuleDestroy(); }
});

test('student and guardian restrictions evaluate all roles without reducing staff access', async () => {
 const { authorizeStudent } = require('../services/student-service/dist/common/helpers/student-access.helper');
 const row = await scope(a, () => students.student.findFirst({ where: { lastName: 'Imported' }, include: { parentLinks: { include: { guardian: true } } } }));
 const parentId = row.parentLinks[0].guardian.authUserId;
 await scope(a, () => authorizeStudent(students, row.id, { id: parentId, role: 'STUDENT', roles: ['STUDENT','PARENT'] }));
 await scope(a, () => authorizeStudent(students, row.id, { id: dual.id, role: 'PARENT', roles: ['PARENT','TEACHER'] }));
 await assert.rejects(scope(b, () => authorizeStudent(students, row.id, { id: parentId, role: 'PARENT', roles: ['PARENT'] })), /access denied/);
});
