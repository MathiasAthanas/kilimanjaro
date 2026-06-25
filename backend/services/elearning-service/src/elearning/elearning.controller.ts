import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, Res, StreamableFile } from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { ElearningService } from './elearning.service';

const ALL = ['SYSTEM_ADMIN', 'PRINCIPAL', 'ACADEMIC_QA', 'HEAD_OF_DEPARTMENT', 'TEACHER', 'PARENT', 'STUDENT'];
const STAFF = ['SYSTEM_ADMIN', 'PRINCIPAL', 'ACADEMIC_QA', 'HEAD_OF_DEPARTMENT', 'TEACHER'];

@Controller('elearning')
export class ElearningController {
  constructor(private readonly service: ElearningService) {}

  @Get('courses')
  @Roles(...ALL)
  listCourses(@CurrentUser() user: RequestUser, @Query() query: Record<string, string>) {
    return this.service.listCourses(user, query);
  }

  @Post('courses')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  createCourse(@CurrentUser() user: RequestUser, @Body() body: Record<string, unknown>) {
    return this.service.createCourse(user, body);
  }

  @Get('courses/:id')
  @Roles(...ALL)
  getCourse(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.getCourse(user, id);
  }

  @Patch('courses/:id')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  updateCourse(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.updateCourse(user, id, body);
  }

  @Patch('courses/:id/publish')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  publishCourse(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.publishCourse(user, id);
  }

  @Patch('courses/:id/archive')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  archiveCourse(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.archiveCourse(user, id);
  }

  @Post('courses/:id/copy')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  copyCourse(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.copyCourse(user, id, body);
  }

  @Get('courses/:id/overview')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  courseOverview(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.courseOverview(user, id);
  }

  @Get('courses/:id/students')
  @Roles('TEACHER', 'HEAD_OF_DEPARTMENT', 'SYSTEM_ADMIN')
  courseStudents(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.courseStudents(user, id);
  }

  @Post('courses/:id/sync-enrollments')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  syncEnrollments(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.syncEnrollments(user, id, body);
  }

  @Get('courses/:courseId/lessons')
  @Roles(...ALL)
  listLessons(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string) {
    return this.service.listLessons(user, courseId);
  }

  @Post('courses/:courseId/lessons')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  createLesson(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string, @Body() body: Record<string, unknown>) {
    return this.service.createLesson(user, courseId, body);
  }

  @Patch('courses/:courseId/lessons/reorder')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  reorderLessons(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string, @Body() body: Record<string, unknown>) {
    return this.service.reorderLessons(user, courseId, body);
  }

  @Patch('courses/:courseId/lessons/:id')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  updateLesson(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.updateLesson(user, courseId, id, body);
  }

  @Patch('courses/:courseId/lessons/:id/publish')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  publishLesson(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string, @Param('id') id: string) {
    return this.service.publishLesson(user, courseId, id);
  }

  @Delete('courses/:courseId/lessons/:id')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  archiveLesson(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string, @Param('id') id: string) {
    return this.service.archiveLesson(user, courseId, id);
  }

  @Get('courses/:courseId/lessons/:lessonId/materials')
  @Roles(...ALL)
  listMaterials(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string, @Param('lessonId') lessonId: string) {
    return this.service.listMaterials(user, courseId, lessonId);
  }

  @Post('courses/:courseId/lessons/:lessonId/materials')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  createMaterial(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string, @Param('lessonId') lessonId: string, @Body() body: Record<string, unknown>) {
    return this.service.createMaterial(user, courseId, lessonId, body);
  }

  @Patch('courses/:courseId/lessons/:lessonId/materials/reorder')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  reorderMaterials(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string, @Param('lessonId') lessonId: string, @Body() body: Record<string, unknown>) {
    return this.service.reorderMaterials(user, courseId, lessonId, body);
  }

  @Patch('courses/:courseId/lessons/:lessonId/materials/:id')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  updateMaterial(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string, @Param('lessonId') lessonId: string, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.updateMaterial(user, courseId, lessonId, id, body);
  }

