import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClassSubjectDto } from './dto/create-class-subject.dto';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { CreateSubjectCombinationDto } from './dto/create-subject-combination.dto';
import { CreateStudentSubjectEnrollmentDto } from './dto/create-student-subject-enrollment.dto';
import { BulkStudentSubjectEnrollmentDto } from './dto/bulk-student-subject-enrollment.dto';
import { UpdateClassSubjectDto } from './dto/update-class-subject.dto';
import { UpdateSubjectDto } from './dto/update-subject.dto';
import { RedisService } from '../redis/redis.service';
import { ROLES } from '../common/constants/roles';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { StudentClientService } from '../student-client/student-client.service';
import { AuthClientService } from '../auth-client/auth-client.service';
import {
  assertSchoolInScope,
  assertSchoolRecordWritable,
  isGroupScope,
  requireWriteSchoolId,
  resolveWriteSchoolId,
  schoolOrGlobalFilter,
  schoolScopeFilter,
} from '../common/helpers/school-scope.helper';
import {
  GENERAL_STUDIES,
  PREDEFINED_A_LEVEL_COMBINATIONS,
} from './predefined-combinations';

@Injectable()
export class SubjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly studentClient: StudentClientService,
    private readonly authClient: AuthClientService,
  ) {}

  private studentServiceHeaders(user: RequestUser): Record<string, string> {
    return {
      'X-User-Id': user.id,
      'X-User-Role': user.role,
      'X-User-Scope': user.scope ?? 'GROUP',
      'X-User-School-Ids': user.scope === 'SCHOOL' ? (user.schoolIds ?? []).join(',') : '*',
      ...(user.activeSchoolId ? { 'X-Active-School': user.activeSchoolId } : {}),
    };
  }

  private async assertBulkEnrollmentScope(dto: BulkStudentSubjectEnrollmentDto, user: RequestUser): Promise<void> {
    const uniqueStudentIds = [...new Set(dto.studentIds)];
    if (!uniqueStudentIds.length) {
      throw new BadRequestException('Select at least one student');
    }
    if (uniqueStudentIds.length !== dto.studentIds.length) {
      throw new BadRequestException('A student can only be assigned once per bulk request');
    }
    const payload = await this.studentClient.get<unknown>(
      '/students',
      { classId: dto.classId, academicYearId: dto.academicYearId, limit: 1000, page: 1 },
      this.studentServiceHeaders(user),
    );
    const root = payload && typeof payload === 'object' && 'data' in payload
      ? (payload as { data: unknown }).data
      : payload;
    const items = root && typeof root === 'object' && 'items' in root && Array.isArray((root as { items?: unknown }).items)
      ? (root as { items: Array<{ id: string; schoolId?: string | null }> }).items
      : [];
    const selected = new Map(items.map((student) => [student.id, student]));
    if (uniqueStudentIds.some((id) => !selected.has(id))) {
      throw new ForbiddenException('Every selected student must be actively enrolled in the selected class and school');
    }
    for (const student of selected.values()) {
      resolveWriteSchoolId(user, student.schoolId ?? null);
    }
  }

  async createSubject(dto: CreateSubjectDto) {
    const subject = await this.prisma.subject.create({ data: dto });
    await this.redis.del('subjects:all');
    return subject;
  }

  async listSubjects(filters: { isActive?: string; isCompulsory?: string; educationStage?: string }) {
    const cacheKey = 'subjects:all';
    if (!filters.isActive && !filters.isCompulsory && !filters.educationStage) {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const subjects = await this.prisma.subject.findMany({
      where: {
        isActive: filters.isActive === undefined ? undefined : filters.isActive === 'true',
        isCompulsory: filters.isCompulsory === undefined ? undefined : filters.isCompulsory === 'true',
        educationStage: filters.educationStage as any,
      },
      orderBy: { name: 'asc' },
    });

    if (!filters.isActive && !filters.isCompulsory && !filters.educationStage) {
      await this.redis.set(cacheKey, subjects, 1800);
    }

    return subjects;
  }

  async updateSubject(id: string, dto: UpdateSubjectDto) {
    const existing = await this.prisma.subject.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Subject not found');
    }

    const subject = await this.prisma.subject.update({ where: { id }, data: dto });
    await this.redis.del('subjects:all');
    return subject;
  }

  async deleteSubject(id: string): Promise<void> {
    const existing = await this.prisma.subject.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Subject not found');

    const [classSubjectCount, combinationCount] = await Promise.all([
      this.prisma.classSubject.count({ where: { subjectId: id } }),
      this.prisma.subjectCombinationSubject.count({ where: { subjectId: id } }),
    ]);

    const blockers: string[] = [];
    if (classSubjectCount > 0) blockers.push(`${classSubjectCount} class assignment${classSubjectCount > 1 ? 's' : ''}`);
    if (combinationCount > 0) blockers.push(`${combinationCount} A-Level combination${combinationCount > 1 ? 's' : ''}`);

    if (blockers.length > 0) {
      throw new BadRequestException(
        `Cannot delete "${existing.name}" — it is used in ${blockers.join(' and ')}. Remove those first.`,
      );
    }

    await this.prisma.subject.delete({ where: { id } });
    await this.redis.del('subjects:all');
  }

  private async getHodDepartment(user: RequestUser, academicYearId?: string): Promise<{ id: string; name?: string } | null> {
    const response = await this.studentClient.get<{ id?: string; name?: string; data?: { id: string; name?: string } } | null>(
      `/students/internal/departments/by-user/${user.id}`,
      academicYearId ? { academicYearId } : undefined,
      this.studentServiceHeaders(user),
    );
    if (!response) return null;
    return response.data ?? (response.id ? response as { id: string; name?: string } : null);
  }

  private async assertHodSubjectScope(user: RequestUser | undefined, subjectId: string, academicYearId?: string): Promise<void> {
    if (user?.role !== ROLES.HEAD_OF_DEPARTMENT) return;
    const department = await this.getHodDepartment(user, academicYearId);
    if (!department?.id) {
      throw new ForbiddenException('HOD is not assigned to an active department');
    }
    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
      select: { departmentId: true, name: true },
    });
    if (!subject) throw new NotFoundException('Subject not found');
    if (subject.departmentId !== department.id) {
      throw new ForbiddenException('HOD can only manage class-subject assignments for their department');
    }
  }

  private async assertTeacherAssignment(teacherId: string, schoolId: string): Promise<void> {
    const teacher = await this.authClient.getUserById(teacherId);
    if (!teacher?.isActive || ![ROLES.TEACHER, ROLES.HEAD_OF_DEPARTMENT].includes(teacher.role as any)) {
      throw new BadRequestException('Choose an active teacher or head-of-department account.');
    }
    if (!teacher.schoolIds.includes(schoolId)) {
      throw new BadRequestException('The selected teacher is not an active member of this school.');
    }
  }

  private unwrapList<T>(payload: unknown): T[] {
    if (Array.isArray(payload)) return payload as T[];
    if (!payload || typeof payload !== 'object') return [];
    const root = 'data' in payload ? (payload as { data: unknown }).data : payload;
    if (Array.isArray(root)) return root as T[];
    if (root && typeof root === 'object') {
      const items = (root as { items?: unknown; classes?: unknown }).items ?? (root as { classes?: unknown }).classes;
      if (Array.isArray(items)) return items as T[];
    }
    return [];
  }

  private async getClassAssignmentContext(classId: string, user: RequestUser): Promise<{
    schoolId: string;
    academicYearId: string;
    educationStage: string;
    level: number | null;
  }> {
    const raw = await this.studentClient.get<unknown>(
      '/students/classes',
      undefined,
      this.studentServiceHeaders(user),
    );
    const klass = this.unwrapList<Record<string, unknown>>(raw)
      .find((item) => String(item.id ?? '') === classId);

    if (!klass) throw new NotFoundException('Class not found in your current school scope');

    const schoolId = String(klass.schoolId ?? '');
    const academicYearId = String(klass.academicYearId ?? '');
    const educationStage = String(klass.educationStage ?? '').toUpperCase();
    const rawLevel = klass.level;
    const level = rawLevel === null || rawLevel === undefined || rawLevel === '' ? null : Number(rawLevel);

    if (!schoolId || !academicYearId || !educationStage) {
      throw new BadRequestException('The selected class is missing required school, year, or stage information. Update the class first.');
    }
    if (level !== null && !Number.isFinite(level)) {
      throw new BadRequestException('The selected class has an invalid level. Update the class first.');
    }

    resolveWriteSchoolId(user, schoolId);
    return { schoolId, academicYearId, educationStage, level };
  }

  private async assertSubjectFitsClass(subjectId: string, educationStage: string): Promise<void> {
    const subject = await this.prisma.subject.findUnique({
      where: { id: subjectId },
      select: { id: true, isActive: true, educationStage: true },
    });
    if (!subject) throw new NotFoundException('Subject not found');
    if (!subject.isActive) throw new BadRequestException('The selected subject is inactive. Activate it before assigning it to a class.');
    if (subject.educationStage && subject.educationStage !== educationStage) {
      throw new BadRequestException('The selected subject belongs to a different education stage than this class.');
    }
  }

  async createClassSubject(dto: CreateClassSubjectDto, user?: RequestUser) {
    if (!user) throw new ForbiddenException('School context is required');
    const klass = await this.getClassAssignmentContext(dto.classId, user);
    if (dto.academicYearId !== klass.academicYearId) {
      throw new BadRequestException('The selected academic year does not match the selected class.');
    }
    if (dto.educationStage && dto.educationStage !== klass.educationStage) {
      throw new BadRequestException('The selected education stage does not match the selected class.');
    }
    if (dto.classLevel !== undefined && dto.classLevel !== klass.level) {
      throw new BadRequestException('The selected class level does not match the selected class.');
    }

    await this.assertHodSubjectScope(user, dto.subjectId, klass.academicYearId);
    await this.assertSubjectFitsClass(dto.subjectId, klass.educationStage);
    await this.assertTeacherAssignment(dto.teacherId, klass.schoolId);

    const existing = await this.prisma.classSubject.findFirst({
      where: {
        classId: dto.classId,
        subjectId: dto.subjectId,
        academicYearId: klass.academicYearId,
        combinationId: dto.combinationId ?? null,
      },
    });
    const data = {
      classId: dto.classId,
      subjectId: dto.subjectId,
      academicYearId: klass.academicYearId,
      teacherId: dto.teacherId,
      schoolId: klass.schoolId,
      educationStage: klass.educationStage as any,
      classLevel: klass.level,
      combinationId: dto.combinationId ?? null,
      isActive: dto.isActive ?? true,
    };

    if (existing) {
      return this.prisma.classSubject.update({
        where: { id: existing.id },
        data,
        include: { subject: true, combination: true },
      });
    }

    return this.prisma.classSubject.create({
      data: {
        ...data,
      },
      include: { subject: true, combination: true },
    });
  }

  async listClassSubjects(filters: {
    classId?: string;
    academicYearId?: string;
    teacherId?: string;
    subjectId?: string;
    educationStage?: string;
    classLevel?: number;
    combinationId?: string;
  }, user?: RequestUser) {
    let scopedSubjectIds: string[] | undefined;
    if (user?.role === ROLES.HEAD_OF_DEPARTMENT) {
      const department = await this.getHodDepartment(user, filters.academicYearId);
      if (!department?.id) return [];
      const subjects = await this.prisma.subject.findMany({
        where: { departmentId: department.id, isActive: true },
        select: { id: true },
      });
      scopedSubjectIds = subjects.map((subject) => subject.id);
      if (scopedSubjectIds.length === 0) return [];
    }

    return this.prisma.classSubject.findMany({
      where: {
        ...schoolScopeFilter(user),
        classId: filters.classId,
        academicYearId: filters.academicYearId,
        teacherId: filters.teacherId,
        subjectId: scopedSubjectIds
          ? filters.subjectId
            ? scopedSubjectIds.includes(filters.subjectId) ? filters.subjectId : '__forbidden_subject__'
            : { in: scopedSubjectIds }
          : filters.subjectId,
        educationStage: filters.educationStage as any,
        classLevel: filters.classLevel,
        combinationId: filters.combinationId,
      },
      include: { subject: true, combination: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateClassSubject(id: string, dto: UpdateClassSubjectDto, user?: RequestUser) {
    const existing = await this.prisma.classSubject.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Class subject not found');
    }
    assertSchoolInScope(user, (existing as { schoolId?: string | null }).schoolId ?? null);
    await this.assertHodSubjectScope(user, dto.subjectId ?? existing.subjectId, dto.academicYearId ?? existing.academicYearId);
    if (dto.teacherId !== undefined) {
      const schoolId = (existing as { schoolId?: string | null }).schoolId;
      if (!schoolId) throw new BadRequestException('This class-subject record has no school context. Recreate it from the selected school.');
      await this.assertTeacherAssignment(dto.teacherId, schoolId);
    }

    return this.prisma.classSubject.update({ where: { id }, data: dto, include: { subject: true, combination: true } });
  }

  async createSubjectCombination(dto: CreateSubjectCombinationDto, user?: RequestUser) {
    if ((dto.educationStage ?? 'A_LEVEL') !== 'A_LEVEL') {
      throw new BadRequestException('Subject combinations are only supported for A-Level');
    }
    await this.assertCombinationSubjectsActive(dto.subjects.map((s) => s.subjectId));
    this.assertALevelCombinationValid(dto.subjects);
    // Subject combinations created from the administration UI belong to the selected school.
    const schoolId = requireWriteSchoolId(user, 'subject combination');
    try {
      return await this.prisma.subjectCombination.create({
        data: {
          schoolId,
          code: dto.code,
          name: dto.name,
          educationStage: dto.educationStage ?? 'A_LEVEL',
          academicYearId: dto.academicYearId,
          isActive: dto.isActive ?? true,
          subjects: {
            create: dto.subjects.map((s, index) => {
              const role = s.subjectRole ?? (s.isPrincipal === false ? 'SUBSIDIARY' : 'PRINCIPAL');
              return {
                subjectId: s.subjectId,
                isPrincipal: role === 'PRINCIPAL',
                subjectRole: role,
                displayOrder: s.displayOrder ?? index,
              };
            }),
          },
        },
        include: { subjects: { include: { subject: true }, orderBy: { displayOrder: 'asc' } } },
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        throw new ConflictException(`Combination ${dto.code} already exists for this academic year`);
      }
      throw error;
    }
  }

  /** The predefined A-Level combination templates the admin can seed from. */
  getPredefinedCombinations() {
    return PREDEFINED_A_LEVEL_COMBINATIONS.map((c) => ({
      code: c.code,
      name: c.name,
      principals: c.principals.map((p) => p.name),
      compulsorySubsidiary: GENERAL_STUDIES.name,
    }));
  }

  /**
   * Find a subject by name (case-insensitive), then by code, else create it.
   * Ensures a stable subject catalogue when seeding predefined combinations.
   */
  private async ensureSubject(name: string, preferredCode: string): Promise<{ id: string }> {
    const byName = await this.prisma.subject.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (byName) return byName;
    const byCode = await this.prisma.subject.findUnique({ where: { code: preferredCode }, select: { id: true } });
    if (byCode) return byCode;
    let code = preferredCode;
    let n = 1;
    // eslint-disable-next-line no-await-in-loop
    while (await this.prisma.subject.findUnique({ where: { code }, select: { id: true } })) {
      code = `${preferredCode}${n++}`;
    }
    return this.prisma.subject.create({
      data: { name, code, educationStage: 'A_LEVEL', isCompulsory: false, isActive: true },
      select: { id: true },
    });
  }

  /**
   * Seed the predefined A-Level combinations for an academic year. Idempotent:
   * combinations that already exist (same code/year/school scope) are skipped.
   * Group-scope actors seed group-wide combinations (schoolId = null); school
   * actors seed within their own school.
   */
  async seedPredefinedCombinations(dto: { academicYearId: string; codes?: string[] }, user?: RequestUser) {
    if (!dto.academicYearId) throw new BadRequestException('academicYearId is required');
    const schoolId = isGroupScope(user) && !user?.activeSchoolId
      ? null
      : requireWriteSchoolId(user, 'subject combination');
    const wanted = dto.codes?.length
      ? PREDEFINED_A_LEVEL_COMBINATIONS.filter((c) => dto.codes!.includes(c.code))
      : PREDEFINED_A_LEVEL_COMBINATIONS;

    const gs = await this.ensureSubject(GENERAL_STUDIES.name, GENERAL_STUDIES.code);
    const createdCodes: string[] = [];
    const skippedCodes: string[] = [];

    for (const combo of wanted) {
      const existing = await this.prisma.subjectCombination.findFirst({
        where: { code: combo.code, academicYearId: dto.academicYearId, schoolId },
        select: { id: true },
      });
      if (existing) { skippedCodes.push(combo.code); continue; }

      const principals: Array<{ id: string }> = [];
      for (const p of combo.principals) {
        principals.push(await this.ensureSubject(p.name, p.code));
      }
      try {
        await this.prisma.subjectCombination.create({
          data: {
            schoolId,
            code: combo.code,
            name: combo.name,
            educationStage: 'A_LEVEL',
            academicYearId: dto.academicYearId,
            isActive: true,
            subjects: {
              create: [
                ...principals.map((s, i) => ({
                  subjectId: s.id,
                  isPrincipal: true,
                  subjectRole: 'PRINCIPAL' as const,
                  displayOrder: i,
                })),
                {
                  subjectId: gs.id,
                  isPrincipal: false,
                  subjectRole: 'COMPULSORY_SUBSIDIARY' as const,
                  displayOrder: principals.length,
                },
              ],
            },
          },
        });
        createdCodes.push(combo.code);
      } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === 'P2002') {
          skippedCodes.push(combo.code);
        } else {
          throw error;
        }
      }
    }
    await this.redis.del('subjects:all');
    return { created: createdCodes.length, skipped: skippedCodes.length, createdCodes, skippedCodes };
  }

  private async assertCombinationSubjectsActive(subjectIds: string[]) {
    const subjects = await this.prisma.subject.findMany({ where: { id: { in: subjectIds }, isActive: true } });
    if (subjects.length !== new Set(subjectIds).size) {
      throw new BadRequestException('Every combination subject must exist and be active');
    }
  }

  /**
   * A-Level ACSEE combination rules:
   *  - At least 2 principal subjects.
   *  - At least one compulsory subsidiary (General Studies / General Paper).
   */
  private assertALevelCombinationValid(subjects: CreateSubjectCombinationDto['subjects']) {
    const principalCount = subjects.filter((s) => {
      const role = s.subjectRole ?? (s.isPrincipal === false ? 'SUBSIDIARY' : 'PRINCIPAL');
      return role === 'PRINCIPAL';
    }).length;

    const hasCompulsorySubsidiary = subjects.some((s) => s.subjectRole === 'COMPULSORY_SUBSIDIARY');

    if (principalCount < 2) {
      throw new BadRequestException(
        'An A-Level combination must have at least 2 principal subjects',
      );
    }
    if (!hasCompulsorySubsidiary) {
      throw new BadRequestException(
        'An A-Level combination must include at least one Compulsory Subsidiary (e.g. General Studies / General Paper)',
      );
    }
  }

  async updateSubjectCombination(id: string, dto: Partial<CreateSubjectCombinationDto>, user?: RequestUser) {
    const existing = await this.prisma.subjectCombination.findUnique({
      where: { id },
      include: { subjects: true },
    });
    if (!existing) {
      throw new NotFoundException('Subject combination not found');
    }
    assertSchoolRecordWritable(user, existing.schoolId ?? null, 'subject combination');
    if (dto.educationStage && dto.educationStage !== 'A_LEVEL') {
      throw new BadRequestException('Subject combinations are only supported for A-Level');
    }
    if (dto.subjects) {
      await this.assertCombinationSubjectsActive(dto.subjects.map((s) => s.subjectId));
      this.assertALevelCombinationValid(dto.subjects);
    }
    return this.prisma.$transaction(async (tx) => {
      if (dto.subjects) {
        await tx.subjectCombinationSubject.deleteMany({ where: { combinationId: id } });
      }
      return tx.subjectCombination.update({
        where: { id },
        data: {
          code: dto.code,
          name: dto.name,
          educationStage: dto.educationStage,
          academicYearId: dto.academicYearId,
          isActive: dto.isActive,
          subjects: dto.subjects
            ? {
                create: dto.subjects.map((s, index) => {
                  const role = s.subjectRole ?? (s.isPrincipal === false ? 'SUBSIDIARY' : 'PRINCIPAL');
                  return {
                    subjectId: s.subjectId,
                    isPrincipal: role === 'PRINCIPAL',
                    subjectRole: role,
                    displayOrder: s.displayOrder ?? index,
                  };
                }),
              }
            : undefined,
        },
        include: { subjects: { include: { subject: true }, orderBy: { displayOrder: 'asc' } } },
      });
    });
  }

  async deactivateSubjectCombination(id: string, user?: RequestUser) {
    const existing = await this.prisma.subjectCombination.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Subject combination not found');
    }
    assertSchoolRecordWritable(user, existing.schoolId ?? null, 'subject combination');
    return this.prisma.subjectCombination.update({
      where: { id },
      data: { isActive: false },
      include: { subjects: { include: { subject: true }, orderBy: { displayOrder: 'asc' } } },
    });
  }

  async listSubjectCombinations(filters: { academicYearId?: string; educationStage?: string; isActive?: string }, user?: RequestUser) {
    return this.prisma.subjectCombination.findMany({
      where: {
        academicYearId: filters.academicYearId,
        educationStage: filters.educationStage as any,
        isActive: filters.isActive === undefined ? undefined : filters.isActive === 'true',
        // This school's combinations OR shared/global ones (schoolId = null); a group
        // user with an active school gets that school's view, no selection → all.
        ...schoolOrGlobalFilter(user),
      },
      include: { subjects: { include: { subject: true }, orderBy: { displayOrder: 'asc' } } },
      orderBy: [{ academicYearId: 'desc' }, { code: 'asc' }],
    });
  }

  async enrollStudentSubject(dto: CreateStudentSubjectEnrollmentDto) {
    if (dto.combinationId) {
      const combination = await this.prisma.subjectCombination.findUnique({
        where: { id: dto.combinationId },
        include: { subjects: true },
      });
      if (!combination || combination.educationStage !== 'A_LEVEL' || !combination.isActive) {
        throw new BadRequestException('A-Level subject enrollment requires an active A-Level combination');
      }
      if (!combination.subjects.some((subject) => subject.subjectId === dto.subjectId)) {
        throw new BadRequestException('Subject is not part of the selected A-Level combination');
      }
    }
    const existing = await this.prisma.studentSubjectEnrollment.findFirst({
      where: {
        studentId: dto.studentId,
        subjectId: dto.subjectId,
        academicYearId: dto.academicYearId,
        termId: dto.termId,
      },
    });

    if (existing) {
      return this.prisma.studentSubjectEnrollment.update({
        where: { id: existing.id },
        data: {
          classId: dto.classId,
          combinationId: dto.combinationId,
          isActive: dto.isActive ?? true,
        },
        include: { subject: true, combination: true },
      });
    }

    return this.prisma.studentSubjectEnrollment.create({
      data: {
        studentId: dto.studentId,
        classId: dto.classId,
        subjectId: dto.subjectId,
        academicYearId: dto.academicYearId,
        termId: dto.termId,
        combinationId: dto.combinationId,
        isActive: dto.isActive ?? true,
      },
      include: { subject: true, combination: true },
    });
  }

  async updateStudentSubjectEnrollment(id: string, dto: Partial<CreateStudentSubjectEnrollmentDto>) {
    const existing = await this.prisma.studentSubjectEnrollment.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Student subject enrollment not found');
    }
    return this.prisma.studentSubjectEnrollment.update({
      where: { id },
      data: {
        classId: dto.classId,
        subjectId: dto.subjectId,
        academicYearId: dto.academicYearId,
        termId: dto.termId,
        combinationId: dto.combinationId,
        isActive: dto.isActive,
      },
      include: { subject: true, combination: true },
    });
  }

  async deactivateStudentSubjectEnrollment(id: string) {
    const existing = await this.prisma.studentSubjectEnrollment.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Student subject enrollment not found');
    }
    return this.prisma.studentSubjectEnrollment.update({
      where: { id },
      data: { isActive: false },
      include: { subject: true, combination: true },
    });
  }

  async bulkEnrollStudentCombination(dto: BulkStudentSubjectEnrollmentDto, user: RequestUser) {
    const combination = await this.prisma.subjectCombination.findUnique({
      where: { id: dto.combinationId },
      include: { subjects: true },
    });
    if (!combination || combination.educationStage !== 'A_LEVEL' || !combination.isActive) {
      throw new BadRequestException('Bulk assignment requires an active A-Level combination');
    }
    if (combination.schoolId) resolveWriteSchoolId(user, combination.schoolId);
    await this.assertBulkEnrollmentScope(dto, user);
    const rows: Array<Promise<unknown>> = [];
    for (const studentId of dto.studentIds) {
      for (const subject of combination.subjects) {
        rows.push(
          this.enrollStudentSubject({
            studentId,
            classId: dto.classId,
            academicYearId: dto.academicYearId,
            termId: dto.termId,
            combinationId: dto.combinationId,
            subjectId: subject.subjectId,
            isActive: true,
          }),
        );
      }
    }
    const saved = await Promise.all(rows);
    return {
      combinationId: dto.combinationId,
      studentsAssigned: dto.studentIds.length,
      subjectEnrollments: saved.length,
      items: saved,
    };
  }

  async listStudentSubjectEnrollments(filters: {
    studentId?: string;
    classId?: string;
    academicYearId?: string;
    combinationId?: string;
  }) {
    return this.prisma.studentSubjectEnrollment.findMany({
      where: {
        studentId: filters.studentId,
        classId: filters.classId,
        academicYearId: filters.academicYearId,
        combinationId: filters.combinationId,
        isActive: true,
      },
      include: { subject: true, combination: true },
      orderBy: { enrolledAt: 'desc' },
    });
  }
}
