import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, normalize } from 'node:path';
import {
  AssignmentType,
  AttemptStatus,
  EnrollmentStatus,
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
const TEACHING_ROLES = ['TEACHER', 'HEAD_OF_DEPARTMENT'];

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
    if (query.educationStage) where.educationStage = query.educationStage.toUpperCase() as never;
    if (query.classLevel) where.classLevel = Number(query.classLevel);
    if (query.combinationId) where.combinationId = query.combinationId;
    if (query.termId) where.termId = query.termId;
    if (query.academicYearId) where.academicYearId = query.academicYearId;
    if (user.role === 'TEACHER') where.teacherId = user.id;
    if (user.role === 'STUDENT') where.enrollments = { some: { studentId: await this.resolveStudentId(user), status: 'ACTIVE' } };
    return this.prisma.courseSpace.findMany({
      where,
      include: this.courseIncludes(),
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createCourse(user: RequestUser, body: Record<string, unknown>) {
    this.assertRole(user, [...TEACHING_ROLES, 'SYSTEM_ADMIN']);
    if (body.classSubjectId && (!body.subjectName || !body.className)) {
      return this.createCourseFromClassSubject(user, String(body.classSubjectId), body);
    }
    if (body.classSubjectId && user.role !== 'SYSTEM_ADMIN') {
      const classSubject = await this.getClassSubject(user, String(body.classSubjectId));
      this.assertClassSubjectTeacher(user, classSubject);
    }
    const existing = await this.prisma.courseSpace.findUnique({
      where: {
        classSubjectId_termId: {
          classSubjectId: this.required(body.classSubjectId, 'classSubjectId'),
          termId: this.required(body.termId, 'termId'),
        },
      },
      include: this.courseIncludes(),
    });
    if (existing) return existing;
    const course = await this.prisma.courseSpace.create({
      data: {
        classSubjectId: this.required(body.classSubjectId, 'classSubjectId'),
        teacherId: String(body.teacherId || user.id),
        termId: this.required(body.termId, 'termId'),
        academicYearId: this.required(body.academicYearId, 'academicYearId'),
        subjectName: this.required(body.subjectName, 'subjectName'),
        className: this.required(body.className, 'className'),
        educationStage: String(body.educationStage || 'O_LEVEL') as never,
        classLevel: body.classLevel === undefined ? undefined : Number(body.classLevel),
        combinationId: this.optionalString(body.combinationId),
        description: this.optionalString(body.description),
        coverColor: this.optionalString(body.coverColor),
        coverEmoji: this.optionalString(body.coverEmoji) || 'BOOK',
      },
      include: this.courseIncludes(),
    });
    await this.audit(user, 'COURSE_CREATED', 'CourseSpace', course.id, course);
    return course;
  }

  async createCourseFromClassSubject(user: RequestUser, classSubjectId: string, body: Record<string, unknown> = {}) {
    this.assertRole(user, [...TEACHING_ROLES, 'SYSTEM_ADMIN']);
    const classSubject = await this.getClassSubject(user, classSubjectId);
    this.assertClassSubjectTeacher(user, classSubject);
    const termId = this.optionalString(body.termId) || await this.currentTermId(user);
    const academicYearId = this.optionalString(body.academicYearId)
      || this.stringFrom(classSubject.academicYearId)
      || await this.currentAcademicYearId(user);
    if (!termId) throw new BadRequestException('termId is required because no current term was found');
    if (!academicYearId) throw new BadRequestException('academicYearId is required because no current academic year was found');

    // Resolve human-readable names for term and academic year
    const [termData, yearData] = await Promise.allSettled([
      this.studentGet(user, `/students/terms/${termId}`).catch(() => null),
      this.studentGet(user, `/students/academic-years/${academicYearId}`).catch(() => null),
    ]);
    const termName = this.optionalString(body.termName)
      || (termData.status === 'fulfilled' ? this.stringFrom((this.unwrapPayload(termData.value) as any)?.name) : null)
      || undefined;
    const academicYearName = this.optionalString(body.academicYearName)
      || (yearData.status === 'fulfilled' ? this.stringFrom((this.unwrapPayload(yearData.value) as any)?.name ?? (this.unwrapPayload(yearData.value) as any)?.year) : null)
      || undefined;

    const existing = await this.prisma.courseSpace.findUnique({
      where: { classSubjectId_termId: { classSubjectId, termId } },
      include: this.courseIncludes(),
    });
    if (existing) return existing;

    const subjectName = this.nameFrom(classSubject.subject) || this.stringFrom(classSubject.subjectName) || 'Subject';
    const className = this.nameFrom(classSubject.class)
      || this.stringFrom(classSubject.className)
      || this.classLabel(classSubject.educationStage, classSubject.classLevel, classSubject.classId);
    const course = await this.prisma.courseSpace.create({
      data: {
        classSubjectId,
        teacherId: this.stringFrom(classSubject.teacherId) || user.id,
        termId,
        termName,
        academicYearId,
        academicYearName,
        subjectName,
        className,
        educationStage: this.educationStage(classSubject.educationStage),
        classLevel: this.numberFrom(classSubject.classLevel),
        combinationId: this.optionalString(classSubject.combinationId),
        description: this.optionalString(body.description),
        coverColor: this.optionalString(body.coverColor),
        coverEmoji: this.optionalString(body.coverEmoji) || 'BOOK',
      },
      include: this.courseIncludes(),
    });
    await this.audit(user, 'COURSE_GENERATED_FROM_CLASS_SUBJECT', 'CourseSpace', course.id, { classSubjectId, termId, academicYearId });
    await this.syncEnrollments(user, course.id, {});
    return this.getCourse(user, course.id);
  }

  async teacherTeachingLoad(user: RequestUser, query: Record<string, string> = {}) {
    this.assertRole(user, [...TEACHING_ROLES, 'SYSTEM_ADMIN']);
    const teacherId = query.teacherId && user.role === 'SYSTEM_ADMIN' ? query.teacherId : user.id;
    const [classSubjects, courses, timetable, review] = await Promise.all([
      this.listTeacherClassSubjects(user, teacherId, query),
      this.prisma.courseSpace.findMany({
        where: { teacherId, academicYearId: query.academicYearId, termId: query.termId },
        include: this.courseIncludes(),
        orderBy: { updatedAt: 'desc' },
      }),
      this.listTeacherTimetable(user, teacherId, query),
      this.teacherReviewDesk(user, query),
    ]);
    const courseByClassSubject = new Map(courses.map((course) => [course.classSubjectId, course]));
    const load = await Promise.all(classSubjects.map(async (item) => {
      const id = this.stringFrom(item.id);
      const course = courseByClassSubject.get(id);
      const pendingGrading = course
        ? await this.prisma.submission.count({ where: { courseSpaceId: course.id, status: 'SUBMITTED' } })
        : 0;
      const lessons = course
        ? await this.prisma.lesson.count({ where: { courseSpaceId: course.id, status: { not: 'ARCHIVED' } } })
        : 0;
      const publishedLessons = course
        ? await this.prisma.lesson.count({ where: { courseSpaceId: course.id, status: 'PUBLISHED' } })
        : 0;
      return {
        classSubjectId: id,
        classId: this.stringFrom(item.classId),
        subjectId: this.stringFrom(item.subjectId),
        subjectName: this.nameFrom(item.subject) || this.stringFrom(item.subjectName) || 'Subject',
        className: this.nameFrom(item.class) || this.stringFrom(item.className) || this.classLabel(item.educationStage, item.classLevel, item.classId),
        educationStage: this.stringFrom(item.educationStage) || 'O_LEVEL',
        classLevel: this.numberFrom(item.classLevel),
        combinationId: this.optionalString(item.combinationId),
        teacherId: this.stringFrom(item.teacherId),
        course,
        courseStatus: course?.status || 'SETUP_NEEDED',
        pendingGrading,
        lessons,
        publishedLessons,
        missingContentWarnings: course && publishedLessons > 0 ? [] : ['No published lesson material yet'],
      };
    }));
    return {
      teacherId,
      classSubjects: load,
      courses,
      today: this.todaySlots(timetable),
      week: timetable,
      reviewSummary: review.summary,
    };
  }

  async teacherToday(user: RequestUser, query: Record<string, string> = {}) {
    const load = await this.teacherTeachingLoad(user, query);
    const now = new Date();
    const today = load.today;
    const sorted = [...today].sort((a, b) => String(a.startTime || a.time || '').localeCompare(String(b.startTime || b.time || '')));
    const current = sorted.find((slot) => this.isSlotCurrent(slot, now)) || null;
    const next = sorted.find((slot) => this.slotStartsAfter(slot, now)) || null;
    return {
      date: now.toISOString().slice(0, 10),
      current,
      next,
      schedule: sorted,
      teachingLoad: load.classSubjects,
      reviewSummary: load.reviewSummary,
      warnings: load.classSubjects.flatMap((item) => item.missingContentWarnings.map((message) => ({
        classSubjectId: item.classSubjectId,
        courseId: item.course?.id,
        subjectName: item.subjectName,
        className: item.className,
        message,
      }))),
    };
  }

  async teacherReviewDesk(user: RequestUser, query: Record<string, string> = {}) {
    this.assertRole(user, [...TEACHING_ROLES, 'SYSTEM_ADMIN']);
    const teacherId = query.teacherId && user.role === 'SYSTEM_ADMIN' ? query.teacherId : user.id;
    const courseWhere: Prisma.CourseSpaceWhereInput = { teacherId };
    if (query.courseId) courseWhere.id = query.courseId;
    if (query.termId) courseWhere.termId = query.termId;
    if (query.academicYearId) courseWhere.academicYearId = query.academicYearId;
    const courseIds = (await this.prisma.courseSpace.findMany({ where: courseWhere, select: { id: true } })).map((course) => course.id);
    const [submissions, quizAttempts, lateSubmissions] = await Promise.all([
      this.prisma.submission.findMany({
        where: { courseSpace: courseWhere, status: 'SUBMITTED' },
        include: { assignment: true, courseSpace: true },
        orderBy: { submittedAt: 'asc' },
        take: 100,
      }),
      this.prisma.quizAttempt.findMany({
        where: {
          courseSpaceId: { in: courseIds },
          status: { in: ['SUBMITTED', 'AUTO_GRADED'] },
          answers: { some: { question: { type: 'SHORT_ANSWER' }, scoreAwarded: null } },
        },
        include: { quiz: true, answers: { include: { question: true } } },
        orderBy: { submittedAt: 'asc' },
        take: 100,
      }),
      this.prisma.submission.findMany({
        where: { courseSpace: courseWhere, isLate: true, status: { in: ['SUBMITTED', 'RETURNED'] } },
        include: { assignment: true, courseSpace: true },
        orderBy: { submittedAt: 'desc' },
        take: 50,
      }),
    ]);
    return {
      summary: {
        submittedAssignments: submissions.length,
        shortAnswersPending: quizAttempts.reduce((sum, attempt) => sum + attempt.answers.filter((answer) => answer.question.type === 'SHORT_ANSWER' && answer.scoreAwarded == null).length, 0),
        lateSubmissions: lateSubmissions.length,
      },
      assignments: submissions,
      shortAnswerAttempts: quizAttempts,
      lateSubmissions,
    };
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
        educationStage: body.educationStage === undefined ? undefined : String(body.educationStage) as never,
        classLevel: body.classLevel === undefined ? undefined : Number(body.classLevel),
        combinationId: this.optionalString(body.combinationId),
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

  async copyCourse(user: RequestUser, sourceId: string, body: Record<string, unknown>) {
    const source = await this.getCourse(user, sourceId);
    this.assertTeacherOwner(user, source.teacherId);
    const targetTermId = this.required(body.targetTermId, 'targetTermId');
    const targetAcademicYearId = this.required(body.targetAcademicYearId, 'targetAcademicYearId');

    const existing = await this.prisma.courseSpace.findFirst({ where: { classSubjectId: source.classSubjectId, termId: targetTermId } });
    if (existing) throw new BadRequestException('A course for this subject already exists in the target term');

    const lessons = await this.prisma.lesson.findMany({
      where: { courseSpaceId: sourceId, status: { not: 'ARCHIVED' } },
      include: {
        materials: { where: { status: { not: 'ARCHIVED' } } },
        assignments: { where: { status: { not: 'ARCHIVED' } } },
        quizzes: { where: { status: { not: 'ARCHIVED' } }, include: { questions: { include: { options: true }, orderBy: { orderIndex: 'asc' } } } },
      },
      orderBy: { orderIndex: 'asc' },
    });

    const newCourse = await this.prisma.courseSpace.create({
      data: {
        classSubjectId: source.classSubjectId,
        teacherId: source.teacherId,
        termId: targetTermId,
        academicYearId: targetAcademicYearId,
        subjectName: source.subjectName,
        className: source.className,
        educationStage: source.educationStage,
        classLevel: source.classLevel,
        combinationId: source.combinationId,
        description: source.description,
        coverColor: source.coverColor,
        coverEmoji: source.coverEmoji,
      },
      include: this.courseIncludes(),
    });

    for (const lesson of lessons) {
      const newLesson = await this.prisma.lesson.create({
        data: {
          courseSpaceId: newCourse.id,
          title: lesson.title,
          description: lesson.description,
          weekNumber: lesson.weekNumber,
          orderIndex: lesson.orderIndex,
          estimatedMinutes: lesson.estimatedMinutes,
        },
      });

      for (const m of lesson.materials) {
        await this.prisma.material.create({
          data: {
            courseSpaceId: newCourse.id,
            lessonId: newLesson.id,
            title: m.title,
            type: m.type,
            orderIndex: m.orderIndex,
            body: m.body,
            fileKey: m.fileKey,
            fileOriginalName: m.fileOriginalName,
            fileMimeType: m.fileMimeType,
            externalUrl: m.externalUrl,
            downloadable: m.downloadable,
          },
        });
      }

      for (const a of lesson.assignments) {
        await this.prisma.assignment.create({
          data: {
            courseSpaceId: newCourse.id,
            lessonId: newLesson.id,
            title: a.title,
            instructions: a.instructions,
            type: a.type,
            maxScore: a.maxScore,
            allowLateSubmission: a.allowLateSubmission,
            latePenaltyPercent: a.latePenaltyPercent,
          },
        });
      }

      for (const q of lesson.quizzes) {
        const newQuiz = await this.prisma.quiz.create({
          data: {
            courseSpaceId: newCourse.id,
            lessonId: newLesson.id,
            title: q.title,
            instructions: q.instructions,
            timeLimitMinutes: q.timeLimitMinutes,
            maxAttempts: q.maxAttempts,
            shuffleQuestions: q.shuffleQuestions,
            shuffleOptions: q.shuffleOptions,
            showCorrectAfter: q.showCorrectAfter,
            passingScore: q.passingScore,
          },
        });
        for (const question of q.questions) {
          const newQuestion = await this.prisma.quizQuestion.create({
            data: {
              quizId: newQuiz.id,
              type: question.type,
              prompt: question.prompt,
              points: question.points,
              orderIndex: question.orderIndex,
              explanation: question.explanation,
              correctAnswer: question.correctAnswer,
            },
          });
          for (const opt of question.options) {
            await this.prisma.quizOption.create({
              data: { questionId: newQuestion.id, text: opt.text, isCorrect: opt.isCorrect, orderIndex: opt.orderIndex },
            });
          }
        }
      }
    }

    await this.audit(user, 'COURSE_COPIED', 'CourseSpace', newCourse.id, { sourceId, targetTermId, targetAcademicYearId });
    return newCourse;
  }

  async courseOverview(user: RequestUser, courseId: string) {
    const course = await this.getCourse(user, courseId);
    const [pendingSubmissions, attempts, materialViews, enrollments] = await Promise.all([
      this.prisma.submission.count({ where: { courseSpaceId: courseId, status: 'SUBMITTED' } }),
      this.prisma.quizAttempt.count({ where: { courseSpaceId: courseId } }),
      this.prisma.materialProgress.count({ where: { courseSpaceId: courseId, viewedAt: { not: null } } }),
      this.prisma.courseEnrollment.count({ where: { courseSpaceId: courseId, status: EnrollmentStatus.ACTIVE } }),
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
    if (!studentIds.length) {
      studentIds.push(...await this.resolveCourseStudentIds(user, course));
    }
    if (!studentIds.length) {
      await this.prisma.courseEnrollment.updateMany({
        where: { courseSpaceId: courseId },
        data: { status: EnrollmentStatus.INACTIVE },
      });
      await this.prisma.courseSpace.update({ where: { id: courseId }, data: { enrolledCount: 0 } });
      await this.audit(user, 'COURSE_ENROLLMENTS_SYNCED_EMPTY', 'CourseSpace', courseId, { studentIds: [] });
      return { courseId, enrolledCount: 0, studentIds: [], warning: 'No active students were found for this class-subject yet' };
    }
    const uniqueStudentIds = [...new Set(studentIds)];
    await this.prisma.$transaction(uniqueStudentIds.map((studentId) => this.prisma.courseEnrollment.upsert({
      where: { courseSpaceId_studentId: { courseSpaceId: courseId, studentId } },
      update: { status: EnrollmentStatus.ACTIVE },
      create: { courseSpaceId: courseId, studentId },
    })));
    await this.prisma.courseEnrollment.updateMany({
      where: { courseSpaceId: courseId, studentId: { notIn: uniqueStudentIds } },
      data: { status: EnrollmentStatus.INACTIVE },
    });
    const enrolledCount = await this.prisma.courseEnrollment.count({ where: { courseSpaceId: courseId, status: EnrollmentStatus.ACTIVE } });
    await this.prisma.courseSpace.update({ where: { id: courseId }, data: { enrolledCount } });
    await this.audit(user, 'COURSE_ENROLLMENTS_SYNCED', 'CourseSpace', courseId, { studentIds: uniqueStudentIds });
    return { courseId, enrolledCount, studentIds: uniqueStudentIds };
  }

  async listLessons(user: RequestUser, courseId: string) {
    await this.getCourse(user, courseId);
    const lessons = await this.prisma.lesson.findMany({ where: { courseSpaceId: courseId }, include: { materials: true }, orderBy: { orderIndex: 'asc' } });
    return this.toResponseValue(lessons);
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
    const materials = await this.prisma.material.findMany({ where: { courseSpaceId: courseId, lessonId }, orderBy: { orderIndex: 'asc' } });
    return this.toResponseValue(materials);
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
    return this.toResponseValue(material);
  }

  async updateMaterial(user: RequestUser, courseId: string, _lessonId: string, id: string, body: Record<string, unknown>) {
    await this.assertCourseOwnerFromCourseId(user, courseId);
    return this.prisma.material.update({ where: { id }, data: this.clean(body, ['title', 'body', 'externalUrl', 'status', 'orderIndex', 'fileKey', 'downloadable', 'fileOriginalName', 'fileMimeType', 'fileSizeBytes']) });
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
    const studentId = await this.resolveStudentId(user);
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
      const studentId = await this.resolveStudentId(user);
      await this.assertStudentEnrollment(material.courseSpaceId, studentId);
      await this.prisma.materialProgress.upsert({
        where: { materialId_studentId: { materialId: id, studentId } },
        update: { isDownloaded: true },
        create: { materialId: id, courseSpaceId: material.courseSpaceId, studentId, isDownloaded: true },
      });
    }
    const fileUrl = material.externalUrl ?? (material.fileKey ? this.fileKeyToUrl(material.fileKey) : null);
    return this.toResponseValue({ material, download: { url: fileUrl, expiresAt: new Date(Date.now() + 600_000).toISOString() } });
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
    // Accept submissionMode as UI alias for type
    const typeRaw = body.type ?? body.submissionMode;
    const assignment = await this.prisma.assignment.create({
      data: {
        courseSpaceId: courseId,
        lessonId: this.optionalString(body.lessonId),
        title: this.required(body.title, 'title'),
        instructions: this.optionalString(body.instructions) ?? '',
        type: this.enumValue(AssignmentType, typeRaw, 'BOTH'),
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
    // Accept submissionMode as alias for type
    if (body.submissionMode && !body.type) body.type = body.submissionMode;
    return this.prisma.assignment.update({ where: { id }, data: this.clean(body, ['title', 'instructions', 'type', 'dueAt', 'allowLateSubmission', 'status', 'maxScore', 'latePenaltyPercent']) });
  }

  async publishAssignment(user: RequestUser, courseId: string, id: string) {
    await this.assertCourseOwnerFromCourseId(user, courseId);
    const assignment = await this.prisma.assignment.update({ where: { id }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
    await this.audit(user, 'ASSIGNMENT_PUBLISHED', 'Assignment', id, assignment);
    const enrollments = await this.prisma.courseEnrollment.findMany({ where: { courseSpaceId: courseId, status: EnrollmentStatus.ACTIVE }, select: { studentId: true } });
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
      this.prisma.courseEnrollment.count({ where: { courseSpaceId: courseId, status: EnrollmentStatus.ACTIVE } }),
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
    return this.prisma.submission.findUnique({ where: { assignmentId_studentId: { assignmentId, studentId: await this.resolveStudentId(user) } } });
  }

  async upsertSubmission(user: RequestUser, assignmentId: string, body: Record<string, unknown>) {
    this.assertRole(user, ['STUDENT', 'SYSTEM_ADMIN']);
    const assignment = await this.prisma.assignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException('Assignment not found');
    const studentId = await this.resolveStudentId(user);
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
    if (user.role === 'STUDENT' && submission.studentId !== await this.resolveStudentId(user)) throw new ForbiddenException('Forbidden');
    if (user.role === 'TEACHER') this.assertTeacherOwner(user, submission.assignment.courseSpace.teacherId);
    return submission;
  }

  async gradeSubmission(user: RequestUser, id: string, body: Record<string, unknown>) {
    const submission = await this.getSubmission(user, id);
    if (user.role === 'TEACHER') this.assertTeacherOwner(user, submission.assignment.courseSpace.teacherId);
    let rawScore = this.decimal(body.score);
    const penaltyPct = Number(submission.assignment.latePenaltyPercent ?? 0);
    if (rawScore != null && submission.isLate && penaltyPct > 0) {
      const deduction = (Number(rawScore) * penaltyPct) / 100;
      rawScore = this.decimal(Math.max(0, Number(rawScore) - deduction).toFixed(2));
    }
    const graded = await this.prisma.submission.update({
      where: { id },
      data: {
        status: 'GRADED',
        score: rawScore,
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
    return this.prisma.submission.findMany({ where: { courseSpaceId: courseId, studentId: await this.resolveStudentId(user) }, include: { assignment: true } });
  }

  async listQuizzes(user: RequestUser, courseId: string) {
    await this.getCourse(user, courseId);
    const studentId = user.role === 'STUDENT' ? await this.resolveStudentId(user) : undefined;
    return this.prisma.quiz.findMany({ where: { courseSpaceId: courseId }, include: { questions: { include: { options: true } }, attempts: studentId ? { where: { studentId } } : true } });
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
    const enrollments = await this.prisma.courseEnrollment.findMany({ where: { courseSpaceId: courseId, status: EnrollmentStatus.ACTIVE }, select: { studentId: true } });
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
    const studentId = await this.resolveStudentId(user);
    await this.assertStudentEnrollment(quiz.courseSpaceId, studentId);
    const count = await this.prisma.quizAttempt.count({ where: { quizId, studentId } });
    if (count >= quiz.maxAttempts) throw new BadRequestException('Maximum attempts reached');
    return this.prisma.quizAttempt.create({ data: { quizId, studentId, courseSpaceId: quiz.courseSpaceId, attemptNumber: count + 1 } });
  }

  async activeAttempt(user: RequestUser, quizId: string) {
    const attempt = await this.prisma.quizAttempt.findFirst({ where: { quizId, studentId: await this.resolveStudentId(user), status: 'IN_PROGRESS' }, include: { answers: true } });
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
    const now = new Date();
    const timeTakenSeconds = Math.round((now.getTime() - attempt.startedAt.getTime()) / 1000);
    const result = await this.prisma.quizAttempt.update({
      where: { id: attemptId },
      data: {
        status: 'AUTO_GRADED',
        submittedAt: now,
        timeTakenSeconds,
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
    if (user.role === 'STUDENT' && attempt.studentId !== await this.resolveStudentId(user)) throw new ForbiddenException('Forbidden');
    return attempt;
  }

  async myAttempts(user: RequestUser, quizId: string) {
    return this.prisma.quizAttempt.findMany({ where: { quizId, studentId: await this.resolveStudentId(user) }, include: { answers: true } });
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
    return this.progressForStudent(courseId, await this.resolveStudentId(user));
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
    if (user.role === 'STUDENT') return this.prisma.lessonProgress.findUnique({ where: { lessonId_studentId: { lessonId, studentId: await this.resolveStudentId(user) } } });
    return this.prisma.lessonProgress.findMany({ where: { lessonId } });
  }

  async listAnnouncements(user: RequestUser, courseId: string) {
    await this.getCourse(user, courseId);
    return this.prisma.courseAnnouncement.findMany({ where: { courseSpaceId: courseId }, orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }] });
  }

  async createAnnouncement(user: RequestUser, courseId: string, body: Record<string, unknown>) {
    await this.assertCourseOwnerFromCourseId(user, courseId);
    return this.prisma.courseAnnouncement.create({
      data: {
        courseSpaceId: courseId,
        title: this.required(body.title, 'title'),
        body: this.required(body.body, 'body'),
        audience: this.optionalString(body.audience) || 'ALL',
        createdBy: user.id,
      },
    });
  }

  async updateAnnouncement(user: RequestUser, courseId: string, id: string, body: Record<string, unknown>) {
    await this.assertCourseOwnerFromCourseId(user, courseId);
    return this.prisma.courseAnnouncement.update({ where: { id }, data: this.clean(body, ['title', 'body', 'audience', 'status', 'isPinned']) });
  }

  async publishAnnouncement(user: RequestUser, courseId: string, id: string) {
    await this.assertCourseOwnerFromCourseId(user, courseId);
    const announcement = await this.prisma.courseAnnouncement.update({ where: { id }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
    const enrollments = await this.prisma.courseEnrollment.findMany({ where: { courseSpaceId: courseId, status: EnrollmentStatus.ACTIVE }, select: { studentId: true } });
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

  async teacherAnalytics(user: RequestUser, query: Record<string, string> = {}) {
    this.assertRole(user, ['TEACHER', 'SYSTEM_ADMIN']);
    const filter: Prisma.CourseSpaceWhereInput = { teacherId: user.role === 'TEACHER' ? user.id : undefined };
    if (query.academicYearId) filter.academicYearId = query.academicYearId;
    if (query.termId) filter.termId = query.termId;
    const courses = await this.prisma.courseSpace.findMany({ where: filter, include: this.courseIncludes() });
    const pending = await this.prisma.submission.count({ where: { courseSpace: filter, status: 'SUBMITTED' } });
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

  async adminSyncCourses(user: RequestUser, body: Record<string, unknown> = {}) {
    this.assertRole(user, ['SYSTEM_ADMIN']);
    const classSubjects = await this.listTeacherClassSubjects(user, this.optionalString(body.teacherId), body as Record<string, string>);
    const results: unknown[] = [];
    for (const classSubject of classSubjects) {
      try {
        results.push(await this.createCourseFromClassSubject(user, this.required(classSubject.id, 'classSubjectId'), body));
      } catch (error) {
        results.push({
          classSubjectId: this.stringFrom(classSubject.id),
          error: error instanceof Error ? error.message : 'Failed to generate course',
        });
      }
    }
    await this.audit(user, 'ADMIN_SYNC_COURSES', 'CourseSpace', undefined, { count: results.length });
    return { scanned: classSubjects.length, results };
  }

  async adminSyncEnrollments(user: RequestUser, body: Record<string, unknown> = {}) {
    this.assertRole(user, ['SYSTEM_ADMIN']);
    const courses = await this.prisma.courseSpace.findMany({
      where: {
        id: this.optionalString(body.courseId),
        termId: this.optionalString(body.termId),
        academicYearId: this.optionalString(body.academicYearId),
        status: { not: 'ARCHIVED' },
      },
    });
    const results: unknown[] = [];
    for (const course of courses) {
      try {
        results.push(await this.syncEnrollments(user, course.id, {}));
      } catch (error) {
        results.push({ courseId: course.id, error: error instanceof Error ? error.message : 'Failed to sync enrollments' });
      }
    }
    await this.audit(user, 'ADMIN_SYNC_ENROLLMENTS', 'CourseEnrollment', undefined, { count: results.length });
    return { scanned: courses.length, results };
  }

  async adminRepairOrphans(user: RequestUser, body: Record<string, unknown> = {}) {
    this.assertRole(user, ['SYSTEM_ADMIN']);
    const courses = await this.prisma.courseSpace.findMany({
      where: {
        termId: this.optionalString(body.termId),
        academicYearId: this.optionalString(body.academicYearId),
        status: { not: 'ARCHIVED' },
      },
    });
    const repaired: unknown[] = [];
    for (const course of courses) {
      const classSubject = await this.findClassSubject(user, course.classSubjectId).catch(() => null);
      if (!classSubject) {
        repaired.push(await this.prisma.courseSpace.update({ where: { id: course.id }, data: { status: 'ARCHIVED', archivedAt: new Date() } }));
        continue;
      }
      const teacherId = this.stringFrom(classSubject.teacherId);
      if (teacherId && teacherId !== course.teacherId) {
        repaired.push(await this.prisma.courseSpace.update({ where: { id: course.id }, data: { teacherId } }));
      }
    }
    await this.audit(user, 'ADMIN_REPAIR_ORPHAN_COURSES', 'CourseSpace', undefined, { repaired: repaired.length });
    return { scanned: courses.length, repaired };
  }

  async roleOverview(role: 'hod' | 'principal' | 'aqa', query: Record<string, string> = {}, user?: RequestUser) {
    const spaceFilter: Prisma.CourseSpaceWhereInput = {};
    if (query.academicYearId) spaceFilter.academicYearId = query.academicYearId;
    if (query.termId) spaceFilter.termId = query.termId;
    if (role === 'hod' && user?.role === 'HEAD_OF_DEPARTMENT') {
      const classSubjects = await this.listTeacherClassSubjects(user, undefined, query);
      const classSubjectIds = classSubjects.map((item) => this.stringFrom(item.id)).filter(Boolean);
      spaceFilter.classSubjectId = classSubjectIds.length ? { in: classSubjectIds } : '__no_department_courses__';
    }
    const hasFilter = Boolean(query.academicYearId || query.termId);
    const hasCourseScope = hasFilter || Object.keys(spaceFilter).length > 0;
    const childFilter = hasCourseScope ? { courseSpace: spaceFilter } : undefined;
    const [courses, active, draft, materials, lessons, assignments, submissions, quizzes, attempts, delayedGrading, openDiscussions] = await Promise.all([
      this.prisma.courseSpace.findMany({ where: spaceFilter, include: this.courseIncludes(), orderBy: { updatedAt: 'desc' } }),
      this.prisma.courseSpace.count({ where: { ...spaceFilter, status: 'ACTIVE' } }),
      this.prisma.courseSpace.count({ where: { ...spaceFilter, status: 'DRAFT' } }),
      this.prisma.material.count({ where: childFilter }),
      this.prisma.lesson.count({ where: childFilter }),
      this.prisma.assignment.count({ where: childFilter }),
      this.prisma.submission.count({ where: hasCourseScope ? { courseSpace: spaceFilter, status: { in: ['SUBMITTED', 'GRADED', 'RETURNED'] } } : { status: { in: ['SUBMITTED', 'GRADED', 'RETURNED'] } } }),
      this.prisma.quiz.count({ where: childFilter }),
      this.prisma.quizAttempt.count({ where: hasCourseScope ? { quiz: { courseSpace: spaceFilter } } : undefined }),
      this.prisma.submission.count({ where: hasCourseScope ? { courseSpace: spaceFilter, status: 'SUBMITTED', submittedAt: { lt: new Date(Date.now() - 72 * 60 * 60 * 1000) } } : { status: 'SUBMITTED', submittedAt: { lt: new Date(Date.now() - 72 * 60 * 60 * 1000) } } }),
      this.prisma.discussionThread.count({ where: hasCourseScope ? { courseSpace: spaceFilter, deletedAt: null, isResolved: false } : { deletedAt: null, isResolved: false } }),
    ]);
    const courseCount = courses.length;
    const publishedLessons = courses.reduce((sum, course) => sum + course.lessons.filter((lesson) => lesson.status === 'PUBLISHED').length, 0);
    const coverage = lessons ? Math.round((publishedLessons / lessons) * 100) : 0;
    return {
      role,
      courses: courseCount,
      active,
      draft,
      materials,
      lessons,
      assignments,
      submissions,
      quizzes,
      attempts,
      delayedGrading,
      openDiscussions,
      coverage,
      coursesDetail: courses,
      alerts: [
        { type: 'COURSE_SETUP_GAPS', count: draft, severity: draft > 0 ? 'MEDIUM' : 'LOW' },
        { type: 'DELAYED_GRADING', count: delayedGrading, severity: delayedGrading > 0 ? 'HIGH' : 'LOW' },
        { type: 'OPEN_STUDENT_QUESTIONS', count: openDiscussions, severity: openDiscussions > 10 ? 'MEDIUM' : 'LOW' },
      ],
    };
  }

  async studentSummary(user: RequestUser) {
    const studentId = await this.resolveStudentId(user);
    const courses = await this.prisma.courseEnrollment.findMany({ where: { studentId, status: EnrollmentStatus.ACTIVE }, include: { courseSpace: true } });
    const courseIds = courses.map((c) => c.courseSpaceId);
    const [pendingAssignments, availableQuizzes, unviewedMaterials] = await Promise.all([
      this.prisma.assignment.count({ where: { courseSpaceId: { in: courseIds }, status: 'PUBLISHED', submissions: { none: { studentId, status: { in: ['SUBMITTED', 'GRADED'] } } } } }),
      this.prisma.quiz.count({ where: { courseSpaceId: { in: courseIds }, status: 'PUBLISHED', attempts: { none: { studentId } } } }),
      this.prisma.material.count({ where: { courseSpaceId: { in: courseIds }, status: 'PUBLISHED', progress: { none: { studentId, viewedAt: { not: null } } } } }),
    ]);
    return { courses, pendingAssignments, availableQuizzes, unviewedMaterials };
  }

  async parentSummary(childId: string) {
    const enrollments = await this.prisma.courseEnrollment.findMany({ where: { studentId: childId, status: EnrollmentStatus.ACTIVE }, include: { courseSpace: true } });
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
    return this.prisma.courseEnrollment.findMany({ where: { studentId, status: EnrollmentStatus.ACTIVE }, include: { courseSpace: true } });
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
      update: { status: EnrollmentStatus.ACTIVE },
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
    const maxUploadBytes = Number(this.config.get<string>('ELEARNING_MAX_UPLOAD_MB', '50')) * 1024 * 1024;
    const fileBuffer = Buffer.from(base64, 'base64');
    if (fileBuffer.byteLength > maxUploadBytes) {
      throw new BadRequestException(`Upload exceeds ${(maxUploadBytes / (1024 * 1024)).toFixed(0)} MB limit`);
    }
    const storageRoot = normalize(this.config.get<string>('ELEARNING_STORAGE_DIR', './storage/elearning'));
    const relativeKey = `${domain}/${Date.now()}-${fileName}`;
    const absolutePath = join(storageRoot, relativeKey);
    await mkdir(join(storageRoot, domain), { recursive: true });
    await writeFile(absolutePath, fileBuffer);
    await this.audit(user, 'LOCAL_FILE_UPLOADED', 'Upload', relativeKey, { fileName, mimeType, domain });
    return {
      fileKey: relativeKey.replace(/\\/g, '/'),
      fileOriginalName: fileName,
      fileMimeType: mimeType,
      fileSizeBytes: fileBuffer.byteLength,
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

  private async getClassSubject(user: RequestUser, classSubjectId: string): Promise<Record<string, unknown>> {
    const classSubject = await this.findClassSubject(user, classSubjectId);
    if (!classSubject) throw new NotFoundException('Class-subject assignment not found');
    return classSubject;
  }

  private async findClassSubject(user: RequestUser, classSubjectId: string): Promise<Record<string, unknown> | null> {
    const candidates = await this.academicGet(user, '/academics/class-subjects', { teacherId: user.role === 'SYSTEM_ADMIN' ? undefined : user.id });
    const items = this.arrayPayload(candidates, ['classSubjects', 'assignments', 'items']);
    return items.find((item) => this.stringFrom(item.id) === classSubjectId) ?? null;
  }

  private assertClassSubjectTeacher(user: RequestUser, classSubject: Record<string, unknown>): void {
    if (user.role === 'SYSTEM_ADMIN') return;
    if (!TEACHING_ROLES.includes(user.role)) throw new ForbiddenException('Only assigned teachers can generate this course');
    const teacherId = this.stringFrom(classSubject.teacherId);
    if (teacherId !== user.id) throw new ForbiddenException('Teacher actions are limited to assigned class-subjects');
  }

  private async listTeacherClassSubjects(user: RequestUser, teacherId?: string, query: Record<string, unknown> = {}): Promise<Record<string, unknown>[]> {
    const params: Record<string, unknown> = {
      teacherId: teacherId || (TEACHING_ROLES.includes(user.role) ? user.id : undefined),
      academicYearId: query.academicYearId,
      subjectId: query.subjectId,
      classId: query.classId,
      educationStage: query.educationStage,
      classLevel: query.classLevel,
      combinationId: query.combinationId,
    };
    const payload = await this.academicGet(user, '/academics/class-subjects', params);
    return this.arrayPayload(payload, ['classSubjects', 'assignments', 'items']).filter((item) => {
      if (item.isActive === false) return false;
      if (teacherId && this.stringFrom(item.teacherId) !== teacherId && user.role !== 'SYSTEM_ADMIN') return false;
      return true;
    });
  }

  private async listTeacherTimetable(user: RequestUser, teacherId: string, query: Record<string, string> = {}): Promise<Record<string, unknown>[]> {
    const payload = await this.academicGet(user, '/academics/timetables', {
      teacherId,
      termId: query.termId,
      dayOfWeek: query.dayOfWeek,
    }).catch(() => []);
    return this.arrayPayload(payload, ['timetables', 'schedule', 'items']);
  }

  private todaySlots(slots: Record<string, unknown>[]): Record<string, unknown>[] {
    const day = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
    const short = day.slice(0, 3);
    return slots.filter((slot) => {
      const value = this.stringFrom(slot.dayOfWeek ?? slot.day ?? slot.weekday).toUpperCase();
      return value === day || value === short;
    });
  }

  private isSlotCurrent(slot: Record<string, unknown>, now: Date): boolean {
    const start = this.timeParts(this.stringFrom(slot.startTime ?? slot.time));
    const end = this.timeParts(this.stringFrom(slot.endTime));
    if (!start || !end) return Boolean(slot.current ?? slot.isCurrent);
    const minutes = now.getHours() * 60 + now.getMinutes();
    return minutes >= start && minutes <= end;
  }

  private slotStartsAfter(slot: Record<string, unknown>, now: Date): boolean {
    const start = this.timeParts(this.stringFrom(slot.startTime ?? slot.time));
    if (!start) return false;
    return start > now.getHours() * 60 + now.getMinutes();
  }

  private timeParts(value: string): number | null {
    const match = value.match(/(\d{1,2}):(\d{2})/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  private async currentTermId(user: RequestUser): Promise<string | undefined> {
    const payload = await this.studentGet(user, '/students/terms', { isCurrent: 'true' }).catch(() => null);
    return this.arrayPayload(payload, ['terms', 'items']).map((item) => this.stringFrom(item.id)).find(Boolean);
  }

  private async currentAcademicYearId(user: RequestUser): Promise<string | undefined> {
    const payload = await this.studentGet(user, '/students/academic-years').catch(() => null);
    const years = this.arrayPayload(payload, ['academicYears', 'years', 'items']);
    const current = years.find((item) => item.isCurrent === true) ?? years[0];
    return current ? this.stringFrom(current.id) : undefined;
  }

  private async resolveCourseStudentIds(user: RequestUser, course: { classId?: string | null; classSubjectId: string; academicYearId: string; termId: string; combinationId?: string | null }): Promise<string[]> {
    const classSubject = await this.findClassSubject(user, course.classSubjectId).catch(() => null);
    const classId = this.stringFrom(classSubject?.classId ?? course.classId);
    const subjectId = this.stringFrom(classSubject?.subjectId);
    if (course.combinationId || this.stringFrom(classSubject?.combinationId)) {
      const payload = await this.academicGet(user, '/academics/student-subject-enrollments', {
        classId,
        academicYearId: course.academicYearId,
        combinationId: course.combinationId || this.stringFrom(classSubject?.combinationId),
      }).catch(() => []);
      return this.arrayPayload(payload, ['enrollments', 'items']).map((item) => this.stringFrom(item.studentId)).filter(Boolean);
    }
    const roster = await this.studentGet(user, `/students/classes/${classId}/students`).catch(() => []);
    const rosterIds = this.arrayPayload(roster, ['students', 'items']).map((item) => this.stringFrom(item.studentId ?? item.id)).filter(Boolean);
    if (rosterIds.length) return rosterIds;
    if (!subjectId) return [];
    const subjectEnrollments = await this.academicGet(user, '/academics/student-subject-enrollments', {
      classId,
      academicYearId: course.academicYearId,
    }).catch(() => []);
    return this.arrayPayload(subjectEnrollments, ['enrollments', 'items'])
      .filter((item) => this.stringFrom(item.subjectId) === subjectId)
      .map((item) => this.stringFrom(item.studentId))
      .filter(Boolean);
  }

  private async academicGet(user: RequestUser, path: string, params: Record<string, unknown> = {}): Promise<unknown> {
    return this.serviceGet(user, this.config.get<string>('ACADEMIC_SERVICE_URL', 'http://localhost:3003'), `/api/v1${path}`, params);
  }

  private async studentGet(user: RequestUser, path: string, params: Record<string, unknown> = {}): Promise<unknown> {
    return this.serviceGet(user, this.config.get<string>('STUDENT_SERVICE_URL', 'http://localhost:3002'), path, params);
  }

  private async serviceGet(user: RequestUser, baseUrl: string | undefined, path: string, params: Record<string, unknown> = {}): Promise<unknown> {
    const url = new URL(path, baseUrl || 'http://localhost');
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }
    const response = await fetch(url, {
      headers: {
        'x-internal-request': 'true',
        'x-internal-api-key': this.config.get<string>('INTERNAL_API_KEY', ''),
        'x-user-id': user.id,
        'x-user-role': user.role,
        'x-user-email': user.email || '',
      },
    });
    if (!response.ok) throw new BadRequestException(`Downstream lookup failed: ${path}`);
    const data = await response.json();
    return this.unwrapPayload(data);
  }

  private unwrapPayload(value: unknown): unknown {
    if (!value || typeof value !== 'object') return value;
    const object = value as Record<string, unknown>;
    if ('data' in object) return object.data;
    return object;
  }

  private arrayPayload(value: unknown, keys: string[]): Record<string, unknown>[] {
    const payload = this.unwrapPayload(value);
    if (Array.isArray(payload)) return payload as Record<string, unknown>[];
    if (!payload || typeof payload !== 'object') return [];
    const object = payload as Record<string, unknown>;
    for (const key of keys) {
      const nested = this.unwrapPayload(object[key]);
      if (Array.isArray(nested)) return nested as Record<string, unknown>[];
    }
    return [];
  }

  private nameFrom(value: unknown): string {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return '';
    const item = value as Record<string, unknown>;
    return this.stringFrom(item.name ?? item.fullName ?? item.label ?? item.title);
  }

  private stringFrom(value: unknown): string {
    return value === undefined || value === null ? '' : String(value);
  }

  private numberFrom(value: unknown): number | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
  }

  private educationStage(value: unknown): 'PRIMARY' | 'O_LEVEL' | 'A_LEVEL' {
    const normalized = this.stringFrom(value).toUpperCase();
    if (normalized === 'PRIMARY' || normalized === 'A_LEVEL') return normalized;
    return 'O_LEVEL';
  }

  private classLabel(stage: unknown, level: unknown, classId?: unknown): string {
    const stageText = this.stringFrom(stage).replace('_', '-');
    const levelText = this.stringFrom(level);
    if (stageText && levelText) return `${stageText} Level ${levelText}`;
    if (stageText) return stageText;
    return this.stringFrom(classId) || 'Class';
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
      await this.assertStudentEnrollment(courseId, await this.resolveStudentId(user));
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
    if (!TEACHING_ROLES.includes(user.role) || user.id !== teacherId) throw new ForbiddenException('Teacher does not own this course');
  }

  private async assertStudentEnrollment(courseId: string, studentId: string): Promise<void> {
    const found = await this.prisma.courseEnrollment.findUnique({ where: { courseSpaceId_studentId: { courseSpaceId: courseId, studentId } } });
    if (!found) throw new ForbiddenException('Student is not enrolled in this course');
  }

  private assertRole(user: RequestUser, roles: string[]): void {
    if (!roles.includes(user.role)) throw new ForbiddenException('Insufficient permissions');
  }

  private async resolveStudentId(user: RequestUser): Promise<string> {
    if (user.role !== 'STUDENT') return user.id;
    const profile = await this.studentGet(user, `/students/internal/by-auth/${user.id}`).catch(() => null);
    const unwrapped = this.unwrapPayload(profile);
    if (unwrapped && typeof unwrapped === 'object') {
      const obj = unwrapped as Record<string, unknown>;
      const id = this.stringFrom(obj.studentId ?? obj.id);
      if (id) return id;
    }
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
      data: {
        action,
        entityType,
        entityId,
        actorId: user.id,
        actorRole: user.role,
        metadata: this.toJsonValue(metadata),
      },
    });
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
    if (value === undefined) return undefined;
    return JSON.parse(JSON.stringify(value, (_key, current) => (
      typeof current === 'bigint' ? current.toString() : current
    ))) as Prisma.InputJsonValue;
  }

  private toResponseValue<T>(value: T): T {
    return JSON.parse(JSON.stringify(value, (_key, current) => (
      typeof current === 'bigint' ? Number(current) : current
    ))) as T;
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