  @Delete('courses/:courseId/lessons/:lessonId/materials/:id')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  archiveMaterial(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string, @Param('lessonId') lessonId: string, @Param('id') id: string) {
    return this.service.archiveMaterial(user, courseId, lessonId, id);
  }

  @Get('materials/:id/download')
  @Roles(...ALL)
  downloadMaterial(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.downloadMaterial(user, id);
  }

  @Post('materials/:id/view')
  @Roles('STUDENT', 'SYSTEM_ADMIN')
  viewMaterial(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.viewMaterial(user, id);
  }

  @Get('courses/:courseId/assignments')
  @Roles(...ALL)
  listAssignments(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string) {
    return this.service.listAssignments(user, courseId);
  }

  @Post('courses/:courseId/assignments')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  createAssignment(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string, @Body() body: Record<string, unknown>) {
    return this.service.createAssignment(user, courseId, body);
  }

  @Get('courses/:courseId/assignments/:id')
  @Roles(...ALL)
  getAssignment(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string, @Param('id') id: string) {
    return this.service.getAssignment(user, courseId, id);
  }

  @Patch('courses/:courseId/assignments/:id')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  updateAssignment(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.updateAssignment(user, courseId, id, body);
  }

  @Patch('courses/:courseId/assignments/:id/publish')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  publishAssignment(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string, @Param('id') id: string) {
    return this.service.publishAssignment(user, courseId, id);
  }

  @Patch('courses/:courseId/assignments/:id/close')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  closeAssignment(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string, @Param('id') id: string) {
    return this.service.closeAssignment(user, courseId, id);
  }

  @Get('courses/:courseId/assignments/:id/submissions')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  assignmentSubmissions(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string, @Param('id') id: string) {
    return this.service.assignmentSubmissions(user, courseId, id);
  }

  @Get('courses/:courseId/assignments/:id/submissions/summary')
  @Roles('TEACHER', 'HEAD_OF_DEPARTMENT', 'SYSTEM_ADMIN')
  assignmentSummary(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string, @Param('id') id: string) {
    return this.service.assignmentSummary(user, courseId, id);
  }

  @Get('courses/:courseId/assignments/:id/submissions/missing')
  @Roles('TEACHER', 'HEAD_OF_DEPARTMENT', 'SYSTEM_ADMIN')
  missingSubmissions(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string, @Param('id') id: string) {
    return this.service.missingSubmissions(user, courseId, id);
  }

  @Get('assignments/:assignmentId/my-submission')
  @Roles('STUDENT', 'SYSTEM_ADMIN')
  mySubmission(@CurrentUser() user: RequestUser, @Param('assignmentId') assignmentId: string) {
    return this.service.mySubmission(user, assignmentId);
  }

  @Post('assignments/:assignmentId/submissions')
  @Roles('STUDENT', 'SYSTEM_ADMIN')
  upsertSubmission(@CurrentUser() user: RequestUser, @Param('assignmentId') assignmentId: string, @Body() body: Record<string, unknown>) {
    return this.service.upsertSubmission(user, assignmentId, body);
  }

  @Patch('assignments/:assignmentId/submissions/:id/submit')
  @Roles('STUDENT', 'SYSTEM_ADMIN')
  submitSubmission(@CurrentUser() user: RequestUser, @Param('assignmentId') assignmentId: string, @Param('id') id: string) {
    return this.service.submitSubmission(user, assignmentId, id);
  }

  @Get('submissions/:id')
  @Roles('TEACHER', 'STUDENT', 'SYSTEM_ADMIN')
  getSubmission(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.getSubmission(user, id);
  }

  @Patch('submissions/:id/grade')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  gradeSubmission(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.gradeSubmission(user, id, body);
  }

  @Patch('submissions/:id/return')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  returnSubmission(@CurrentUser() user: RequestUser, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.returnSubmission(user, id, body);
  }

  @Get('submissions/:id/download')
  @Roles('TEACHER', 'STUDENT', 'SYSTEM_ADMIN')
  async downloadSubmission(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    const submission = await this.service.getSubmission(user, id);
    const parts = submission.fileKey?.replace(/\\/g, '/').split('/') ?? [];
    const fileUrl = parts.length >= 2
      ? `/elearning/files/${parts[0]}/${encodeURIComponent(parts.slice(1).join('/'))}`
      : null;
    return { submission, download: { url: fileUrl } };
  }

