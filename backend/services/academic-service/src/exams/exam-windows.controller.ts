import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateExamWindowDto, ExamWindowFilterDto, UpdateExamWindowDto } from './dto/exam-window.dto';
import { CreateEditRequestDto, DecideEditRequestDto } from './dto/edit-request.dto';
import { ExamWindowsService } from './exam-windows.service';

const ADMIN = [
  ROLES.SYSTEM_ADMIN,
  ROLES.PRINCIPAL,
  ROLES.MANAGER,
  ROLES.HEAD_OF_SCHOOL,
  ROLES.SUPER_ADMIN,
  ROLES.ACADEMIC_QA,
] as const;

@ApiTags('Academic - Exam Windows')
@Controller('academics')
export class ExamWindowsController {
  constructor(private readonly windows: ExamWindowsService) {}

  // ── Static sub-routes declared BEFORE ':id' so they are not swallowed ──────

  @Get('exam-windows/teacher')
  @Roles(ROLES.TEACHER, ROLES.HEAD_OF_DEPARTMENT)
  teacherWindows(@CurrentUser() user: RequestUser) {
    return this.windows.teacherWindows(user);
  }

  @Post('exam-windows/edit-requests')
  @Roles(ROLES.TEACHER, ROLES.HEAD_OF_DEPARTMENT)
  createEditRequest(@Body() dto: CreateEditRequestDto, @CurrentUser() user: RequestUser) {
    return this.windows.createEditRequest(dto, user);
  }

  @Get('exam-windows/edit-requests')
  @Roles(...ADMIN, ROLES.TEACHER, ROLES.HEAD_OF_DEPARTMENT)
  listEditRequests(
    @Query('examWindowId') examWindowId?: string,
    @Query('status') status?: string,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.windows.listEditRequests({ examWindowId, status }, user!);
  }

  @Post('exam-windows/edit-requests/:id/grant')
  @Roles(...ADMIN)
  grantEditRequest(@Param('id') id: string, @Body() dto: DecideEditRequestDto, @CurrentUser() user: RequestUser) {
    return this.windows.grantEditRequest(id, dto, user);
  }

  @Post('exam-windows/edit-requests/:id/reject')
  @Roles(...ADMIN)
  rejectEditRequest(@Param('id') id: string, @Body() dto: DecideEditRequestDto, @CurrentUser() user: RequestUser) {
    return this.windows.rejectEditRequest(id, dto, user);
  }

  @Post('exam-windows/edit-requests/:id/complete')
  @Roles(ROLES.TEACHER, ROLES.HEAD_OF_DEPARTMENT)
  completeEditRequest(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.windows.completeEditRequest(id, user);
  }

  // ── Windows ───────────────────────────────────────────────────────────────

  @Post('exam-windows')
  @Roles(...ADMIN)
  create(@Body() dto: CreateExamWindowDto, @CurrentUser() user: RequestUser) {
    return this.windows.create(dto, user);
  }

  @Get('exam-windows')
  @Roles(...ADMIN, ROLES.HEAD_OF_DEPARTMENT)
  list(@Query() filters: ExamWindowFilterDto, @CurrentUser() user: RequestUser) {
    return this.windows.list(filters, user);
  }

  @Get('exam-windows/:id')
  @Roles(...ADMIN, ROLES.HEAD_OF_DEPARTMENT, ROLES.TEACHER)
  detail(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.windows.detail(id, user);
  }

  @Patch('exam-windows/:id')
  @Roles(...ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateExamWindowDto, @CurrentUser() user: RequestUser) {
    return this.windows.update(id, dto, user);
  }

  @Post('exam-windows/:id/open')
  @Roles(...ADMIN)
  open(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.windows.open(id, user);
  }

  @Post('exam-windows/:id/close')
  @Roles(...ADMIN)
  close(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.windows.close(id, user);
  }

  @Post('exam-windows/:id/publish')
  @Roles(...ADMIN)
  publish(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.windows.publish(id, user);
  }

  @Post('exam-windows/:id/unpublish')
  @Roles(...ADMIN)
  unpublish(@Param('id') id: string, @Body() body: { reason?: string }, @CurrentUser() user: RequestUser) {
    return this.windows.unpublish(id, user, body?.reason);
  }

  @Post('exam-windows/:id/archive')
  @Roles(...ADMIN)
  archive(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.windows.archive(id, user);
  }
}
