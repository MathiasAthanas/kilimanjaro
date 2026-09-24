import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StudentsService } from '../students.service';
import { AuthClientService } from '../../admissions/auth-client.service';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { assertSchoolInScope } from '../../common/helpers/school-scope.helper';
import { ImportStudentsDto, ImportStudentRowDto } from '../dto/import-students.dto';

type Gender = 'MALE' | 'FEMALE';

interface NormalizedRow {
  line: number;
  raw: ImportStudentRowDto;
  firstName: string;
  middleName?: string;
  lastName: string;
  gender?: Gender;
  dateOfBirth?: string;
  legacyAdmissionNumber?: string;
  guardianPhone?: string;
  errors: string[];
  warnings: string[];
}

export interface ImportRowResult {
  line: number;
  name: string;
  admissionNumber?: string;
  status: 'ready' | 'imported' | 'warning' | 'error' | 'skipped';
  messages: string[];
  studentId?: string;
  registrationNumber?: string;
}

export interface ImportReport {
  committed: boolean;
  school: { id: string | null; name: string; gender: string };
  class: { id: string; name: string; stream: string | null; educationStage: string; combinationCode: string | null };
  academicYearId: string;
  total: number;
  ready: number;
  imported: number;
  warnings: number;
  errors: number;
  createdStudentIds: string[];
  rows: ImportRowResult[];
}

@Injectable()
export class StudentImportService {
  private readonly logger = new Logger(StudentImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly studentsService: StudentsService,
    private readonly authClient: AuthClientService,
  ) {}

  /** Split a full name: last word = lastName, middle words = middleName, first = firstName. */
  private splitName(name: string): { firstName: string; middleName?: string; lastName: string } {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { firstName: '', lastName: '' };
    if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
    const firstName = parts[0];
    const lastName = parts[parts.length - 1];
    const middleName = parts.slice(1, -1).join(' ') || undefined;
    return { firstName, middleName, lastName };
  }

  private normalizeGender(value?: string): Gender | undefined {
    const v = String(value ?? '').trim().toUpperCase();
    if (!v) return undefined;
    if (v === 'M' || v.startsWith('MALE') || v === 'BOY') return 'MALE';
    if (v === 'F' || v.startsWith('FEMALE') || v === 'GIRL') return 'FEMALE';
    return undefined;
  }

  /** Normalize a Tanzanian phone number to +255XXXXXXXXX, or null if unusable. */
  private normalizePhone(value?: string): string | undefined {
    if (!value) return undefined;
    const first = String(value).split(/[,/;]/)[0];
    const digits = first.replace(/[^\d]/g, '');
    if (!digits) return undefined;
    if (digits.startsWith('255')) return `+${digits}`;
    if (digits.startsWith('0')) return `+255${digits.slice(1)}`;
    if (digits.length === 9) return `+255${digits}`;
    if (digits.length >= 10) return `+${digits}`;
    return undefined;
  }

  private cleanPassword(lastName: string): string {
    return lastName.replace(/[^a-z0-9]/gi, '').toUpperCase();
  }