  @Get('files/:domain/:filename')
  @Roles(...ALL)
  @Header('Cache-Control', 'max-age=86400')
  async serveFile(
    @CurrentUser() _user: RequestUser,
    @Param('domain') domain: string,
    @Param('filename') filename: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { stream, filename: name, mimeType } = await this.service.readStorageFile(domain, decodeURIComponent(filename));
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${name}"`);
    return new StreamableFile(stream);
  }

  @Get('courses/:courseId/my-submissions')
  @Roles('STUDENT', 'SYSTEM_ADMIN')
  mySubmissions(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string) {
    return this.service.mySubmissions(user, courseId);
  }

  @Get('courses/:courseId/quizzes')
  @Roles(...ALL)
  listQuizzes(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string) {
    return this.service.listQuizzes(user, courseId);
  }

  @Post('courses/:courseId/quizzes')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  createQuiz(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string, @Body() body: Record<string, unknown>) {
    return this.service.createQuiz(user, courseId, body);
  }

  @Get('courses/:courseId/quizzes/:id')
  @Roles(...ALL)
  getQuiz(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string, @Param('id') id: string) {
    return this.service.getQuiz(user, courseId, id);
  }

  @Patch('courses/:courseId/quizzes/:id')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  updateQuiz(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.updateQuiz(user, courseId, id, body);
  }

  @Patch('courses/:courseId/quizzes/:id/publish')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  publishQuiz(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string, @Param('id') id: string) {
    return this.service.publishQuiz(user, courseId, id);
  }

  @Patch('courses/:courseId/quizzes/:id/close')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  closeQuiz(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string, @Param('id') id: string) {
    return this.service.closeQuiz(user, courseId, id);
  }

  @Get('courses/:courseId/quizzes/:id/results')
  @Roles('TEACHER', 'HEAD_OF_DEPARTMENT', 'SYSTEM_ADMIN')
  quizResults(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string, @Param('id') id: string) {
    return this.service.quizResults(user, courseId, id);
  }

  @Post('quizzes/:quizId/questions')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  addQuestion(@CurrentUser() user: RequestUser, @Param('quizId') quizId: string, @Body() body: Record<string, unknown>) {
    return this.service.addQuestion(user, quizId, body);
  }

  @Patch('quizzes/:quizId/questions/:questionId')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  updateQuestion(@CurrentUser() user: RequestUser, @Param('quizId') quizId: string, @Param('questionId') questionId: string, @Body() body: Record<string, unknown>) {
    return this.service.updateQuestion(user, quizId, questionId, body);
  }

  @Delete('quizzes/:quizId/questions/:questionId')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  deleteQuestion(@CurrentUser() user: RequestUser, @Param('quizId') quizId: string, @Param('questionId') questionId: string) {
    return this.service.deleteQuestion(user, quizId, questionId);
  }

  @Patch('quizzes/:quizId/questions/reorder')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  reorderQuestions(@CurrentUser() user: RequestUser, @Param('quizId') quizId: string, @Body() body: Record<string, unknown>) {
    return this.service.reorderQuestions(user, quizId, body);
  }

  @Post('quizzes/:quizId/attempts/start')
  @Roles('STUDENT', 'SYSTEM_ADMIN')
  startAttempt(@CurrentUser() user: RequestUser, @Param('quizId') quizId: string) {
    return this.service.startAttempt(user, quizId);
  }

  @Get('quizzes/:quizId/attempts/active')
  @Roles('STUDENT', 'SYSTEM_ADMIN')
  activeAttempt(@CurrentUser() user: RequestUser, @Param('quizId') quizId: string) {
    return this.service.activeAttempt(user, quizId);
  }

  @Patch('attempts/:attemptId/answer')
  @Roles('STUDENT', 'SYSTEM_ADMIN')
  saveAnswer(@CurrentUser() user: RequestUser, @Param('attemptId') attemptId: string, @Body() body: Record<string, unknown>) {
    return this.service.saveAnswer(user, attemptId, body);
  }

