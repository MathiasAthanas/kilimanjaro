import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { OmitSubjectDto } from './dto/omit-subject.dto';
import { ExamWindowSubjectsService } from './exam-window-subjects.service';

const ADMIN = [ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL, ROLES.SUPER_ADMIN, ROLES.ACADEMIC_QA] as const;

/** Registered before ExamWindowsController so `exam-windows/subject-rules` is not read as a window id. */
@ApiTags('Academic - Exam window subjects')
@Controller('academics/exam-windows')
export class ExamWindowSubjectsController {
  constructor(private readonly subjects: ExamWindowSubjectsService) {}

  @Get('subject-rules')
  @Roles(...ADMIN)
  standing(@CurrentUser() user: RequestUser) {
    return this.subjects.listStanding(user);
  }

  @Delete('subject-rules/:ruleId')
  @Roles(...ADMIN)
  removeStanding(@Param('ruleId') ruleId: string, @CurrentUser() user: RequestUser) {
    return this.subjects.removeStanding(ruleId, user);
  }

  @Get(':id/preview')
  @Roles(...ADMIN, ROLES.HEAD_OF_DEPARTMENT)
  preview(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.subjects.plan(id, user);
  }

  @Post(':id/subjects/omit')
  @Roles(...ADMIN)
  omit(@Param('id') id: string, @Body() dto: OmitSubjectDto, @CurrentUser() user: RequestUser) {
    return this.subjects.omit(id, dto, user);
  }

  @Delete(':id/subjects/omissions/:exclusionId')
  @Roles(...ADMIN)
  restore(@Param('id') id: string, @Param('exclusionId') exclusionId: string, @CurrentUser() user: RequestUser) {
    return this.subjects.restore(id, exclusionId, user);
  }
}
