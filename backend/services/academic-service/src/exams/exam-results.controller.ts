import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { ExamResultsService } from './exam-results.service';

const STAFF = [
  ROLES.SYSTEM_ADMIN,
  ROLES.PRINCIPAL,
  ROLES.MANAGER,
  ROLES.HEAD_OF_SCHOOL,
  ROLES.SUPER_ADMIN,
  ROLES.ACADEMIC_QA,
  ROLES.HEAD_OF_DEPARTMENT,
  ROLES.TEACHER,
] as const;

@ApiTags('Academic - Exam Results')
@Controller('academics')
export class ExamResultsController {
  constructor(private readonly examResults: ExamResultsService) {}

  @Post('exam-windows/:id/compute')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL, ROLES.SUPER_ADMIN, ROLES.ACADEMIC_QA)
  compute(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.examResults.compute(id, user);
  }

  @Get('exam-windows/:id/merit-list')
  @Roles(...STAFF)
  meritList(
    @Param('id') id: string,
    @Query('classId') classId?: string,
    @Query('level') level?: string,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.examResults.getMeritList(id, user!, {
      classId,
      level: level ? Number(level) : undefined,
    });
  }

  @Get('exam-windows/:id/student/:studentId')
  @Roles(...STAFF, ROLES.STUDENT, ROLES.PARENT)
  studentResult(
    @Param('id') id: string,
    @Param('studentId') studentId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.examResults.studentResult(id, studentId, user);
  }

  @Get('students/:studentId/exam-results')
  @Roles(...STAFF, ROLES.STUDENT, ROLES.PARENT)
  studentHistory(
    @Param('studentId') studentId: string,
    @Query('termId') termId?: string,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.examResults.listStudentWindows(studentId, user!, termId);
  }
}