  @Patch('attempts/:attemptId/submit')
  @Roles('STUDENT', 'SYSTEM_ADMIN')
  submitAttempt(@CurrentUser() user: RequestUser, @Param('attemptId') attemptId: string) {
    return this.service.submitAttempt(user, attemptId);
  }

  @Get('attempts/:attemptId')
  @Roles('STUDENT', 'TEACHER', 'SYSTEM_ADMIN')
  getAttempt(@CurrentUser() user: RequestUser, @Param('attemptId') attemptId: string) {
    return this.service.getAttempt(user, attemptId);
  }

  @Get('quizzes/:quizId/my-attempts')
  @Roles('STUDENT', 'SYSTEM_ADMIN')
  myAttempts(@CurrentUser() user: RequestUser, @Param('quizId') quizId: string) {
    return this.service.myAttempts(user, quizId);
  }

  @Patch('attempts/:attemptId/grade-short-answer')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  gradeShortAnswer(@CurrentUser() user: RequestUser, @Param('attemptId') attemptId: string, @Body() body: Record<string, unknown>) {
    return this.service.gradeShortAnswer(user, attemptId, body);
  }

  @Get('courses/:courseId/my-progress')
  @Roles('STUDENT', 'SYSTEM_ADMIN')
  myProgress(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string) {
    return this.service.myProgress(user, courseId);
  }

  @Get('courses/:courseId/progress/:studentId')
  @Roles(...ALL)
  progressForStudent(@Param('courseId') courseId: string, @Param('studentId') studentId: string) {
    return this.service.progressForStudent(courseId, studentId);
  }

  @Get('courses/:courseId/progress')
  @Roles(...STAFF)
  allProgress(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string) {
    return this.service.allProgress(user, courseId);
  }

  @Get('lessons/:lessonId/progress')
  @Roles('STUDENT', 'TEACHER', 'SYSTEM_ADMIN')
  lessonProgress(@CurrentUser() user: RequestUser, @Param('lessonId') lessonId: string) {
    return this.service.lessonProgress(user, lessonId);
  }

  @Get('courses/:courseId/announcements')
  @Roles(...ALL)
  listAnnouncements(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string) {
    return this.service.listAnnouncements(user, courseId);
  }

  @Post('courses/:courseId/announcements')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  createAnnouncement(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string, @Body() body: Record<string, unknown>) {
    return this.service.createAnnouncement(user, courseId, body);
  }

  @Patch('courses/:courseId/announcements/:id')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  updateAnnouncement(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.updateAnnouncement(user, courseId, id, body);
  }

  @Patch('courses/:courseId/announcements/:id/publish')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  publishAnnouncement(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string, @Param('id') id: string) {
    return this.service.publishAnnouncement(user, courseId, id);
  }

  @Patch('courses/:courseId/announcements/:id/pin')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  pinAnnouncement(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.pinAnnouncement(user, courseId, id, body);
  }

  @Delete('courses/:courseId/announcements/:id')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  deleteAnnouncement(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string, @Param('id') id: string) {
    return this.service.deleteAnnouncement(user, courseId, id);
  }

  @Get('courses/:courseId/discussions')
  @Roles(...ALL)
  listDiscussions(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string) {
    return this.service.listDiscussions(user, courseId);
  }

  @Post('courses/:courseId/discussions')
  @Roles('STUDENT', 'TEACHER', 'SYSTEM_ADMIN')
  createDiscussion(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string, @Body() body: Record<string, unknown>) {
    return this.service.createDiscussion(user, courseId, body);
  }

  @Get('discussions/:threadId')
  @Roles(...ALL)
  getDiscussion(@CurrentUser() user: RequestUser, @Param('threadId') threadId: string) {
    return this.service.getDiscussion(user, threadId);
  }

  @Post('discussions/:threadId/replies')
  @Roles('STUDENT', 'TEACHER', 'SYSTEM_ADMIN')
  addReply(@CurrentUser() user: RequestUser, @Param('threadId') threadId: string, @Body() body: Record<string, unknown>) {
    return this.service.addReply(user, threadId, body);
  }