  async run(dto: ImportStudentsDto, actorId: string, user?: RequestUser): Promise<ImportReport> {
    if (!dto.classId) throw new BadRequestException('A target class is required');
    if (!Array.isArray(dto.rows) || dto.rows.length === 0) throw new BadRequestException('No rows to import');
    if (dto.rows.length > 2000) throw new BadRequestException('Maximum 2000 rows per import');

    const klass = await this.prisma.class.findUnique({
      where: { id: dto.classId },
      include: { school: true, academicYear: true },
    });
    if (!klass) throw new BadRequestException('Target class not found');

    // School scope: import must stay inside the actor's selected/in-scope school.
    assertSchoolInScope(user, klass.schoolId ?? null);
    if (user?.activeSchoolId && klass.schoolId && user.activeSchoolId !== klass.schoolId) {
      throw new ForbiddenException('You can only import into a class in the currently selected school');
    }

    const school = klass.school;
    const schoolGender = (school?.gender ?? 'BOTH') as 'MALE' | 'FEMALE' | 'BOTH';
    const schoolName = school?.name ?? 'this school';
    const academicYearId = dto.academicYearId || klass.academicYearId;
    const isALevel = klass.educationStage === 'A_LEVEL';

    // A-Level classes must have a combination attached before import.
    if (isALevel && !klass.combinationCode) {
      throw new BadRequestException(
        `Class ${klass.name} is A-Level and requires a subject combination, but none is configured. Attach a combination to the class before importing.`,
      );
    }

    // Existing legacy admission numbers in this school (for duplicate detection).
    const existingAdmissions = new Set<string>();
    if (klass.schoolId) {
      const rows = await this.prisma.student.findMany({
        where: { schoolId: klass.schoolId, legacyAdmissionNumber: { not: null } },
        select: { legacyAdmissionNumber: true },
      });
      for (const r of rows) if (r.legacyAdmissionNumber) existingAdmissions.add(r.legacyAdmissionNumber.trim().toUpperCase());
    }

    const seenAdmissions = new Set<string>();
    const normalized: NormalizedRow[] = dto.rows.map((raw, i) => {
      const line = i + 2; // account for header row in source files
      const errors: string[] = [];
      const warnings: string[] = [];

      const name = String(raw.name ?? '').trim();
      const admission = String(raw.admissionNumber ?? '').trim();
      const label = name || (admission ? `Admission ${admission}` : `Row ${line}`);

      const { firstName, middleName, lastName } = this.splitName(name);
      if (!name || !firstName || !lastName) {
        errors.push(`Row ${line}${admission ? `, Admission ${admission}` : ''}: student name is missing. Add Name before import.`);
      } else if (!this.cleanPassword(lastName)) {
        errors.push(`Row ${line}, ${label}: last name has no letters/numbers to build the login password.`);
      }

      // Gender resolution with school-gender rules.
      let gender = this.normalizeGender(raw.gender);
      const providedGenderRaw = String(raw.gender ?? '').trim();
      if (providedGenderRaw && !gender) {
        warnings.push(`Row ${line}, ${label}: gender "${providedGenderRaw}" not recognised; treating as missing.`);
      }
      if (!gender) {
        if (schoolGender === 'MALE') gender = 'MALE';
        else if (schoolGender === 'FEMALE') gender = 'FEMALE';
        else errors.push(`Row ${line}, ${label}: gender is missing and ${schoolName} accepts both male and female students. Add gender before import.`);
      } else if (schoolGender !== 'BOTH' && gender !== schoolGender) {
        errors.push(`Row ${line}, ${label}: gender ${gender} is not allowed in ${schoolName}, which is configured as ${schoolGender} only.`);
      }

      // Admission number duplicate detection.
      let legacyAdmissionNumber: string | undefined;
      if (admission) {
        legacyAdmissionNumber = admission;
        const key = admission.toUpperCase();
        if (existingAdmissions.has(key)) errors.push(`Row ${line}, ${label}: admission number ${admission} already exists in ${schoolName}.`);
        else if (seenAdmissions.has(key)) errors.push(`Row ${line}, ${label}: admission number ${admission} is duplicated within this file.`);
        seenAdmissions.add(key);
      }

      // DOB (nullable) — warn if missing.
      let dateOfBirth: string | undefined;
      if (raw.dateOfBirth && String(raw.dateOfBirth).trim()) {
        const d = new Date(String(raw.dateOfBirth).trim());
        if (Number.isNaN(d.getTime())) warnings.push(`Row ${line}, ${label}: date of birth "${raw.dateOfBirth}" is not a valid date; leaving blank.`);
        else dateOfBirth = d.toISOString().slice(0, 10);
      } else {
        warnings.push(`Row ${line}, ${label}: date of birth is missing.`);
      }

      // Contact (nullable) — warn if missing.
      const guardianPhone = this.normalizePhone(raw.contacts);
      if (!guardianPhone) warnings.push(`Row ${line}, ${label}: contact is missing.`);

      // Stream/combination cross-check (warning only).
      const rowStream = String(raw.stream ?? '').trim();
      if (rowStream && isALevel && klass.combinationCode && rowStream.toUpperCase() !== klass.combinationCode.toUpperCase()) {
        warnings.push(`Row ${line}, ${label}: file stream ${rowStream} differs from selected class combination ${klass.combinationCode}. Confirm the selected class or correct the file.`);
      } else if (rowStream && !isALevel && klass.stream && rowStream.toUpperCase() !== String(klass.stream).toUpperCase()) {
        warnings.push(`Row ${line}, ${label}: file stream ${rowStream} differs from selected class stream ${klass.stream}.`);
      }

      return { line, raw, firstName, middleName, lastName, gender, dateOfBirth, legacyAdmissionNumber, guardianPhone, errors, warnings };
    });

    const report: ImportReport = {
      committed: Boolean(dto.commit),
      school: { id: klass.schoolId ?? null, name: schoolName, gender: schoolGender },
      class: { id: klass.id, name: klass.name, stream: klass.stream ?? null, educationStage: klass.educationStage, combinationCode: klass.combinationCode ?? null },
      academicYearId,
      total: normalized.length,
      ready: 0,
      imported: 0,
      warnings: 0,
      errors: 0,
      createdStudentIds: [],
      rows: [],
    };

    const admissionDate = new Date().toISOString().slice(0, 10);

    for (const row of normalized) {
      const name = [row.firstName, row.middleName, row.lastName].filter(Boolean).join(' ').trim() || String(row.raw.name ?? '');
      const base: ImportRowResult = {
        line: row.line,
        name,
        admissionNumber: row.legacyAdmissionNumber,
        status: row.errors.length ? 'error' : row.warnings.length ? 'warning' : 'ready',
        messages: [...row.errors, ...row.warnings],
      };

      if (row.errors.length) {
        report.errors += 1;
        report.rows.push({ ...base, status: dto.commit ? 'skipped' : 'error' });
        continue;
      }

      if (row.warnings.length) report.warnings += 1;
      report.ready += 1;

      if (!dto.commit) {
        report.rows.push(base);
        continue;
      }

      // ── Commit: create auth account, then the student record ────────────────
      // The student record write is a single DB transaction (StudentsService.create).
      // The only cross-service step is the auth account created just before it, so
      // if the student write fails we delete that account to avoid an orphan.
      let studentAccountId: string | null = null;
      try {
        const studentAccount = await this.authClient.createStudentAccount({
          firstName: row.firstName,
          lastName: row.lastName,
          actorId,
          schoolId: klass.schoolId ?? '',
        });
        studentAccountId = studentAccount.id;

        const guardians = [] as Array<{ authUserId?: string; firstName: string; lastName: string; relationship: 'GUARDIAN'; phoneNumber: string; isPrimary: boolean }>;
        if (row.guardianPhone) {
          // Parent accounts are deduplicated/shared across siblings, so a failure
          // here should not delete a possibly-shared parent — we leave it be.
          const parent = await this.authClient.ensureParentAccount({
            firstName: row.firstName,
            lastName: row.lastName,
            phoneNumber: row.guardianPhone,
            actorId,
            schoolId: klass.schoolId ?? '',
          });
          guardians.push({
            authUserId: parent.id,
            firstName: 'Guardian',
            lastName: row.lastName,
            relationship: 'GUARDIAN',
            phoneNumber: row.guardianPhone,
            isPrimary: true,
          });
        }

        const created = (await this.studentsService.create(
          {
            authUserId: studentAccount.id,
            firstName: row.firstName,
            middleName: row.middleName,
            lastName: row.lastName,
            dateOfBirth: row.dateOfBirth,
            gender: row.gender!,
            admissionDate,
            classId: klass.id,
            academicYearId,
            legacyAdmissionNumber: row.legacyAdmissionNumber,
            guardians,
          } as any,
          actorId,
          user,
        )) as { id: string; registrationNumber: string };
        studentAccountId = null; // student persisted — account is no longer orphaned

        try {
          await this.authClient.setRegistrationNumber(studentAccount.id, created.registrationNumber, actorId);
        } catch (e) {
          this.logger.warn(`Failed to set registration number for ${created.id}: ${(e as Error).message}`);
        }

        report.imported += 1;
        report.createdStudentIds.push(created.id);
        report.rows.push({ ...base, status: 'imported', studentId: created.id, registrationNumber: created.registrationNumber, messages: row.warnings });
      } catch (error) {
        // Roll back the orphaned auth account so a failed row leaves nothing behind.
        if (studentAccountId) {
          try { await this.authClient.deleteAccount(studentAccountId); }
          catch (e) { this.logger.error(`Rollback failed for orphaned account ${studentAccountId}: ${(e as Error).message}`); }
        }
        const message = error instanceof Error ? error.message : 'Failed to import row';
        report.errors += 1;
        report.rows.push({ ...base, status: 'error', messages: [`Row ${row.line}, ${name}: ${message}`] });
      }
    }

    return report;
  }
}
