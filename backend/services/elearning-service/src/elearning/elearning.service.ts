import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, normalize } from 'node:path';
import {
  AssignmentType,
  AttemptStatus,
  MaterialType,
  Prisma,
  PublishStatus,
  QuestionType,
  SubmissionStatus,
} from '../../generated/prisma';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMqService } from '../rabbitmq/rabbitmq.service';

const LEADERSHIP = ['SYSTEM_ADMIN', 'PRINCIPAL', 'ACADEMIC_QA', 'HEAD_OF_DEPARTMENT'];

@Injectable()
export class ElearningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly rabbitmq: RabbitMqService,
  ) {}

  async listCourses(user: RequestUser, query: Record<string, string>) {
    const where: Prisma.CourseSpaceWhereInput = {};
    if (query.status) where.status = query.status.toUpperCase() as never;
    if (user.role === 'TEACHER') where.teacherId = user.id;
    if (user.role === 'STUDENT') where.enrollments = { some: { studentId: this.studentId(user), status: 'ACTIVE' } };
    return this.prisma.courseSpace.findMany({
      where,
      include: this.courseIncludes(),
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createCourse(user: RequestUser, body: Record<string, unknown>) {
    this.assertRole(user, ['TEACHER', 'SYSTEM_ADMIN']);
    const course = await this.prisma.courseSpace.create({
      data: {
        classSubjectId: this.required(body.classSubjectId, 'classSubjectId'),
        teacherId: String(body.teacherId || user.id),
        termId: this.required(body.termId, 'termId'),
        academicYearId: this.required(body.academicYearId, 'academicYearId'),
        subjectName: this.required(body.subjectName, 'subjectName'),
        className: this.required(body.className, 'className'),
        description: this.optionalString(body.description),
        coverColor: this.optionalString(body.coverColor),
        coverEmoji: this.optionalString(body.coverEmoji) || '📘',
      },
      include: this.courseIncludes(),
    });
    await this.audit(user, 'COURSE_CREATED', 'CourseSpace', course.id, course);
    return course;
  }

  async getCourse(user: RequestUser, id: string) {
    const course = await this.prisma.courseSpace.findUnique({ where: { id }, include: this.courseIncludes() });
    if (!course) throw new NotFoundException('Course not found');
    await this.assertCourseAccess(user, course.id, course.teacherId);
    return course;
  }

  async updateCourse(user: RequestUser, id: string, body: Record<string, unknown>) {
    const course = await this.getCourse(user, id);
    this.assertTeacherOwner(user, course.teacherId);
    const updated = await this.prisma.courseSpace.update({
      where: { id },
      data: {
        subjectName: this.optionalString(body.subjectName),
        className: this.optionalString(body.className),
        description: this.optionalString(body.description),
        coverColor: this.optionalString(body.coverColor),
        coverEmoji: this.optionalString(body.coverEmoji),
      },
      include: this.courseIncludes(),
    });
    await this.audit(user, 'COURSE_UPDATED', 'CourseSpace', id, body);
    return updated;
  }

  async publishCourse(user: RequestUser, id: string) {
    const course = await this.getCourse(user, id);
    this.assertTeacherOwner(user, course.teacherId);
    const publishedLessons = await this.prisma.lesson.count({ where: { courseSpaceId: id, status: 'PUBLISHED' } });
    if (publishedLessons < 1) throw new BadRequestException('Course must have at least one published lesson');
    const updated = await this.prisma.courseSpace.update({
      where: { id },
      data: { status: 'ACTIVE', publishedAt: new Date() },
      include: this.courseIncludes(),
    });
    await this.audit(user, 'COURSE_PUBLISHED', 'CourseSpace', id, updated);
    return updated;
  }

  async archiveCourse(user: RequestUser, id: string) {
    const course = await this.getCourse(user, id);
    this.assertTeacherOwner(user, course.teacherId);
    const updated = await this.prisma.courseSpace.update({
      where: { id },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
    });
    await this.audit(user, 'COURSE_ARCHIVED', 'CourseSpace', id, updated);
    return updated;
  }

  async courseOverview(user: RequestUser, courseId: string) {
    const course = await this.getCourse(user, courseId);
    const [pendingSubmissions, attempts, materialViews, enrollments] = await Promise.all([
      this.prisma.submission.count({ where: { courseSpaceId: courseId, status: 'SUBMITTED' } }),
      this.prisma.quizAttempt.count({ where: { courseSpaceId: courseId } }),
      this.prisma.materialProgress.count({ where: { courseSpaceId: courseId, viewedAt: { not: null } } }),
      this.prisma.courseEnrollment.count({ where: { courseSpaceId: courseId, status: 'ACTIVE' } }),
    ]);
    return { course, pendingSubmissions, attempts, materialViews, enrollments };
  }

  async courseStudents(user: RequestUser, courseId: string) {
    const course = await this.getCourse(user, courseId);
    if (!['TEACHER', 'HEAD_OF_DEPARTMENT', 'SYSTEM_ADMIN'].includes(user.role)) throw new ForbiddenException('Forbidden');
    const enrollments = await this.prisma.courseEnrollment.findMany({ where: { courseSpaceId: courseId }, orderBy: { enrolledAt: 'desc' } });
    return Promise.all(enrollments.map(async (enrollment) => ({
      ...enrollment,
      progress: await this.progressForStudent(courseId, enrollment.studentId),
      courseTeacherId: course.teacherId,
    })));
  }

  async syncEnrollments(user: RequestUser, courseId: string, body: Record<string, unknown>) {
    const course = await this.getCourse(user, courseId);
    this.assertTeacherOwner(user, course.teacherId);
    const studentIds = (Array.isArray(body.studentIds) ? body.studentIds : []).map(String);
    if (!studentIds.length) throw new BadRequestException('studentIds is required');
    await this.prisma.$transaction(studentIds.map((studentId) => this.prisma.courseEnrollment.upsert({
      where: { courseSpaceId_studentId: { courseSpaceId: courseId, studentId } },
      update: { status: 'ACTIVE' },
      create: { courseSpaceId: courseId, studentId },
    })));
    const enrolledCount = await this.prisma.courseEnrollment.count({ where: { courseSpaceId: courseId, status: 'ACTIVE' } });
    await this.prisma.courseSpace.update({ where: { id: courseId }, data: { enrolledCount } });
    await this.audit(user, 'COURSE_ENROLLMENTS_SYNCED', 'CourseSpace', courseId, { studentIds });
    return { courseId, enrolledCount, studentIds };
  }

  async listLessons(user: RequestUser, courseId: string) {
    await this.getCourse(user, courseId);
    return this.prisma.lesson.findMany({ where: { courseSpaceId: courseId }, include: { materials: true }, orderBy: { orderIndex: 'asc' } });
  }

  async createLesson(user: RequestUser, courseId: string, body: Record<string, unknown>) {
    const course = await this.getCourse(user, courseId);
    this.assertTeacherOwner(user, course.teacherId);
    const lesson = await this.prisma.lesson.create({
      data: {
        courseSpaceId: courseId,
        title: this.required(body.title, 'title'),
        description: this.optionalString(body.description),
        weekNumber: this.optionalNumber(body.weekNumber),
        orderIndex: this.optionalNumber(body.orderIndex) ?? await this.prisma.lesson.count({ where: { courseSpaceId: courseId } }),
        estimatedMinutes: this.optionalNumber(body.estimatedMinutes),
      },
    });
    await this.audit(user, 'LESSON_CREATED', 'Lesson', lesson.id, lesson);
    return lesson;
  }

  async updateLesson(user: RequestUser, courseId: string, id: string, body: Record<string, unknown>) {
    await this.assertCourseOwnerFromCourseId(user, courseId);
    const lesson = await this.prisma.lesson.update({ where: { id }, data: this.clean(body, ['title', 'description', 'orderIndex', 'weekNumber', 'estimatedMinutes']) });
    await this.audit(user, 'LESSON_UPDATED', 'Lesson', id, body);
    return lesson;
  }

  async publishLesson(user: RequestUser, courseId: string, id: string) {
    await this.assertCourseOwnerFromCourseId(user, courseId);
    return this.prisma.lesson.update({ where: { id }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
  }

  async archiveLesson(user: RequestUser, courseId: string, id: string) {
    await this.assertCourseOwnerFromCourseId(user, courseId);
    return this.prisma.lesson.update({ where: { id }, data: { status: 'ARCHIVED' } });
  }

  async reorderLessons(user: RequestUser, courseId: string, body: Record<string, unknown>) {
    await this.assertCourseOwnerFromCourseId(user, courseId);
    const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
    await this.prisma.$transaction(ids.map((id, orderIndex) => this.prisma.lesson.update({ where: { id }, data: { orderIndex } })));
    return this.listLessons(user, courseId);
  }

  async listMaterials(user: RequestUser, courseId: string, lessonId: string) {
    await this.getCourse(user, courseId);
    return this.prisma.material.findMany({ where: { courseSpaceId: courseId, lessonId }, orderBy: { orderIndex: 'asc' } });
  }

  async createMaterial(user: RequestUser, courseId: string, lessonId: string, body: Record<string, unknown>) {
    await this.assertCourseOwnerFromCourseId(user, courseId);
    const material = await this.prisma.material.create({
      data: {
        courseSpaceId: courseId,
        lessonId,
        title: this.required(body.title, 'title'),
        type: this.enumValue(MaterialType, body.type, 'NOTE'),
        body: this.optionalString(body.body),
        externalUrl: this.optionalString(body.externalUrl),
        fileKey: this.optionalString(body.fileKey),
        fileOriginalName: this.optionalString(body.fileOriginalName),
        fileMimeType: this.optionalString(body.fileMimeType),
        fileSizeBytes: body.fileSizeBytes == null ? undefined : BigInt(Number(body.fileSizeBytes)),
        orderIndex: this.optionalNumber(body.orderIndex) ?? await this.prisma.material.count({ where: { lessonId } }),
        downloadable: body.downloadable !== false,
        status: this.enumValue(PublishStatus, body.status, 'DRAFT'),
        publishedAt: String(body.status || '').toUpperCase() === 'PUBLISHED' ? new Date() : undefined,
      },
    });
    await this.audit(user, 'MATERIAL_CREATED', 'Material', material.id, material);
    return material;
  }

  async updateMaterial(user: RequestUser, courseId: string, _lessonId: string, id: string, body: Record<string, unknown>) {
    await this.assertCourseOwnerFromCourseId(user, courseId);
    return this.prisma.material.update({ where: { id }, data: this.clean(body, ['title', 'body', 'externalUrl', 'status', 'orderIndex']) });
  }

  async archiveMaterial(user: RequestUser, courseId: string, _lessonId: string, id: string) {
    await this.assertCourseOwnerFromCourseId(user, courseId);
    return this.prisma.material.update({ where: { id }, data: { status: 'ARCHIVED' } });
  }

  async reorderMaterials(user: RequestUser, courseId: string, lessonId: string, body: Record<string, unknown>) {
    await this.assertCourseOwnerFromCourseId(user, courseId);
    const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
    await this.prisma.$transaction(ids.map((id, orderIndex) => this.prisma.material.update({ where: { id }, data: { orderIndex } })));
    return this.listMaterials(user, courseId, lessonId);
  }

  async viewMaterial(user: RequestUser, id: string) {
    this.assertRole(user, ['STUDENT', 'SYSTEM_ADMIN']);
    const material = await this.prisma.material.findUnique({ where: { id } });
    if (!material) throw new NotFoundException('Material not found');
    const studentId = this.studentId(user);
    await this.assertStudentEnrollment(material.courseSpaceId, studentId);
    const progress = await this.prisma.materialProgress.upsert({
      where: { materialId_studentId: { materialId: id, studentId } },
      update: { viewedAt: new Date(), completedAt: new Date() },
      create: { materialId: id, courseSpaceId: material.courseSpaceId, studentId, viewedAt: new Date(), completedAt: new Date() },
    });
    await this.prisma.material.update({ where: { id }, data: { viewCount: { increment: 1 } } });
    await this.touchEnrollment(material.courseSpaceId, studentId);
    return progress;
  }

  async downloadMaterial(user: RequestUser, id: string) {
    const material = await this.prisma.material.findUnique({ where: { id } });
    if (!material) throw new NotFoundException('Material not found');
    if (user.role === 'STUDENT') {
      const studentId = this.studentId(user);
      await this.assertStudentEnrollment(material.courseSpaceId, studentId);
      await this.prisma.materialProgress.upsert({
        where: { materialId_studentId: { materialId: id, studentId } },
        update: { isDownloaded: true },
        create: { materialId: id, courseSpaceId: material.courseSpaceId, studentId, isDownloaded: true },
      });
    }
    const fileUrl = material.externalUrl ?? (material.fileKey ? this.fileKeyToUrl(material.fileKey) : null);
    return { material, download: { url: fileUrl, expiresAt: new Date(Date.now() + 600_000).toISOString() } };
  }

  async readStorageFile(domain: string, filename: string): Promise<{ stream: ReturnType<typeof createReadStream>; filename: string; mimeType: string }> {
    const storageRoot = normalize(this.config.get<string>('ELEARNING_STORAGE_DIR', './storage/elearning'));
    const safeDomain = domain.replace(/[^a-zA-Z0-9_-]/g, '');
    const safeFilename = filename.replace(/\.\./g, '').replace(/[/\\]/g, '');
    const absolutePath = normalize(join(storageRoot, safeDomain, safeFilename));
    if (!absolutePath.startsWith(storageRoot)) throw new ForbiddenException('Invalid path');
    const ext = safeFilename.split('.').pop()?.toLowerCase() ?? '';
    const mimeMap: Record<string, string> = {
      pdf: 'application/pdf', mp4: 'video/mp4', webm: 'video/webm',
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
      mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      txt: 'text/plain', zip: 'application/zip',
    };
    const mimeType = mimeMap[ext] ?? 'application/octet-stream';
    const stream = createReadStream(absolutePath);
    await new Promise<void>((resolve, reject) => {
      stream.once('readable', resolve);
      stream.once('error', () => reject(new NotFoundException('File not found')));
    });
    return { stream, filename: safeFilename, mimeType };
  }

  async createAssignment(user: RequestUser, courseId: string, body: Record<string, unknown>) {
    await this.assertCourseOwnerFromCourseId(user, courseId);
    const assignment = await this.prisma.assignment.create({
      data: {
        courseSpaceId: courseId,
        lessonId: this.optionalString(body.lessonId),
        title: this.required(body.title, 'title'),
        instructions: this.required(body.instructions, 'instructions'),
        type: this.enumValue(AssignmentType, body.type, 'BOTH'),
        maxScore: this.decimal(body.maxScore),
        dueAt: body.dueAt ? new Date(String(body.dueAt)) : undefined,
        allowLateSubmission: body.allowLateSubmission !== false,
        latePenaltyPercent: this.decimal(body.latePenaltyPercent),
      },
    });
    await this.audit(user, 'ASSIGNMENT_CREATED', 'Assignment', assignment.id, assignment);
    return assignment;
  }

  async listAssignments(user: RequestUser, courseId: string) {
    await this.getCourse(user, courseId);
    return this.prisma.assignment.findMany({ where: { courseSpaceId: courseId }, include: { submissions: true }, orderBy: { dueAt: 'asc' } });
  }

  async getAssignment(user: RequestUser, courseId: string, id: string) {
    await this.getCourse(user, courseId);
    const assignment = await this.prisma.assignment.findUnique({ where: { id }, include: { submissions: true } });
    if (!assignment) throw new NotFoundException('Assignment not found');
    return assignment;
  }

  async updateAssignment(user: RequestUser, courseId: string, id: string, body: Record<string, unknown>) {
    await this.assertCourseOwnerFromCourseId(user, courseId);
    return this.prisma.assignment.update({ where: { id }, data: this.clean(body, ['title', 'instructions', 'type', 'dueAt', 'allowLateSubmission', 'status']) });
  }

  async publishAssignment(user: RequestUser, courseId: string, id: string) {
    await this.assertCourseOwnerFromCourseId(user, courseId);
    const assignment = await this.prisma.assignment.update({ where: { id }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
    await this.audit(user, 'ASSIGNMENT_PUBLISHED', 'Assignment', id, assignment);
    const enrollments = await this.prisma.courseEnrollment.findMany({ where: { courseSpaceId: courseId, status: 'ACTIVE' }, select: { studentId: true } });
    await this.rabbitmq.publish('assignment.published', {
      assignmentId: id,
      courseId,
      title: assignment.title,
      dueAt: assignment.dueAt,
      teacherId: user.id,
      studentIds: enrollments.map((e) => e.studentId),
    });
    return assignment;
  }

  async closeAssignment(user: RequestUser, courseId: string, id: string) {
    await this.assertCourseOwnerFromCourseId(user, courseId);
    return this.prisma.assignment.update({ where: { id }, data: { status: 'CLOSED', closedAt: new Date() } });
  }

  async assignmentSubmissions(user: RequestUser, courseId: string, assignmentId: string) {
    await this.assertCourseOwnerFromCourseId(user, courseId);
    return this.prisma.submission.findMany({ where: { assignmentId }, orderBy: { updatedAt: 'desc' } });
  }

  async assignmentSummary(user: RequestUser, courseId: string, assignmentId: string) {
    await this.getCourse(user, courseId);
    const [submitted, graded, late, total] = await Promise.all([
      this.prisma.submission.count({ where: { assignmentId, status: { in: ['SUBMITTED', 'GRADED'] } } }),
      this.prisma.submission.count({ where: { assignmentId, status: 'GRADED' } }),
      this.prisma.submission.count({ where: { assignmentId, isLate: true } }),
      this.prisma.courseEnrollment.count({ where: { courseSpaceId: courseId, status: 'ACTIVE' } }),
    ]);
    return { assignmentId, submitted, graded, late, missing: Math.max(total - submitted, 0), total };
  }

  async missingSubmissions(user: RequestUser, courseId: string, assignmentId: string) {
    await this.assertCourseOwnerFromCourseId(user, courseId);
    const [enrollments, submissions] = await Promise.all([
      this.prisma.courseEnrollment.findMany({
        where: { courseSpaceId: courseId, status: 'ACTIVE' },
        orderBy: { enrolledAt: 'asc' },
      }),
      this.prisma.submission.findMany({
        where: { assignmentId, status: { in: ['SUBMITTED', 'GRADED'] } },
        select: { studentId: true },
      }),
    ]);
    const submitted = new Set(submissions.map((item) => item.studentId));
    return enrollments
      .filter((item) => !submitted.has(item.studentId))
      .map((item) => ({
        studentId: item.studentId,
        enrolledAt: item.enrolledAt,
        lastActivityAt: item.lastActivityAt,
        status: 'MISSING',
      }));
  }

  async mySubmission(user: RequestUser, assignmentId: string) {
    this.assertRole(user, ['STUDENT', 'SYSTEM_ADMIN']);
    return this.prisma.submission.findUnique({ where: { assignmentId_studentId: { assignmentId, studentId: this.studentId(user) } } });
  }

  async upsertSubmission(user: RequestUser, assignmentId: string, body: Record<string, unknown>) {
    this.assertRole(user, ['STUDENT', 'SYSTEM_ADMIN']);
    const assignment = await this.prisma.assignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException('Assignment not found');
    const studentId = this.studentId(user);
    await this.assertStudentEnrollment(assignment.courseSpaceId, studentId);
    const shouldSubmit = body.submit === true || String(body.status || '').toUpperCase() === 'SUBMITTED';
    const isLate = Boolean(assignment.dueAt && new Date() > assignment.dueAt);
    const submission = await this.prisma.submission.upsert({
      where: { assignmentId_studentId: { assignmentId, studentId } },
      update: {
        textContent: this.optionalString(body.textContent),
        fileKey: this.optionalString(body.fileKey),
        fileOriginalName: this.optionalString(body.fileOriginalName),
        fileMimeType: this.optionalString(body.fileMimeType),
        fileSizeBytes: body.fileSizeBytes == null ? undefined : BigInt(Number(body.fileSizeBytes)),
        status: shouldSubmit ? 'SUBMITTED' : 'DRAFT',
        submittedAt: shouldSubmit ? new Date() : undefined,
        isLate,
      },
      create: {
        assignmentId,
        studentId,
        courseSpaceId: assignment.courseSpaceId,
        textContent: this.optionalString(body.textContent),
        fileKey: this.optionalString(body.fileKey),
        fileOriginalName: this.optionalString(body.fileOriginalName),
        fileMimeType: this.optionalString(body.fileMimeType),
        fileSizeBytes: body.fileSizeBytes == null ? undefined : BigInt(Number(body.fileSizeBytes)),
        status: shouldSubmit ? 'SUBMITTED' : 'DRAFT',
        submittedAt: shouldSubmit ? new Date() : undefined,
        isLate,
      },
    });
    await this.touchEnrollment(assignment.courseSpaceId, studentId);
    await this.audit(user, shouldSubmit ? 'ASSIGNMENT_SUBMITTED' : 'SUBMISSION_SAVED', 'Submission', submission.id, submission);
    return submission;
  }

  async submitSubmission(user: RequestUser, assignmentId: string, id: string) {
    await this.mySubmission(user, assignmentId);
    return this.prisma.submission.update({ where: { id }, data: { status: 'SUBMITTED', submittedAt: new Date() } });
  }

  async getSubmission(user: RequestUser, id: string) {
    const submission = await this.prisma.submission.findUnique({ where: { id }, include: { assignment: { include: { courseSpace: true } } } });
    if (!submission) throw new NotFoundException('Submission not found');
    if (user.role === 'STUDENT' && submission.studentId !== this.studentId(user)) throw new ForbiddenException('Forbidden');
    if (user.role === 'TEACHER') this.assertTeacherOwner(user, submission.assignment.courseSpace.teacherId);
    return submission;
  }

  async gradeSubmission(user: RequestUser, id: string, body: Record<string, unknown>) {
    const submission = await this.getSubmission(user, id);
    if (user.role === 'TEACHER') this.assertTeacherOwner(user, submission.assignment.courseSpace.teacherId);
    const graded = await this.prisma.submission.update({
      where: { id },
      data: {
        status: 'GRADED',
        score: this.decimal(body.score),
        maxScore: this.decimal(body.maxScore) ?? submission.assignment.maxScore,
        feedback: this.optionalString(body.feedback),
        gradedAt: new Date(),
        gradedBy: user.id,
      },
    });
    await this.audit(user, 'SUBMISSION_GRADED', 'Submission', id, graded);
    await this.rabbitmq.publish('submission.graded', {
      submissionId: id,
      studentId: graded.studentId,
      courseId: graded.courseSpaceId,
      assignmentId: graded.assignmentId,
      score: graded.score,
      maxScore: graded.maxScore,
      feedback: graded.feedback,
      teacherId: user.id,
    });
    return graded;
  }

  async returnSubmission(user: RequestUser, id: string, body: Record<string, unknown>) {
    await this.getSubmission(user, id);
    return this.prisma.submission.update({ where: { id }, data: { status: 'RETURNED', feedback: this.optionalString(body.feedback) } });
  }

  async mySubmissions(user: RequestUser, courseId: string) {
    this.assertRole(user, ['STUDENT', 'SYSTEM_ADMIN']);
    return this.prisma.submission.findMany({ where: { courseSpaceId: courseId, studentId: this.studentId(user) }, include: { assignment: true } });
  }

  async listQuizzes(user: RequestUser, courseId: string) {
    await this.getCourse(user, courseId);
    return this.prisma.quiz.findMany({ where: { courseSpaceId: courseId }, include: { questions: { include: { options: true } }, attempts: user.role === 'STUDENT' ? { where: { studentId: this.studentId(user) } } : true } });
  }

  async createQuiz(user: RequestUser, courseId: string, body: Record<string, unknown>) {
    await this.assertCourseOwnerFromCourseId(user, courseId);
    const quiz = await this.prisma.quiz.create({
      data: {
        courseSpaceId: courseId,
        lessonId: this.optionalString(body.lessonId),
        title: this.required(body.title, 'title'),
        instructions: this.optionalString(body.instructions),
        timeLimitMinutes: this.optionalNumber(body.timeLimitMinutes),
        maxAttempts: this.optionalNumber(body.maxAttempts) ?? 1,
        passingScore: this.decimal(body.passingScore),
      },
    });
    await this.audit(user, 'QUIZ_CREATED', 'Quiz', quiz.id, quiz);
    return quiz;
  }

  async getQuiz(user: RequestUser, courseId: string, id: string) {
    await this.getCourse(user, courseId);
    const quiz = await this.prisma.quiz.findUnique({ where: { id }, include: { questions: { include: { options: true } } } });
    if (!quiz) throw new NotFoundException('Quiz not found');
    if (user.role === 'STUDENT') {
      return { ...quiz, questions: quiz.questions.map((q) => ({ ...q, correctAnswer: undefined, options: q.options.map((o) => ({ ...o, isCorrect: undefined })) })) };
    }
    return quiz;
  }

  async updateQuiz(user: RequestUser, courseId: string, id: string, body: Record<string, unknown>) {
    await this.assertCourseOwnerFromCourseId(user, courseId);
    return this.prisma.quiz.update({ where: { id }, data: this.clean(body, ['title', 'instructions', 'timeLimitMinutes', 'maxAttempts', 'passingScore', 'status']) });
  }

  async publishQuiz(user: RequestUser, courseId: string, id: string) {
    await this.assertCourseOwnerFromCourseId(user, courseId);
    const quiz = await this.prisma.quiz.update({ where: { id }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
    await this.audit(user, 'QUIZ_PUBLISHED', 'Quiz', id, quiz);
    const enrollments = await this.prisma.courseEnrollment.findMany({ where: { courseSpaceId: courseId, status: 'ACTIVE' }, select: { studentId: true } });
    await this.rabbitmq.publish('quiz.published', {
      quizId: id,
      courseId,
      title: quiz.title,
      teacherId: user.id,
      studentIds: enrollments.map((e) => e.studentId),
    });
    return quiz;
  }

  async closeQuiz(user: RequestUser, courseId: string, id: string) {
    await this.assertCourseOwnerFromCourseId(user, courseId);
    return this.prisma.quiz.update({ where: { id }, data: { status: 'CLOSED', closedAt: new Date() } });
  }

  async quizResults(user: RequestUser, courseId: string, id: string) {
    await this.getCourse(user, courseId);
    return this.prisma.quizAttempt.findMany({ where: { quizId: id }, include: { answers: true }, orderBy: { submittedAt: 'desc' } });
  }

  async addQuestion(user: RequestUser, quizId: string, body: Record<string, unknown>) {
    const quiz = await this.prisma.quiz.findUnique({ where: { id: quizId } });
    if (!quiz) throw new NotFoundException('Quiz not found');
    await this.assertCourseOwnerFromCourseId(user, quiz.courseSpaceId);
    const question = await this.prisma.quizQuestion.create({
      data: {
        quizId,
        type: this.enumValue(QuestionType, body.type, 'MULTIPLE_CHOICE'),
        prompt: this.required(body.prompt, 'prompt'),
        points: this.decimal(body.points) ?? 1,
        orderIndex: this.optionalNumber(body.orderIndex) ?? await this.prisma.quizQuestion.count({ where: { quizId } }),
        explanation: this.optionalString(body.explanation),
        correctAnswer: this.optionalString(body.correctAnswer),
        options: Array.isArray(body.options) ? {
          create: body.options.map((option, index) => ({
            text: String((option as Record<string, unknown>).text || ''),
            isCorrect: Boolean((option as Record<string, unknown>).isCorrect),
            orderIndex: Number((option as Record<string, unknown>).orderIndex ?? index),
          })),
        } : undefined,
      },
      include: { options: true },
    });
    await this.recalculateQuizPoints(quizId);
    return question;
  }

  async updateQuestion(user: RequestUser, quizId: string, questionId: string, body: Record<string, unknown>) {
    const quiz = await this.prisma.quiz.findUnique({ where: { id: quizId } });
    if (!quiz) throw new NotFoundException('Quiz not found');
    await this.assertCourseOwnerFromCourseId(user, quiz.courseSpaceId);
    const updated = await this.prisma.quizQuestion.update({ where: { id: questionId }, data: this.clean(body, ['type', 'prompt', 'points', 'orderIndex', 'explanation', 'correctAnswer']) });
    await this.recalculateQuizPoints(quizId);
    return updated;
  }

  async deleteQuestion(user: RequestUser, quizId: string, questionId: string) {
    const quiz = await this.prisma.quiz.findUnique({ where: { id: quizId } });
    if (!quiz) throw new NotFoundException('Quiz not found');
    await this.assertCourseOwnerFromCourseId(user, quiz.courseSpaceId);
    await this.prisma.quizQuestion.delete({ where: { id: questionId } });
    await this.recalculateQuizPoints(quizId);
    return { deleted: true };
  }

  async reorderQuestions(user: RequestUser, quizId: string, body: Record<string, unknown>) {
    const quiz = await this.prisma.quiz.findUnique({ where: { id: quizId } });
    if (!quiz) throw new NotFoundException('Quiz not found');
    await this.assertCourseOwnerFromCourseId(user, quiz.courseSpaceId);
    const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
    await this.prisma.$transaction(ids.map((id, orderIndex) => this.prisma.quizQuestion.update({ where: { id }, data: { orderIndex } })));
    return this.prisma.quizQuestion.findMany({ where: { quizId }, include: { options: true }, orderBy: { orderIndex: 'asc' } });
  }

  async startAttempt(user: RequestUser, quizId: string) {
    this.assertRole(user, ['STUDENT', 'SYSTEM_ADMIN']);
    const quiz = await this.prisma.quiz.findUnique({ where: { id: quizId }, include: { questions: true } });
    if (!quiz) throw new NotFoundException('Quiz not found');
    const studentId = this.studentId(user);
    await this.assertStudentEnrollment(quiz.courseSpaceId, studentId);
    const count = await this.prisma.quizAttempt.count({ where: { quizId, studentId } });
    if (count >= quiz.maxAttempts) throw new BadRequestException('Maximum attempts reached');
    return this.prisma.quizAttempt.create({ data: { quizId, studentId, courseSpaceId: quiz.courseSpaceId, attemptNumber: count + 1 } });
  }

  async activeAttempt(user: RequestUser, quizId: string) {
    const attempt = await this.prisma.quizAttempt.findFirst({ where: { quizId, studentId: this.studentId(user), status: 'IN_PROGRESS' }, include: { answers: true } });
    if (!attempt) throw new NotFoundException('No active attempt');
    return attempt;
  }

  async saveAnswer(user: RequestUser, attemptId: string, body: Record<string, unknown>) {
    const attempt = await this.getAttempt(user, attemptId);
    if (attempt.status !== 'IN_PROGRESS') throw new BadRequestException('Attempt is already submitted');
    return this.prisma.quizAnswer.upsert({
      where: { attemptId_questionId: { attemptId, questionId: this.required(body.questionId, 'questionId') } },
      update: { selectedOptionId: this.optionalString(body.selectedOptionId), textAnswer: this.optionalString(body.textAnswer), answeredAt: new Date() },
      create: { attemptId, questionId: this.required(body.questionId, 'questionId'), selectedOptionId: this.optionalString(body.selectedOptionId), textAnswer: this.optionalString(body.textAnswer) },
    });
  }

  async submitAttempt(user: RequestUser, attemptId: string) {
    const attempt = await this.getAttempt(user, attemptId);
    const questions = await this.prisma.quizQuestion.findMany({ where: { quizId: attempt.quizId }, include: { options: true } });
    const answers = await this.prisma.quizAnswer.findMany({ where: { attemptId } });
    let totalScore = 0;
    let maxScore = 0;
    for (const question of questions) {
      const points = Number(question.points);
      maxScore += points;
      const answer = answers.find((item) => item.questionId === question.id);
      let isCorrect: boolean | null = null;
      if (answer && question.type !== 'SHORT_ANSWER') {
        isCorrect = question.type === 'TRUE_FALSE'
          ? String(answer.textAnswer).toLowerCase() === String(question.correctAnswer).toLowerCase()
          : question.options.some((option) => option.id === answer.selectedOptionId && option.isCorrect);
        if (isCorrect) totalScore += points;
        await this.prisma.quizAnswer.update({ where: { id: answer.id }, data: { isCorrect, scoreAwarded: isCorrect ? points : 0 } });
      }
    }
    const percentScore = maxScore ? (totalScore / maxScore) * 100 : 0;
    const result = await this.prisma.quizAttempt.update({
      where: { id: attemptId },
      data: {
        status: 'AUTO_GRADED',
        submittedAt: new Date(),
        totalScore,
        maxScore,
        percentScore,
        isPassed: attempt.quiz.passingScore == null ? null : percentScore >= Number(attempt.quiz.passingScore),
      },
      include: { answers: true },
    });
    await this.rabbitmq.publish('quiz.result', {
      attemptId,
      studentId: attempt.studentId,
      quizId: attempt.quizId,
      courseId: attempt.courseSpaceId,
      totalScore,
      maxScore,
      percentScore,
      isPassed: result.isPassed,
    });
    return result;
  }

  async getAttempt(user: RequestUser, attemptId: string) {
    const attempt = await this.prisma.quizAttempt.findUnique({ where: { id: attemptId }, include: { quiz: true, answers: true } });
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (user.role === 'STUDENT' && attempt.studentId !== this.studentId(user)) throw new ForbiddenException('Forbidden');
    return attempt;
  }

  async myAttempts(user: RequestUser, quizId: string) {
    return this.prisma.quizAttempt.findMany({ where: { quizId, studentId: this.studentId(user) }, include: { answers: true } });
  }

  async gradeShortAnswer(user: RequestUser, attemptId: string, body: Record<string, unknown>) {
    const attempt = await this.getAttempt(user, attemptId);
    await this.assertCourseOwnerFromCourseId(user, attempt.courseSpaceId);
    const questionId = this.required(body.questionId, 'questionId');
    return this.prisma.quizAnswer.update({
      where: { attemptId_questionId: { attemptId, questionId } },
      data: { scoreAwarded: this.decimal(body.scoreAwarded), isCorrect: Number(body.scoreAwarded || 0) > 0 },
    });
  }

  async myProgress(user: RequestUser, courseId: string) {
    return this.progressForStudent(courseId, this.studentId(user));
  }

  async progressForStudent(courseId: string, studentId: string) {
    const [lessons, materials, viewed, assignments, submissions, quizzes, attempts] = await Promise.all([
      this.prisma.lesson.count({ where: { courseSpaceId: courseId, status: { not: 'ARCHIVED' } } }),
      this.prisma.material.count({ where: { courseSpaceId: courseId, status: { not: 'ARCHIVED' } } }),
      this.prisma.materialProgress.count({ where: { courseSpaceId: courseId, studentId, viewedAt: { not: null } } }),
      this.prisma.assignment.count({ where: { courseSpaceId: courseId, status: { in: ['PUBLISHED', 'CLOSED'] } } }),
      this.prisma.submission.count({ where: { courseSpaceId: courseId, studentId, status: { in: ['SUBMITTED', 'GRADED'] } } }),
      this.prisma.quiz.count({ where: { courseSpaceId: courseId, status: { in: ['PUBLISHED', 'CLOSED'] } } }),
      this.prisma.quizAttempt.count({ where: { courseSpaceId: courseId, studentId, status: { in: ['SUBMITTED', 'AUTO_GRADED', 'MANUALLY_GRADED'] } } }),
    ]);
    const materialCompletion = materials ? Math.round((viewed / materials) * 100) : 0;
    const assignmentCompletion = assignments ? Math.round((submissions / assignments) * 100) : 0;
    const quizCompletion = quizzes ? Math.round((attempts / quizzes) * 100) : 0;
    const completionPercent = Math.round((materialCompletion + assignmentCompletion + quizCompletion) / 3);
    return { courseId, studentId, lessons, materials, viewed, assignments, submissions, quizzes, attempts, completionPercent };
  }

  async allProgress(user: RequestUser, courseId: string) {
    await this.getCourse(user, courseId);
    const enrollments = await this.prisma.courseEnrollment.findMany({ where: { courseSpaceId: courseId } });
    return Promise.all(enrollments.map((item) => this.progressForStudent(courseId, item.studentId)));
  }

  async lessonProgress(user: RequestUser, lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Lesson not found');
    if (user.role === 'STUDENT') return this.prisma.lessonProgress.findUnique({ where: { lessonId_studentId: { lessonId, studentId: this.studentId(user) } } });
    return this.prisma.lessonProgress.findMany({ where: { lessonId } });
  }

  async listAnnouncements(user: RequestUser, courseId: string) {
    await this.getCourse(user, courseId);
    return this.prisma.courseAnnouncement.findMany({ where: { courseSpaceId: courseId }, orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }] });
  }

  async createAnnouncement(user: RequestUser, courseId: string, body: Record<string, unknown>) {
    await this.assertCourseOwnerFromCourseId(user, courseId);
    return this.prisma.courseAnnouncement.create({ data: { courseSpaceId: courseId, title: this.required(body.title, 'title'), body: this.required(body.body, 'body'), createdBy: user.id } });
  }

  async updateAnnouncement(user: RequestUser, courseId: string, id: string, body: Record<string, unknown>) {
    await this.assertCourseOwnerFromCourseId(user, courseId);
    return this.prisma.courseAnnouncement.update({ where: { id }, data: this.clean(body, ['title', 'body', 'status', 'isPinned']) });
  }

  async publishAnnouncement(user: RequestUser, courseId: string, id: string) {
    await this.assertCourseOwnerFromCourseId(user, courseId);
    const announcement = await this.prisma.courseAnnouncement.update({ where: { id }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
    const enrollments = await this.prisma.courseEnrollment.findMany({ where: { courseSpaceId: courseId, status: 'ACTIVE' }, select: { studentId: true } });
    await this.rabbitmq.publish('announcement.published', {
      announcementId: id,
      courseId,
      title: announcement.title,
      teacherId: user.id,
      studentIds: enrollments.map((e) => e.studentId),
    });
    return announcement;
  }

  async pinAnnouncement(user: RequestUser, courseId: string, id: string, body: Record<string, unknown>) {
    await this.assertCourseOwnerFromCourseId(user, courseId);
    return this.prisma.courseAnnouncement.update({ where: { id }, data: { isPinned: body.isPinned !== false } });
  }

  async deleteAnnouncement(user: RequestUser, courseId: string, id: string) {
    await this.assertCourseOwnerFromCourseId(user, courseId);
    await this.prisma.courseAnnouncement.delete({ where: { id } });
    return { deleted: true };
  }

  async listDiscussions(user: RequestUser, courseId: string) {
    await this.getCourse(user, courseId);
    return this.prisma.discussionThread.findMany({ where: { courseSpaceId: courseId, deletedAt: null }, include: { replies: true }, orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }] });
  }

  async createDiscussion(user: RequestUser, courseId: string, body: Record<string, unknown>) {
    await this.getCourse(user, courseId);
    return this.prisma.discussionThread.create({ data: { courseSpaceId: courseId, title: this.required(body.title, 'title'), body: this.required(body.body, 'body'), lessonId: this.optionalString(body.lessonId), assignmentId: this.optionalString(body.assignmentId), authorId: user.id, authorRole: user.role } });
  }

  async getDiscussion(user: RequestUser, threadId: string) {
    const thread = await this.prisma.discussionThread.findUnique({ where: { id: threadId }, include: { replies: true } });
    if (!thread) throw new NotFoundException('Discussion not found');
    await this.getCourse(user, thread.courseSpaceId);
    return thread;
  }

  async addReply(user: RequestUser, threadId: string, body: Record<string, unknown>) {
    await this.getDiscussion(user, threadId);
    return this.prisma.discussionReply.create({ data: { threadId, body: this.required(body.body, 'body'), authorId: user.id, authorRole: user.role } });
  }

  async updateDiscussionFlag(user: RequestUser, threadId: string, flag: 'isResolved' | 'isPinned', value = true) {
    const thread = await this.getDiscussion(user, threadId);
    await this.assertCourseOwnerFromCourseId(user, thread.courseSpaceId);
    return this.prisma.discussionThread.update({ where: { id: threadId }, data: { [flag]: value } });
  }

  async deleteDiscussion(user: RequestUser, threadId: string) {
    const thread = await this.getDiscussion(user, threadId);
    if (thread.authorId !== user.id) await this.assertCourseOwnerFromCourseId(user, thread.courseSpaceId);
    return this.prisma.discussionThread.update({ where: { id: threadId }, data: { deletedAt: new Date() } });
  }

  async teacherAnalytics(user: RequestUser) {
    this.assertRole(user, ['TEACHER', 'SYSTEM_ADMIN']);
    const courses = await this.prisma.courseSpace.findMany({ where: { teacherId: user.role === 'TEACHER' ? user.id : undefined }, include: this.courseIncludes() });
    const pending = await this.prisma.submission.count({ where: { courseSpace: { teacherId: user.role === 'TEACHER' ? user.id : undefined }, status: 'SUBMITTED' } });
    return { courses, activeCourses: courses.filter((c) => c.status === 'ACTIVE').length, submissionsPending: pending };
  }

  async engagement(user: RequestUser, courseId: string) {
    await this.getCourse(user, courseId);
    const progress = await this.allProgress(user, courseId);
    const [materials, materialViews, assignments, submissions, lateSubmissions, quizzes, attempts, lessons, discussions] = await Promise.all([
      this.prisma.material.count({ where: { courseSpaceId: courseId, status: { not: 'ARCHIVED' } } }),
      this.prisma.materialProgress.count({ where: { courseSpaceId: courseId, viewedAt: { not: null } } }),
      this.prisma.assignment.count({ where: { courseSpaceId: courseId, status: { in: ['PUBLISHED', 'CLOSED'] } } }),
      this.prisma.submission.count({ where: { courseSpaceId: courseId, status: { in: ['SUBMITTED', 'GRADED'] } } }),
      this.prisma.submission.count({ where: { courseSpaceId: courseId, isLate: true } }),
      this.prisma.quiz.count({ where: { courseSpaceId: courseId, status: { in: ['PUBLISHED', 'CLOSED'] } } }),
      this.prisma.quizAttempt.findMany({ where: { courseSpaceId: courseId, status: { in: ['SUBMITTED', 'AUTO_GRADED', 'MANUALLY_GRADED'] } } }),
      this.prisma.lesson.findMany({ where: { courseSpaceId: courseId }, include: { materials: true, assignments: true, quizzes: true }, orderBy: { orderIndex: 'asc' } }),
      this.prisma.discussionThread.count({ where: { courseSpaceId: courseId, deletedAt: null, isResolved: false } }),
    ]);
    const scores = attempts.map((item) => Number(item.percentScore || 0));
    const averageQuizScore = scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0;
    const studentRiskFlags = progress
      .filter((item) => item.completionPercent < 60)
      .map((item) => ({
        studentId: item.studentId,
        completionPercent: item.completionPercent,
        reason: item.completionPercent < 40 ? 'Critical low completion' : 'Needs follow-up',
      }));
    return {
      courseId,
      progress,
      heatmap: progress.map((item, index) => ({ day: index + 1, value: item.completionPercent })),
      materialStats: { total: materials, viewed: materialViews, unviewed: Math.max(materials - materialViews, 0) },
      assignmentStats: { total: assignments, submitted: submissions, late: lateSubmissions },
      quizStats: { total: quizzes, attempts: attempts.length, averageScore: averageQuizScore },
      studentRiskFlags,
      lessonCompletion: lessons.map((lesson) => ({
        lessonId: lesson.id,
        title: lesson.title,
        status: lesson.status,
        materials: lesson.materials.length,
        assignments: lesson.assignments.length,
        quizzes: lesson.quizzes.length,
      })),
      activityTimeline: [
        { label: 'Materials viewed', value: materialViews },
        { label: 'Assignments submitted', value: submissions },
        { label: 'Quiz attempts', value: attempts.length },
        { label: 'Open discussions', value: discussions },
      ],
    };
  }

  async struggling(user: RequestUser, courseId: string) {
    const progress = await this.allProgress(user, courseId);
    return progress.filter((item) => item.completionPercent < 50);
  }

  async roleOverview(role: 'hod' | 'principal' | 'aqa') {
    const [courses, active, materials, assignments, quizzes, attempts] = await Promise.all([
      this.prisma.courseSpace.count(),
      this.prisma.courseSpace.count({ where: { status: 'ACTIVE' } }),
      this.prisma.material.count(),
      this.prisma.assignment.count(),
      this.prisma.quiz.count(),
      this.prisma.quizAttempt.count(),
    ]);
    return { role, courses, active, materials, assignments, quizzes, attempts };
  }

  async studentSummary(user: RequestUser) {
    const studentId = this.studentId(user);
    const courses = await this.prisma.courseEnrollment.findMany({ where: { studentId, status: 'ACTIVE' }, include: { courseSpace: true } });
    const courseIds = courses.map((c) => c.courseSpaceId);
    const [pendingAssignments, availableQuizzes, unviewedMaterials] = await Promise.all([
      this.prisma.assignment.count({ where: { courseSpaceId: { in: courseIds }, status: 'PUBLISHED', submissions: { none: { studentId, status: { in: ['SUBMITTED', 'GRADED'] } } } } }),
      this.prisma.quiz.count({ where: { courseSpaceId: { in: courseIds }, status: 'PUBLISHED', attempts: { none: { studentId } } } }),
      this.prisma.material.count({ where: { courseSpaceId: { in: courseIds }, status: 'PUBLISHED', progress: { none: { studentId, viewedAt: { not: null } } } } }),
    ]);
    return { courses, pendingAssignments, availableQuizzes, unviewedMaterials };
  }

  async parentSummary(childId: string) {
    const enrollments = await this.prisma.courseEnrollment.findMany({ where: { studentId: childId, status: 'ACTIVE' }, include: { courseSpace: true } });
    const courseIds = enrollments.map((e) => e.courseSpaceId);
    const progresses = await Promise.all(courseIds.map((courseId) => this.progressForStudent(courseId, childId)));
    const overallCompletion = progresses.length ? Math.round(progresses.reduce((sum, p) => sum + p.completionPercent, 0) / progresses.length) : 0;
    const [pendingAssignments, availableQuizzes, unviewedMaterials] = await Promise.all([
      this.prisma.assignment.count({ where: { courseSpaceId: { in: courseIds }, status: 'PUBLISHED', submissions: { none: { studentId: childId, status: { in: ['SUBMITTED', 'GRADED'] } } } } }),
      this.prisma.quiz.count({ where: { courseSpaceId: { in: courseIds }, status: 'PUBLISHED', attempts: { none: { studentId: childId } } } }),
      this.prisma.material.count({ where: { courseSpaceId: { in: courseIds }, status: 'PUBLISHED', progress: { none: { studentId: childId, viewedAt: { not: null } } } } }),
    ]);
    return { childId, enrollments, progresses, overallCompletion, pendingAssignments, availableQuizzes, unviewedMaterials };
  }

  async internalStudentCourses(studentId: string) {
    return this.prisma.courseEnrollment.findMany({ where: { studentId, status: 'ACTIVE' }, include: { courseSpace: true } });
  }

  async internalHasStudent(courseId: string, studentId: string) {
    const found = await this.prisma.courseEnrollment.findUnique({ where: { courseSpaceId_studentId: { courseSpaceId: courseId, studentId } } });
    return { courseId, studentId, enrolled: Boolean(found) };
  }

  async internalEnrollmentSync(body: Record<string, unknown>) {
    const courseId = this.required(body.courseId, 'courseId');
    const studentIds = (Array.isArray(body.studentIds) ? body.studentIds : []).map(String);
    await this.prisma.$transaction(studentIds.map((studentId) => this.prisma.courseEnrollment.upsert({
      where: { courseSpaceId_studentId: { courseSpaceId: courseId, studentId } },
      update: { status: 'ACTIVE' },
      create: { courseSpaceId: courseId, studentId },
    })));
    return { courseId, synced: studentIds.length };
  }

  async createLocalUpload(user: RequestUser, body: Record<string, unknown>) {
    this.assertRole(user, ['TEACHER', 'STUDENT', 'SYSTEM_ADMIN']);
    const fileName = this.required(body.fileName, 'fileName').replace(/[^\w.\- ]+/g, '_');
    const mimeType = this.optionalString(body.mimeType) || 'application/octet-stream';
    const base64 = this.required(body.contentBase64, 'contentBase64');
    const domain = this.optionalString(body.domain) || 'materials';
    const storageRoot = normalize(this.config.get<string>('ELEARNING_STORAGE_DIR', './storage/elearning'));
    const relativeKey = `${domain}/${Date.now()}-${fileName}`;
    const absolutePath = join(storageRoot, relativeKey);
    await mkdir(join(storageRoot, domain), { recursive: true });
    await writeFile(absolutePath, Buffer.from(base64, 'base64'));
    await this.audit(user, 'LOCAL_FILE_UPLOADED', 'Upload', relativeKey, { fileName, mimeType, domain });
    return {
      fileKey: relativeKey.replace(/\\/g, '/'),
      fileOriginalName: fileName,
      fileMimeType: mimeType,
      fileSizeBytes: Buffer.byteLength(Buffer.from(base64, 'base64')),
      storage: 'local',
    };
  }

  async auditLogs(user: RequestUser, query: Record<string, string>) {
    this.assertRole(user, ['SYSTEM_ADMIN', 'ACADEMIC_QA', 'PRINCIPAL']);
    return this.prisma.elearningAuditLog.findMany({
      where: {
        action: query.action,
        entityType: query.entityType,
        actorId: query.actorId,
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(query.limit || 100), 250),
    });
  }

  storagePolicy(user: RequestUser) {
    this.assertRole(user, ['SYSTEM_ADMIN']);
    return {
      driver: 'local',
      root: this.config.get<string>('ELEARNING_STORAGE_DIR', './storage/elearning'),
      maxRecommendedUploadMb: 50,
      futureDrivers: ['minio', 'aws-s3', 'cloudflare-r2'],
      supportedMaterialTypes: Object.values(MaterialType),
    };
  }

  private courseIncludes() {
    return {
      lessons: { orderBy: { orderIndex: 'asc' as const } },
      assignments: true,
      quizzes: true,
      enrollments: true,
      announcements: true,
    };
  }

  private async assertCourseAccess(user: RequestUser, courseId: string, teacherId?: string): Promise<void> {
    if (LEADERSHIP.includes(user.role) || user.role === 'SYSTEM_ADMIN') return;
    if (user.role === 'TEACHER' && teacherId === user.id) return;
    if (user.role === 'STUDENT') {
      await this.assertStudentEnrollment(courseId, this.studentId(user));
      return;
    }
    if (user.role === 'PARENT') return;
    throw new ForbiddenException('Forbidden');
  }

  private async assertCourseOwnerFromCourseId(user: RequestUser, courseId: string): Promise<void> {
    const course = await this.prisma.courseSpace.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found');
    this.assertTeacherOwner(user, course.teacherId);
  }

  private assertTeacherOwner(user: RequestUser, teacherId: string): void {
    if (user.role === 'SYSTEM_ADMIN') return;
    if (user.role !== 'TEACHER' || user.id !== teacherId) throw new ForbiddenException('Teacher does not own this course');
  }

  private async assertStudentEnrollment(courseId: string, studentId: string): Promise<void> {
    const found = await this.prisma.courseEnrollment.findUnique({ where: { courseSpaceId_studentId: { courseSpaceId: courseId, studentId } } });
    if (!found) throw new ForbiddenException('Student is not enrolled in this course');
  }

  private assertRole(user: RequestUser, roles: string[]): void {
    if (!roles.includes(user.role)) throw new ForbiddenException('Insufficient permissions');
  }

  private studentId(user: RequestUser): string {
    return user.id;
  }

  private async touchEnrollment(courseId: string, studentId: string): Promise<void> {
    await this.prisma.courseEnrollment.updateMany({ where: { courseSpaceId: courseId, studentId }, data: { lastActivityAt: new Date() } });
  }

  private async recalculateQuizPoints(quizId: string): Promise<void> {
    const questions = await this.prisma.quizQuestion.findMany({ where: { quizId } });
    const total = questions.reduce((sum, question) => sum + Number(question.points), 0);
    await this.prisma.quiz.update({ where: { id: quizId }, data: { totalPoints: total } });
  }

  private async audit(user: RequestUser, action: string, entityType: string, entityId?: string, metadata?: unknown): Promise<void> {
    await this.prisma.elearningAuditLog.create({
      data: { action, entityType, entityId, actorId: user.id, actorRole: user.role, metadata: metadata as Prisma.InputJsonValue },
    });
  }

  private required(value: unknown, key: string): string {
    if (value === undefined || value === null || String(value).trim() === '') throw new BadRequestException(`${key} is required`);
    return String(value);
  }

  private optionalString(value: unknown): string | undefined {
    return value === undefined || value === null ? undefined : String(value);
  }

  private optionalNumber(value: unknown): number | undefined {
    return value === undefined || value === null || value === '' ? undefined : Number(value);
  }

  private decimal(value: unknown): number | undefined {
    return value === undefined || value === null || value === '' ? undefined : Number(value);
  }

  private enumValue<T extends Record<string, string>>(source: T, value: unknown, fallback: T[keyof T]): T[keyof T] {
    const normalized = String(value || fallback).toUpperCase();
    return Object.values(source).includes(normalized) ? normalized as T[keyof T] : fallback;
  }

  private clean(body: Record<string, unknown>, keys: string[]): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    for (const key of keys) {
      if (body[key] !== undefined) data[key] = ['dueAt'].includes(key) ? new Date(String(body[key])) : body[key];
    }
    return data;
  }

  private fileKeyToUrl(fileKey: string): string {
    const parts = fileKey.replace(/\\/g, '/').split('/');
    const domain = parts[0];
    const filename = parts.slice(1).join('/');
    return `/elearning/files/${domain}/${encodeURIComponent(filename)}`;
  }
}