  @Patch('discussions/:threadId/resolve')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  resolveDiscussion(@CurrentUser() user: RequestUser, @Param('threadId') threadId: string) {
    return this.service.updateDiscussionFlag(user, threadId, 'isResolved', true);
  }

  @Patch('discussions/:threadId/pin')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  pinDiscussion(@CurrentUser() user: RequestUser, @Param('threadId') threadId: string, @Body() body: Record<string, unknown>) {
    return this.service.updateDiscussionFlag(user, threadId, 'isPinned', body.isPinned !== false);
  }

  @Delete('discussions/:threadId')
  @Roles('STUDENT', 'TEACHER', 'SYSTEM_ADMIN')
  deleteDiscussion(@CurrentUser() user: RequestUser, @Param('threadId') threadId: string) {
    return this.service.deleteDiscussion(user, threadId);
  }

  @Get('analytics/teacher/courses')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  teacherAnalytics(@CurrentUser() user: RequestUser, @Query() query: Record<string, string>) {
    return this.service.teacherAnalytics(user, query);
  }

  @Get('analytics/teacher/courses/:courseId/engagement')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  engagement(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string) {
    return this.service.engagement(user, courseId);
  }

  @Get('analytics/teacher/courses/:courseId/struggling')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  struggling(@CurrentUser() user: RequestUser, @Param('courseId') courseId: string) {
    return this.service.struggling(user, courseId);
  }

  @Post('uploads/local')
  @Roles('TEACHER', 'STUDENT', 'SYSTEM_ADMIN')
  createLocalUpload(@CurrentUser() user: RequestUser, @Body() body: Record<string, unknown>) {
    return this.service.createLocalUpload(user, body);
  }

  @Get('admin/audit-logs')
  @Roles('SYSTEM_ADMIN', 'ACADEMIC_QA', 'PRINCIPAL')
  auditLogs(@CurrentUser() user: RequestUser, @Query() query: Record<string, string>) {
    return this.service.auditLogs(user, query);
  }

  @Get('admin/storage-policy')
  @Roles('SYSTEM_ADMIN')
  storagePolicy(@CurrentUser() user: RequestUser) {
    return this.service.storagePolicy(user);
  }

  @Get('analytics/hod/overview')
  @Roles('HEAD_OF_DEPARTMENT', 'SYSTEM_ADMIN')
  hodOverview(@Query() query: Record<string, string>) {
    return this.service.roleOverview('hod', query);
  }

  @Get('analytics/principal/overview')
  @Roles('PRINCIPAL', 'SYSTEM_ADMIN')
  principalOverview(@Query() query: Record<string, string>) {
    return this.service.roleOverview('principal', query);
  }

  @Get('analytics/aqa/courses')
  @Roles('ACADEMIC_QA', 'SYSTEM_ADMIN')
  aqaOverview(@Query() query: Record<string, string>) {
    return this.service.roleOverview('aqa', query);
  }

  @Get('analytics/student/summary')
  @Roles('STUDENT', 'SYSTEM_ADMIN')
  studentSummary(@CurrentUser() user: RequestUser) {
    return this.service.studentSummary(user);
  }

  @Get('analytics/parent/:childId/summary')
  @Roles('PARENT', 'SYSTEM_ADMIN')
  parentSummary(@Param('childId') childId: string) {
    return this.service.parentSummary(childId);
  }

  @Public()
  @Get('internal/students/:studentId/courses')
  internalStudentCourses(@Param('studentId') studentId: string) {
    return this.service.internalStudentCourses(studentId);
  }

  @Public()
  @Post('internal/enrollment-sync')
  internalEnrollmentSync(@Body() body: Record<string, unknown>) {
    return this.service.internalEnrollmentSync(body);
  }

  @Public()
  @Get('internal/courses/:courseId/has-student/:studentId')
  internalHasStudent(@Param('courseId') courseId: string, @Param('studentId') studentId: string) {
    return this.service.internalHasStudent(courseId, studentId);
  }
}
