import { Injectable, Logger } from '@nestjs/common';
import { EducationStage } from '../../generated/prisma';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { StudentClientService } from '../student-client/student-client.service';
import { resolveWriteSchoolId } from '../common/helpers/school-scope.helper';

export interface ImportResultRow {
  academic_year: string;
  term: string;
  class_name: string;
  subject_name: string;
  student_registration: string;
  score?: string | number;
  max_score?: string | number;
  grade?: string;
  is_absent?: string;
  education_stage?: string;
  remark?: string;
}

export interface ImportError {
  row: number;
  message: string;
}

export interface ImportReport {
  total: number;
  imported: number;
  skipped: number;
  errors: ImportError[];
}

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly studentClient: StudentClientService,
  ) {}

  private unwrap<T>(payload: unknown): T[] {
    if (Array.isArray(payload)) return payload as T[];
    const p = payload as Record<string, unknown> | null;
    if (!p) return [];
    const inner = p.data ?? p;
    if (Array.isArray(inner)) return inner as T[];
    const obj = inner as Record<string, unknown>;
    const cands = [obj?.items, obj?.students, obj?.classes, obj?.academicYears, obj?.years, obj?.terms];
    for (const c of cands) { if (Array.isArray(c)) return c as T[]; }
    return [];
  }

  private studentServiceHeaders(user: RequestUser): Record<string, string> {
    return {
      'X-User-Id': user.id,
      'X-User-Role': user.role,
      'X-User-Scope': user.scope ?? 'GROUP',
      'X-User-School-Ids': user.scope === 'SCHOOL' ? (user.schoolIds ?? []).join(',') : '*',
      ...(user.activeSchoolId ? { 'X-Active-School': user.activeSchoolId } : {}),
    };
  }

  private parseScore(value: string | number | undefined): number {
    if (value === undefined || value === null || String(value).trim() === '') return NaN;
    return parseFloat(String(value));
  }

  private parseBoolean(value: string | undefined): boolean {
    return ['true', '1', 'yes'].includes(String(value ?? '').toLowerCase().trim());
  }

  private deriveStage(className: string): EducationStage {
    const n = className.toLowerCase();
    if (n.includes('form 5') || n.includes('form 6') || n.includes('a level') || n.includes('a-level')) return EducationStage.A_LEVEL;
    if (n.includes('form') || n.includes('o level') || n.includes('o-level')) return EducationStage.O_LEVEL;
    if (n.includes('pp') || n.includes('pre primary') || n.includes('nursery') || n.includes('kindergarten')) return EducationStage.NURSERY;
    if (n.includes('std') || n.includes('standard') || n.includes('primary')) return EducationStage.PRIMARY;
    return EducationStage.O_LEVEL;
  }

  private calculateGrade(score: number): string {
    if (score >= 75) return 'A';
    if (score >= 65) return 'B';
    if (score >= 50) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  }

  private gradeToPoints(grade: string): number {
    return ({ A: 1, B: 2, C: 3, D: 4, F: 5 }[grade.toUpperCase()] ?? 5);
  }

  private gradeRemark(grade: string): string {
    return ({
      A: 'EXCELLENT', B: 'VERY GOOD', C: 'AVERAGE', D: 'BELOW AVERAGE', F: 'FAIL',
    }[grade.toUpperCase()] ?? 'FAIL');
  }

  async getReference(user: RequestUser) {
    const subjects = await this.prisma.subject.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });

    let academicYears: unknown[] = [];
    let terms: unknown[] = [];
    let classes: unknown[] = [];

    try {
      const [yearsRaw, termsRaw, classesRaw] = await Promise.all([
        this.studentClient.get<unknown>('/students/academic-years', undefined, this.studentServiceHeaders(user)),
        this.studentClient.get<unknown>('/students/terms', undefined, this.studentServiceHeaders(user)),
        this.studentClient.get<unknown>('/students/classes', { limit: 500 }, this.studentServiceHeaders(user)),
      ]);
      academicYears = this.unwrap(yearsRaw);
      terms = this.unwrap(termsRaw);
      classes = this.unwrap(classesRaw);
    } catch (err) {
      this.logger.warn('Could not fetch reference data from student-service', err);
    }

    return { subjects, academicYears, terms, classes };
  }

  async importResults(rows: ImportResultRow[], user: RequestUser): Promise<ImportReport> {
    const errors: ImportError[] = [];
    let imported = 0;

    // 1. Local lookup: subjects (Subject has no schoolId — it is a shared catalogue)
    const subjects = await this.prisma.subject.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });
    const subjectMap = new Map(subjects.map((s) => [s.name.toLowerCase().trim(), s]));

    // 2. Remote lookups from student-service
    let studentMap = new Map<string, { id: string; schoolId?: string | null }>();
    let classMap = new Map<string, { id: string; educationStage?: string; schoolId?: string | null }>();
    let yearMap = new Map<string, { id: string; name: string }>(); // name.lower → year
    let termsByYear = new Map<string, Array<{ id: string; name: string; academicYearId: string }>>();

    try {
      const [studentsRaw, classesRaw, yearsRaw, termsRaw] = await Promise.all([
        this.studentClient.get<unknown>('/students', { limit: 5000, page: 1 }, this.studentServiceHeaders(user)),
        this.studentClient.get<unknown>('/students/classes', { limit: 500 }, this.studentServiceHeaders(user)),
        this.studentClient.get<unknown>('/students/academic-years', undefined, this.studentServiceHeaders(user)),
        this.studentClient.get<unknown>('/students/terms', undefined, this.studentServiceHeaders(user)),
      ]);

      this.unwrap<any>(studentsRaw).forEach((s) => {
        if (s.registrationNumber) studentMap.set(String(s.registrationNumber).trim().toUpperCase(), { id: s.id, schoolId: s.schoolId });
      });
      this.unwrap<any>(classesRaw).forEach((c) => {
        classMap.set(String(c.name ?? '').toLowerCase().trim(), { id: c.id, educationStage: c.educationStage, schoolId: c.schoolId });
      });
      this.unwrap<any>(yearsRaw).forEach((y) => {
        yearMap.set(String(y.name ?? '').toLowerCase().trim(), { id: y.id, name: y.name });
      });
      this.unwrap<any>(termsRaw).forEach((t) => {
        const arr = termsByYear.get(t.academicYearId) ?? [];
        arr.push({ id: t.id, name: t.name, academicYearId: t.academicYearId });
        termsByYear.set(t.academicYearId, arr);
      });
    } catch {
      return {
        total: rows.length,
        imported: 0,
        skipped: 0,
        errors: [{ row: 0, message: 'Cannot reach student-service. Ensure it is running and try again.' }],
      };
    }

    // Process rows
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      try {
        // Resolve academic year
        const academicYear = yearMap.get(String(row.academic_year ?? '').toLowerCase().trim());
        if (!academicYear) {
          errors.push({ row: rowNum, message: `Academic year "${row.academic_year}" not found. Create it in Academic Setup first.` });
          continue;
        }

        // Resolve term
        const yearTerms = termsByYear.get(academicYear.id) ?? [];
        const term = yearTerms.find(
          (t) => t.name.toLowerCase().trim() === String(row.term ?? '').toLowerCase().trim(),
        );
        if (!term) {
          errors.push({ row: rowNum, message: `Term "${row.term}" not found in academic year "${row.academic_year}".` });
          continue;
        }

        // Resolve subject
        const subject = subjectMap.get(String(row.subject_name ?? '').toLowerCase().trim());
        if (!subject) {
          errors.push({ row: rowNum, message: `Subject "${row.subject_name}" not found in this school.` });
          continue;
        }

        // Resolve class
        const classInfo = classMap.get(String(row.class_name ?? '').toLowerCase().trim());
        if (!classInfo) {
          errors.push({ row: rowNum, message: `Class "${row.class_name}" not found. Check the exact class name.` });
          continue;
        }
        if (!classInfo.schoolId) {
          errors.push({ row: rowNum, message: `Class "${row.class_name}" is not assigned to a school.` });
          continue;
        }
        resolveWriteSchoolId(user, classInfo.schoolId);

        // Resolve student
        const student = studentMap.get(String(row.student_registration ?? '').trim().toUpperCase());
        if (!student) {
          errors.push({ row: rowNum, message: `Student "${row.student_registration}" not found. Check the registration number.` });
          continue;
        }
        if (student.schoolId !== classInfo.schoolId) {
          errors.push({ row: rowNum, message: `Student "${row.student_registration}" belongs to a different school.` });
          continue;
        }

        // Parse score
        const isAbsent = this.parseBoolean(String(row.is_absent ?? ''));
        const rawMax = this.parseScore(row.max_score);
        const maxScore = isNaN(rawMax) || rawMax <= 0 ? 100 : rawMax;
        const rawScore = isAbsent ? 0 : this.parseScore(row.score);

        if (!isAbsent && isNaN(rawScore)) {
          errors.push({ row: rowNum, message: `Score "${row.score}" is not a valid number.` });
          continue;
        }

        const weightedTotal = isAbsent ? 0 : Math.min(100, Math.max(0, (rawScore / maxScore) * 100));
        const grade = row.grade?.trim().toUpperCase() || this.calculateGrade(weightedTotal);
        const gradePoints = this.gradeToPoints(grade);
        const remark = row.remark?.trim() || (isAbsent ? 'ABSENT' : this.gradeRemark(grade));

        const educationStage: EducationStage =
          (row.education_stage?.trim().toUpperCase() as EducationStage) ||
          (classInfo.educationStage as EducationStage) ||
          this.deriveStage(row.class_name);

        // Find or create ClassSubject
        let classSubject = await this.prisma.classSubject.findFirst({
          where: {
            classId: classInfo.id,
            subjectId: subject.id,
            academicYearId: academicYear.id,
            combinationId: null,
          },
        });
        if (!classSubject) {
          classSubject = await this.prisma.classSubject.create({
            data: {
              classId: classInfo.id,
              subjectId: subject.id,
              academicYearId: academicYear.id,
              teacherId: user.id,
              educationStage,
              schoolId: classInfo.schoolId,
            },
          });
        }

        // Upsert TermResult
        await this.prisma.termResult.upsert({
          where: {
            studentId_classSubjectId_termId: {
              studentId: student.id,
              classSubjectId: classSubject.id,
              termId: term.id,
            },
          },
          create: {
            studentId: student.id,
            classId: classInfo.id,
            classSubjectId: classSubject.id,
            subjectId: subject.id,
            subjectName: subject.name,
            educationStage,
            termId: term.id,
            academicYearId: academicYear.id,
            assessmentScores: {},
            weightedTotal,
            grade,
            gradePoints,
            remark,
            isPassing: weightedTotal >= 50,
            teacherId: user.id,
            isPublished: true,
            publishedAt: new Date(),
            publishedById: user.id,
            schoolId: classInfo.schoolId,
          },
          update: {
            weightedTotal,
            grade,
            gradePoints,
            remark,
            isPassing: weightedTotal >= 50,
          },
        });

        imported++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unexpected error';
        this.logger.error(`Import row ${rowNum}: ${msg}`);
        errors.push({ row: rowNum, message: msg });
      }
    }

    return { total: rows.length, imported, skipped: 0, errors };
  }
}
