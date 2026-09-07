import { isEmail } from 'class-validator';
import { BulkStudentsDto } from './dto/bulk-students.dto';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { BulkCreateUsersDto } from './dto/bulk-create-users.dto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, Prisma, Role, User } from '../../generated/prisma';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AdminResetPasswordDto } from './dto/admin-reset-password.dto';
import { getPagination } from '../common/helpers/pagination.helper';

type IdentityUser = Prisma.UserGetPayload<{ include: { roles: true; school: true } }>;
const identityInclude = { roles: true, school: true } as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly rabbitmqService: RabbitMQService,
    private readonly configService: ConfigService,
  ) {}

  static normalisePhone(phone: string): string {
    const digits = phone.replace(/[^\d]/g, '');
    if (digits.startsWith('255')) return `+${digits}`;
    if (digits.startsWith('0')) return `+255${digits.slice(1)}`;
    if (digits.length === 9) return `+255${digits}`;
    return `+${digits}`;
  }

  async findByEmail(email: string): Promise<IdentityUser | null> {
    return this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() }, include: identityInclude });
  }

  async findByRegistrationNumber(registrationNumber: string): Promise<IdentityUser | null> {
    return this.prisma.user.findUnique({ where: { registrationNumber }, include: identityInclude });
  }

  async findByPhoneNumber(phone: string): Promise<IdentityUser | null> {
    const normalised = UsersService.normalisePhone(phone);
    const matches = await this.prisma.user.findMany({
      where: { phoneNumber: { in: [normalised, phone.trim()] } }, include: identityInclude, take: 2,
    });
    // Phone login must never select an arbitrary school account.
    return matches.length === 1 ? matches[0] : null;
  }

  async findById(id: string): Promise<IdentityUser> {
    const user = await this.prisma.user.findUnique({ where: { id }, include: identityInclude });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  private roleValues(user: { role: Role; roles?: { role: Role }[] }): Role[] {
    return [...new Set([user.role, ...(user.roles || []).map(r => r.role)])];
  }

  private async actor(actorId: string) {
    const actor = await this.findById(actorId);
    if (!actor.isActive || !this.roleValues(actor).includes(Role.SYSTEM_ADMIN)) {
      throw new ForbiddenException('User administration requires SYSTEM_ADMIN');
    }
    return actor;
  }

  async authorizeTarget(userId: string, actorId: string) {
    const actor = await this.actor(actorId);
    const target = await this.prisma.user.findFirst({
      where: { id: userId, ...(actor.schoolId ? { schoolId: actor.schoolId } : {}) },
      include: identityInclude,
    });
    if (!target) throw new NotFoundException('User not found');
    return target;
  }

  async schools(actorId: string) {
    const actor = await this.actor(actorId);
    return this.prisma.school.findMany({ where: { isActive: true, ...(actor.schoolId ? { id: actor.schoolId } : {}) }, orderBy: { name: 'asc' } });
  }

  private async schoolFor(actorId: string, requested?: string) {
    const actor = await this.actor(actorId);
    if (actor.schoolId && requested && requested !== actor.schoolId) throw new ForbiddenException('Cannot select another school');
    const schoolId = actor.schoolId || requested;
    if (!schoolId) throw new BadRequestException('Select a school');
    if (!await this.prisma.school.findFirst({ where: { id: schoolId, isActive: true } })) throw new BadRequestException('School is inactive or missing');
    return schoolId;
  }

  private normalizeRoles(dto: { roles?: Role[]; primaryRole?: Role; role?: Role }, existing?: IdentityUser) {
    const roles = dto.roles ?? (dto.role ? [dto.role] : existing ? this.roleValues(existing) : []);
    if (!roles.length || roles.some(r => !Object.values(Role).includes(r))) throw new BadRequestException('At least one valid role is required');
    if (new Set(roles).size !== roles.length) throw new BadRequestException('Roles must be unique');
    const primaryRole = dto.primaryRole ?? dto.role ?? existing?.role ?? roles[0];
    if (!roles.includes(primaryRole)) throw new BadRequestException('Primary role must belong to roles');
    return { roles, primaryRole };
  }

  private async createData(dto: CreateUserDto, actorId: string, schoolId: string, hashPassword = true) {
    const { roles, primaryRole } = this.normalizeRoles(dto);
    const actor = await this.actor(actorId);
    if (actor.schoolId && roles.some(r => [Role.BOARD_DIRECTOR, Role.MANAGING_DIRECTOR].includes(r as any))) throw new ForbiddenException('Cannot assign global leadership roles');
    const email = dto.email?.trim().toLowerCase();
    if (email && !isEmail(email)) throw new BadRequestException('Invalid email');
    if (roles.some(r => ![Role.STUDENT, Role.PARENT].includes(r as any)) && !email) throw new BadRequestException('Email is required for staff');
    if (roles.includes(Role.PARENT) && !email && !dto.phoneNumber) throw new BadRequestException('Email or phone number is required for a parent');
    if (!dto.firstName?.trim() || !dto.lastName?.trim()) throw new BadRequestException('First and last name are required');
    if (dto.phoneNumber && !/^\+\d{7,15}$/.test(UsersService.normalisePhone(dto.phoneNumber))) throw new BadRequestException('Invalid phone number');
    const temporaryPassword = dto.password || this.generateTemporaryPassword();
    const data = {
      email, registrationNumber: dto.registrationNumber?.trim(), schoolId,
      passwordHash: hashPassword ? await argon2.hash(temporaryPassword) : '', role: primaryRole,
      firstName: dto.firstName.trim(), lastName: dto.lastName.trim(), department: dto.department,
      phoneNumber: dto.phoneNumber ? UsersService.normalisePhone(dto.phoneNumber) : undefined,
      isActive: dto.isActive ?? true, mustChangePassword: true, createdBy: actorId,
      roles: { create: roles.map(role => ({ role, assignedBy: actorId })) },
    };
    return { data, temporaryPassword };
  }

  private async publishCreated(user: IdentityUser) {
    const safe = this.toSafeUser(user);
    await this.rabbitmqService.publish('user.created', { ...safe, userId: user.id });
  }

  async createUser(dto: CreateUserDto, createdBy: string) {
    const schoolId = await this.schoolFor(createdBy, dto.schoolId);
    const { data, temporaryPassword } = await this.createData(dto, createdBy, schoolId);
    try {
      const user = await this.prisma.$transaction(async tx => {
        const user = await tx.user.create({ data, include: identityInclude });
        await tx.auditLog.create({ data: { userId: createdBy, action: AuditAction.USER_CREATED, metadata: { targetUserId: user.id, schoolId, roles: this.roleValues(user), primaryRole: user.role } } });
        return user;
      });
      await this.publishCreated(user);
      return { ...this.toSafeUser(user), temporaryPassword };
    } catch (error) {
      if ((error as any).code === 'P2002') throw new ConflictException('User with this identifier already exists');
      throw error;
    }
  }

  async bulkCreate(dto: BulkCreateUsersDto, actorId: string) {
    const schoolId = await this.schoolFor(actorId, dto.schoolId);
    const errors: { rowNumber: number; message: string }[] = [];
    const emails = new Set<string>();
    const registrations = new Set<string>();
    const prepared: Awaited<ReturnType<UsersService['createData']>>[] = [];
    for (const row of dto.rows) {
      try {
        if (row.schoolId !== undefined || row.password !== undefined) throw new BadRequestException('CSV rows cannot set schoolId or password');
        if (this.normalizeRoles(row).roles.some(r => [Role.STUDENT, Role.PARENT].includes(r as any))) throw new BadRequestException('Use student import for students and guardians');
        const email = row.email?.trim().toLowerCase();
        const reg = row.registrationNumber?.trim();
        if (email && (emails.has(email) || await this.findByEmail(email))) throw new ConflictException('Duplicate email');
        if (reg && (registrations.has(reg) || await this.findByRegistrationNumber(reg))) throw new ConflictException('Duplicate registration number');
        if (email) emails.add(email);
        if (reg) registrations.add(reg);
        prepared.push(await this.createData(row, actorId, schoolId, false));
      } catch (error) { errors.push({ rowNumber: row.rowNumber, message: (error as Error).message }); }
    }
    const batchId = randomUUID();
    if (errors.length || dto.mode === 'VALIDATE_ONLY') return { batchId, schoolId, valid: !errors.length, errors, createdCount: 0 };
    for (const entry of prepared) entry.data.passwordHash = await argon2.hash(entry.temporaryPassword);
    try {
      const users = await this.prisma.$transaction(async tx => {
        const users: IdentityUser[] = [];
        for (const entry of prepared) users.push(await tx.user.create({ data: entry.data, include: identityInclude }));
        await tx.auditLog.create({ data: { userId: actorId, action: AuditAction.USERS_IMPORTED, metadata: { batchId, schoolId, createdCount: users.length, userIds: users.map(u => u.id) } } });
        return users;
      }, { timeout: 30000 });
      for (const user of users) await this.publishCreated(user);
      return { batchId, schoolId, valid: true, errors: [], createdCount: users.length };
    } catch (error) {
      if ((error as any).code === 'P2002') throw new ConflictException('Import conflicts with existing users; no users were created');
      throw error;
    }
  }

  async bulkStudents(dto: BulkStudentsDto, actorId: string) {
    const schoolId = await this.schoolFor(actorId, dto.schoolId);
    const fingerprint = createHash('sha256').update(JSON.stringify(dto.rows)).digest('hex');
    const previous = await this.prisma.importBatch.findUnique({ where: { id: dto.batchId } });
    if (previous) {
      if (previous.schoolId !== schoolId || previous.actorId !== actorId || previous.fingerprint !== fingerprint) throw new ConflictException('Batch ID already used');
      return previous.result;
    }
    const errors: { rowNumber: number; message: string }[] = [];
    const prepared: any[] = [];
    const guardianEmails = new Map<string, string>();
    const allowed = new Set(['class_id','academic_year_id','first_name','middle_name','last_name','date_of_birth','gender','class_name','academic_year','admission_date','nationality','guardian_first_name','guardian_last_name','guardian_phone','guardian_email','guardian_relationship']);
    for (const [index, row] of dto.rows.entries()) {
      try {
        if (Object.keys(row).some(k => !allowed.has(k))) throw new BadRequestException('Unknown CSV column; school and passwords cannot be set per row');
        for (const key of ['first_name','last_name','date_of_birth','gender','guardian_first_name','guardian_phone']) if (typeof row[key] !== 'string' || !row[key].trim()) throw new BadRequestException(`${key} is required`);
        if (!['MALE','FEMALE'].includes(row.gender.toUpperCase())) throw new BadRequestException('Invalid gender');
        const relation = (row.guardian_relationship || 'GUARDIAN').toUpperCase();
        if (!['FATHER','MOTHER','GUARDIAN','SIBLING','OTHER'].includes(relation)) throw new BadRequestException('Invalid guardian relationship');
        for (const value of [row.date_of_birth, row.admission_date].filter(Boolean)) if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new BadRequestException('Invalid date');
        if (!row.class_id && !row.class_name?.trim()) throw new BadRequestException('Class is required');
        const years = row.academic_year_id
          ? await this.prisma.$queryRaw<any[]>`SELECT id, name FROM students."AcademicYear" WHERE "schoolId" = ${schoolId} AND id = ${row.academic_year_id}`
          : row.academic_year?.trim()
          ? await this.prisma.$queryRaw<any[]>`SELECT id, name FROM students."AcademicYear" WHERE "schoolId" = ${schoolId} AND lower(name) = ${row.academic_year.trim().toLowerCase()}`
          : await this.prisma.$queryRaw<any[]>`SELECT id, name FROM students."AcademicYear" WHERE "schoolId" = ${schoolId} AND "isCurrent" = true`;
        if (years.length !== 1) throw new BadRequestException('Select an unambiguous academic year in this school');
        const classes = row.class_id
          ? await this.prisma.$queryRaw<any[]>`SELECT id, "educationStage" FROM students."Class" WHERE "schoolId" = ${schoolId} AND "academicYearId" = ${years[0].id} AND id = ${row.class_id}`
          : await this.prisma.$queryRaw<any[]>`SELECT id, "educationStage" FROM students."Class" WHERE "schoolId" = ${schoolId} AND "academicYearId" = ${years[0].id} AND lower(name) = ${row.class_name.trim().toLowerCase()}`;
        if (classes.length !== 1) throw new BadRequestException('Class is missing or ambiguous in the selected school and year');
        const student = await this.createData({ firstName: row.first_name, lastName: row.last_name, roles: [Role.STUDENT] }, actorId, schoolId, dto.mode === 'COMMIT');
        const parent = await this.createData({ firstName: row.guardian_first_name, lastName: row.guardian_last_name || row.last_name, roles: [Role.PARENT], phoneNumber: row.guardian_phone, email: row.guardian_email || undefined }, actorId, schoolId, dto.mode === 'COMMIT');
        const parentEmail = parent.data.email;
        const parentPhone = parent.data.phoneNumber!;
        const matches = await this.prisma.user.findMany({ where: { schoolId, phoneNumber: parentPhone, roles: { some: { role: Role.PARENT } } }, include: identityInclude });
        if (matches.length > 1) throw new ConflictException('Guardian phone matches multiple accounts');
        if (parentEmail) {
          if (guardianEmails.has(parentEmail) && guardianEmails.get(parentEmail) !== parentPhone) throw new ConflictException('Guardian email is used with different phone numbers');
          const emailOwner = await this.findByEmail(parentEmail);
          if (emailOwner && emailOwner.id !== matches[0]?.id) throw new ConflictException('Guardian email belongs to a different account');
          if (matches[0]?.email && matches[0].email !== parentEmail) throw new ConflictException('Guardian email does not match the existing parent account');
          guardianEmails.set(parentEmail, parentPhone);
        }
        prepared.push({ row, student, parent, cls: classes[0], yearId: years[0].id, relation });
      } catch (error) { errors.push({ rowNumber: index + 2, message: (error as Error).message }); }
    }
    if (errors.length || dto.mode === 'VALIDATE_ONLY') return { batchId: dto.batchId, schoolId, valid: !errors.length, errors, createdCount: 0 };
    // The deployed services share PostgreSQL schemas. One database transaction
    // orchestrates auth, student and guardian writes with an idempotent batch record.
    const events: IdentityUser[] = [];
    const enrolled: { id: string; registrationNumber: string; classId: string; academicYearId: string }[] = [];
    const result = await this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${dto.batchId}))`;
      const saved = await tx.importBatch.findUnique({ where: { id: dto.batchId } });
      if (saved) {
        if (saved.schoolId !== schoolId || saved.actorId !== actorId || saved.fingerprint !== fingerprint) throw new ConflictException('Batch ID already used');
        return saved.result;
      }
      for (const entry of prepared) {
        const { row, cls, yearId, relation } = entry;
        const admission = new Date(row.admission_date || new Date().toISOString().slice(0,10));
        const year = admission.getUTCFullYear();
        const seq = await tx.$queryRaw<{ nextValue: number }[]>`INSERT INTO students."RegistrationSequenceByStage"(year,stage,"nextValue","updatedAt") VALUES (${year},${cls.educationStage},2,NOW()) ON CONFLICT (year,stage) DO UPDATE SET "nextValue"=students."RegistrationSequenceByStage"."nextValue"+1,"updatedAt"=NOW() RETURNING "nextValue"`;
        const prefix: Record<string,string> = { NURSERY:'N', PRE_UNIT:'PU', PRIMARY:'P', O_LEVEL:'O', A_LEVEL:'A' };
        const registrationNumber = `KEMS-${prefix[cls.educationStage] || 'O'}-${String(year).slice(-2)}${String(seq[0].nextValue-1).padStart(3,'0')}`;
        const studentUser = await tx.user.create({ data: { ...entry.student.data, registrationNumber }, include: identityInclude });
        const existingParents = await tx.user.findMany({ where: { schoolId, phoneNumber: entry.parent.data.phoneNumber, roles: { some: { role: Role.PARENT } } }, include: identityInclude });
        if (existingParents.length > 1) throw new ConflictException('Guardian phone matches multiple accounts');
        const parentUser = existingParents[0] || await tx.user.create({ data: entry.parent.data, include: identityInclude });
        const studentId = randomUUID();
        await tx.$executeRaw`INSERT INTO students."Student"(id,"schoolId","registrationNumber","authUserId","firstName","middleName","lastName","dateOfBirth",gender,nationality,"admissionDate","createdBy","updatedAt") VALUES (${studentId},${schoolId},${registrationNumber},${studentUser.id},${row.first_name.trim()},${row.middle_name || null},${row.last_name.trim()},${new Date(row.date_of_birth)},${row.gender.toUpperCase()}::students."Gender",${row.nationality || 'Tanzanian'},${admission},${actorId},NOW())`;
        const guardians = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM students."Guardian" WHERE "schoolId"=${schoolId} AND "authUserId"=${parentUser.id}`;
        const guardianId = guardians[0]?.id || randomUUID();
        if (!guardians.length) await tx.$executeRaw`INSERT INTO students."Guardian"(id,"schoolId","authUserId","firstName","lastName",relationship,"phoneNumber",email) VALUES (${guardianId},${schoolId},${parentUser.id},${parentUser.firstName},${parentUser.lastName},${relation}::students."GuardianRelationship",${parentUser.phoneNumber!},${parentUser.email})`;
        await tx.$executeRaw`INSERT INTO students."StudentGuardianLink"(id,"schoolId","studentId","guardianId","isPrimary") VALUES (${randomUUID()},${schoolId},${studentId},${guardianId},true)`;
        await tx.$executeRaw`INSERT INTO students."Enrolment"(id,"schoolId","studentId","classId","academicYearId") VALUES (${randomUUID()},${schoolId},${studentId},${cls.id},${yearId})`;
        enrolled.push({ id: studentId, registrationNumber, classId: cls.id, academicYearId: yearId });
        events.push(studentUser); if (!existingParents.length) events.push(parentUser);
      }
      const result = { batchId: dto.batchId, schoolId, valid: true, errors: [], createdCount: prepared.length, students: enrolled };
      await tx.importBatch.create({ data: { id: dto.batchId, schoolId, actorId, fingerprint, result } });
      await tx.auditLog.create({ data: { userId: actorId, action: AuditAction.USERS_IMPORTED, metadata: { ...result, kind: 'students', userIds: events.map(e => e.id) } } });
      return result;
    }, { timeout: 60000 }).catch(error => {
      if (error.code === 'P2002' || (error.code === 'P2010' && ['23505', '23503'].includes(error.meta?.code))) throw new ConflictException('Student import conflicts with existing records; no users were created');
      throw error;
    });
    for (const user of events) await this.publishCreated(user);
    for (const student of enrolled) await this.rabbitmqService.publish('student.enrolled', { ...student, studentId: student.id, schoolId, enrolledBy: actorId }, 'student.events');
    return result;
  }

  private async protectLastAdmin(tx: Prisma.TransactionClient, existing: IdentityUser, nextRoles: Role[], isActive: boolean) {
    // Serialize removal/deactivation so concurrent administrators cannot remove each other.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(60906001)`;
    if (!existing.isActive || !this.roleValues(existing).includes(Role.SYSTEM_ADMIN) || (isActive && nextRoles.includes(Role.SYSTEM_ADMIN))) return;
    const count = await tx.user.count({ where: { schoolId: existing.schoolId, isActive: true, roles: { some: { role: Role.SYSTEM_ADMIN } } } });
    if (count <= 1) throw new ConflictException('Cannot remove the final active system administrator');
  }

  async deactivateUser(userId: string, actorId: string): Promise<void> {
    await this.authorizeTarget(userId, actorId);

    await this.prisma.$transaction(async tx => {
      const existing = await tx.user.findUniqueOrThrow({ where: { id: userId }, include: identityInclude });
      await this.protectLastAdmin(tx, existing, this.roleValues(existing), false);
      await tx.user.update({ where: { id: userId }, data: { isActive: false, tokenVersion: { increment: 1 } } });
      await tx.refreshToken.updateMany({ where: { userId }, data: { isRevoked: true } });
    });

    await this.auditService.createLog({
      userId: actorId,
      action: AuditAction.USER_DEACTIVATED,
      metadata: { targetUserId: userId },
    });
  }

  async activateUser(userId: string, actorId: string): Promise<void> {
    await this.authorizeTarget(userId, actorId);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { isActive: true, tokenVersion: { increment: 1 } } }),
      this.prisma.refreshToken.updateMany({ where: { userId }, data: { isRevoked: true } }),
    ]);

    await this.auditService.createLog({
      userId: actorId,
      action: AuditAction.USER_ACTIVATED,
      metadata: { targetUserId: userId },
    });
  }

  async updateRole(userId: string, role: Role, actorId: string): Promise<void> {
    await this.updateUser(userId, { roles: [role], primaryRole: role }, actorId);
  }

  async unlockUser(userId: string, actorId: string): Promise<void> {
    await this.authorizeTarget(userId, actorId);

    await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    await this.auditService.createLog({
      userId: actorId,
      action: AuditAction.ACCOUNT_UNLOCKED,
      metadata: { targetUserId: userId },
    });
  }

  async updateUser(userId: string, dto: UpdateUserDto, actorId: string) {
    const existing = await this.authorizeTarget(userId, actorId);
    const { roles, primaryRole } = this.normalizeRoles(dto, existing);
    const actor = await this.actor(actorId);
    if (actor.schoolId && roles.some(r => [Role.BOARD_DIRECTOR, Role.MANAGING_DIRECTOR].includes(r as any) && !this.roleValues(existing).includes(r))) throw new ForbiddenException('Cannot assign global leadership roles');
    const schoolId = !existing.schoolId && dto.schoolId === undefined && !actor.schoolId
      ? null : await this.schoolFor(actorId, dto.schoolId ?? existing.schoolId ?? undefined);
    if (!schoolId && roles.some(r => ![Role.SYSTEM_ADMIN, Role.BOARD_DIRECTOR, Role.MANAGING_DIRECTOR].includes(r as any))) throw new BadRequestException('Operational roles require a school');
    const schoolChanged = schoolId !== existing.schoolId;
    if (schoolChanged) {
      if (!dto.schoolChangeReason?.trim()) throw new BadRequestException('School change reason is required');
      // A move requires domain dependency validation; never silently move school-owned records.
      const dependencies = await this.prisma.$queryRaw<{ kind: string }[]>`
        SELECT 'student' AS kind FROM students."Student" WHERE "authUserId" = ${userId}
        UNION ALL SELECT 'guardian' FROM students."Guardian" WHERE "authUserId" = ${userId}
        UNION ALL SELECT 'class teacher' FROM students."Class" WHERE "classTeacherId" = ${userId}
        UNION ALL SELECT 'subject teacher' FROM academics."ClassSubject" WHERE "teacherId" = ${userId}
        UNION ALL SELECT 'department head' FROM students."DepartmentHod" WHERE "userId" = ${userId}
        UNION ALL SELECT 'course teacher' FROM elearning.course_spaces WHERE "teacherId" = ${userId}
        UNION ALL SELECT 'fund request' FROM finance."FundRequest" WHERE "requestedById" = ${userId}
        UNION ALL SELECT 'performance record' FROM students."PerformanceSnapshot" WHERE "teacherId" = ${userId}
        UNION ALL SELECT 'term result' FROM academics."TermResult" WHERE "teacherId" = ${userId}
        UNION ALL SELECT 'timetable' FROM academics."Timetable" WHERE "teacherId" = ${userId}
        UNION ALL SELECT 'timetable slot' FROM academics."TimetableSlot" WHERE "teacherId" = ${userId}
      `;
      if (dependencies.length) throw new ConflictException({ message: 'School move has existing dependencies', dependencies });
    }
    const email = dto.email === undefined ? existing.email : dto.email?.trim().toLowerCase() ?? null;
    if (roles.some(r => ![Role.STUDENT, Role.PARENT].includes(r as any)) && !email) throw new BadRequestException('Email is required for staff');
    if (dto.phoneNumber && !/^\+\d{7,15}$/.test(UsersService.normalisePhone(dto.phoneNumber))) throw new BadRequestException('Invalid phone number');
    const emailChanged = email !== existing.email;
    const rolesChanged = primaryRole !== existing.role || [...roles].sort().join() !== this.roleValues(existing).sort().join();
    try {
      return await this.prisma.$transaction(async tx => {
        await this.protectLastAdmin(tx, existing, schoolChanged ? [] : roles, existing.isActive);
        if (dto.registrationNumber !== undefined && dto.registrationNumber !== existing.registrationNumber) {
          const linked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM students."Student" WHERE "authUserId" = ${userId} AND "schoolId" = ${schoolId}`;
          if (linked.length && !dto.registrationNumber?.trim()) throw new ConflictException('An enrolled student must retain a registration number');
          if (linked.length) await tx.$executeRaw`UPDATE students."Student" SET "registrationNumber" = ${dto.registrationNumber!.trim()}, "updatedAt" = NOW() WHERE "authUserId" = ${userId} AND "schoolId" = ${schoolId}`;
        }
        if (rolesChanged) await tx.userRoleAssignment.deleteMany({ where: { userId } });
        const user = await tx.user.update({ where: { id: userId }, data: {
          email, firstName: dto.firstName?.trim(), lastName: dto.lastName?.trim(),
          registrationNumber: dto.registrationNumber?.trim() ?? dto.registrationNumber, department: dto.department,
          phoneNumber: dto.phoneNumber === undefined ? undefined : dto.phoneNumber ? UsersService.normalisePhone(dto.phoneNumber) : null,
          schoolId, role: primaryRole,
          ...(rolesChanged ? { roles: { create: roles.map(role => ({ role, assignedBy: actorId })) } } : {}),
          ...(emailChanged ? { isEmailVerified: false } : {}),
          tokenVersion: { increment: 1 },
        }, include: identityInclude });
        await tx.refreshToken.updateMany({ where: { userId }, data: { isRevoked: true } });
        const actions: AuditAction[] = [AuditAction.USER_PROFILE_UPDATED];
        if (emailChanged) actions.push(AuditAction.USER_EMAIL_CHANGED);
        if (schoolChanged) actions.push(AuditAction.USER_SCHOOL_CHANGED);
        if (rolesChanged) actions.push(AuditAction.USER_ROLES_CHANGED);
        for (const action of actions) await tx.auditLog.create({ data: { userId: actorId, action, metadata: JSON.parse(JSON.stringify({ targetUserId: userId, schoolId, before: this.toSafeUser(existing), after: this.toSafeUser(user), reason: dto.schoolChangeReason, addedRoles: roles.filter(r => !this.roleValues(existing).includes(r)), removedRoles: this.roleValues(existing).filter(r => !roles.includes(r)) })) } });
        return this.toSafeUser(user);
      });
    } catch (error) {
      if ((error as any).code === 'P2002' || ((error as any).code === 'P2010' && (error as any).meta?.code === '23505')) throw new ConflictException('Email or registration number already exists');
      if ((error as any).code === 'P2003') throw new ConflictException('School move conflicts with linked records');
      throw error;
    }
  }

  async resetPassword(userId: string, dto: AdminResetPasswordDto, actorId: string) {
    await this.authorizeTarget(userId, actorId);
    const temporaryPassword = dto.temporaryPassword || this.generateTemporaryPassword();
    const passwordHash = await argon2.hash(temporaryPassword);
    const revokeSessions = true;

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null, mustChangePassword: true, tokenVersion: { increment: 1 } },
      }),
      ...(revokeSessions
        ? [this.prisma.refreshToken.updateMany({ where: { userId, isRevoked: false }, data: { isRevoked: true } })]
        : []),
    ]);

    await this.auditService.createLog({
      userId: actorId,
      action: AuditAction.PASSWORD_RESET_REQUESTED,
      metadata: { targetUserId: userId, adminReset: true, revokeSessions },
    });

    return {
      message: 'Password reset successfully',
      temporaryPassword,
      revokeSessions,
    };
  }

  async inviteUser(userId: string, actorId: string) {
    const user = await this.authorizeTarget(userId, actorId);

    await this.auditService.createLog({
      userId: actorId,
      action: AuditAction.PASSWORD_RESET_REQUESTED,
      metadata: { targetUserId: userId, action: 'USER_INVITE_SENT' },
    });

    await this.rabbitmqService.publish('user.invite.requested', {
      userId: user.id,
      schoolId: user.schoolId,
      roles: this.roleValues(user),
      primaryRole: user.role,
      role: user.role,
      email: user.email,
      registrationNumber: user.registrationNumber,
      firstName: user.firstName,
      lastName: user.lastName,
    });

    return { message: 'Invite queued', userId: user.id };
  }

  async listSessions(userId: string, actorId: string) {
    await this.authorizeTarget(userId, actorId);
    const sessions = await this.prisma.refreshToken.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return sessions.map((session) => ({
      id: session.id,
      userId: session.userId,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      isRevoked: session.isRevoked,
      status: session.isRevoked ? 'REVOKED' : session.expiresAt < new Date() ? 'EXPIRED' : 'ACTIVE',
    }));
  }

  async revokeSession(userId: string, sessionId: string, actorId: string) {
    await this.authorizeTarget(userId, actorId);
    await this.prisma.refreshToken.updateMany({
      where: { id: sessionId, userId },
      data: { isRevoked: true },
    });

    await this.auditService.createLog({
      userId: actorId,
      action: AuditAction.LOGOUT,
      metadata: { targetUserId: userId, sessionId, adminRevoked: true },
    });

    return { message: 'Session revoked', sessionId };
  }

  async revokeAllSessions(userId: string, actorId: string) {
    await this.authorizeTarget(userId, actorId);
    const result = await this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });

    await this.auditService.createLog({
      userId: actorId,
      action: AuditAction.LOGOUT,
      metadata: { targetUserId: userId, revokedCount: result.count, adminRevokedAll: true },
    });

    return { message: 'Sessions revoked', revokedCount: result.count };
  }

  async listUsers(query: ListUsersDto, actorId: string) {
    const actor = await this.findById(actorId);
    const allowed = [Role.SYSTEM_ADMIN, Role.PRINCIPAL, Role.ACADEMIC_QA, Role.HEAD_OF_DEPARTMENT];
    if (!actor.isActive || !this.roleValues(actor).some(r => allowed.includes(r as any))) throw new ForbiddenException('Insufficient permissions');
    if (!actor.schoolId && !this.roleValues(actor).includes(Role.SYSTEM_ADMIN)) throw new ForbiddenException('School is required');
    if (actor.schoolId && query.schoolId && actor.schoolId !== query.schoolId) throw new ForbiddenException('Cannot select another school');
    const pagination = getPagination(query.page, query.limit);

    const where: Prisma.UserWhereInput = {
      schoolId: actor.schoolId ?? query.schoolId,
      roles: query.role ? { some: { role: query.role } } : undefined,
      ...(query.search ? { OR: ['email', 'registrationNumber', 'firstName', 'lastName', 'phoneNumber'].map(field => ({ [field]: { contains: query.search!.trim(), mode: 'insensitive' } })) } : {}),
      isActive: query.isActive,
      ...(query.phoneNumber ? { phoneNumber: UsersService.normalisePhone(query.phoneNumber) } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
        include: identityInclude,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toSafeUser(item)),
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    };
  }

  async registerFailedLogin(userId: string): Promise<{ failedLoginAttempts: number; locked: boolean; lockedUntil: Date | null }> {
    const user = await this.findById(userId);
    const attempts = user.failedLoginAttempts + 1;
    const maxAttempts = Number(this.configService.get('LOGIN_MAX_ATTEMPTS', '100'));
    const lockMinutes = Number(this.configService.get('LOGIN_LOCK_MINUTES', '15'));
    const shouldLock = attempts >= maxAttempts;
    const lockedUntil = shouldLock ? new Date(Date.now() + lockMinutes * 60 * 1000) : null;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil,
      },
    });

    return { failedLoginAttempts: attempts, locked: shouldLock, lockedUntil };
  }

  async registerSuccessfulLogin(userId: string, ipAddress: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
      },
    });
  }

  toSafeUser(user: User & { roles?: { role: Role }[]; school?: unknown }) {
    return {
      id: user.id,
      email: user.email,
      registrationNumber: user.registrationNumber,
      role: user.role,
      primaryRole: user.role,
      roles: this.roleValues(user),
      schoolId: user.schoolId,
      school: user.school ?? null,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      department: user.department,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      mustChangePassword: user.mustChangePassword,
      failedLoginAttempts: user.failedLoginAttempts,
      lockedUntil: user.lockedUntil,
      lastLoginAt: user.lastLoginAt,
      lastLoginIp: user.lastLoginIp,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      createdBy: user.createdBy,
    };
  }

  private generateTemporaryPassword(): string {
    return `Kili-${randomBytes(18).toString('base64url')}!`;
  }
}
