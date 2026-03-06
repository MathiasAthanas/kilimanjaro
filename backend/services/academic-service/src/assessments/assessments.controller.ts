import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { ApproveAssessmentDto } from './dto/approve-assessment.dto';
import { BulkMarksDto } from './dto/bulk-marks.dto';
import { GenerateAssessmentsDto } from './dto/generate-assessments.dto';
import { RejectAssessmentDto } from './dto/reject-assessment.dto';
import { SubmitAssessmentDto } from './dto/submit-assessment.dto';
import { UpdateMarkDto } from './dto/update-mark.dto';
import { AssessmentsService } from './assessments.service';

@ApiTags('Academic - Assessments')
@Controller('academics')
export class AssessmentsController {
  constructor(private readonly assessmentsService: AssessmentsService) {}

  @Post('assessments/generate')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA)
  generate(@Body() dto: GenerateAssessmentsDto) {
    return this.assessmentsService.generateAssessments(dto);
  }

  @Get('assessments')
  @Roles(
    ROLES.SYSTEM_ADMIN,
    ROLES.PRINCIPAL,
    ROLES.ACADEMIC_QA,
    ROLES.HEAD_OF_DEPARTMENT,
    ROLES.TEACHER,
  )
  list(
    @Query('classId') classId: string | undefined,
    @Query('subjectId') subjectId: string | undefined,
    @Query('termId') termId: string | undefined,
    @Query('status') status: any,
    @Query('teacherId') teacherId: string | undefined,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.assessmentsService.listAssessments({ classId, subjectId, termId, status, teacherId }, user);
  }

  @Get('assessments/pending-approval')
  @Roles(ROLES.HEAD_OF_DEPARTMENT, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA)
  pending(
    @Query('classId') classId: string | undefined,
    @Query('subjectId') subjectId: string | undefined,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.assessmentsService.pendingApproval({ classId, subjectId }, user!);
  }

  @Get('assessments/:id')
  @Roles(
    ROLES.SYSTEM_ADMIN,
    ROLES.PRINCIPAL,
    ROLES.ACADEMIC_QA,
    ROLES.HEAD_OF_DEPARTMENT,
    ROLES.TEACHER,
  )
  byId(@Param('id') id: string, @CurrentUser() user?: RequestUser) {
    return this.assessmentsService.getAssessment(id, user);
  }

  @Get('assessments/:id/marks/sheet')
  @Roles(ROLES.TEACHER, ROLES.HEAD_OF_DEPARTMENT, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA)
  marksSheet(@Param('id') id: string, @CurrentUser() user?: RequestUser) {
    return this.assessmentsService.getMarksSheet(id, user!);
  }

  @Post('assessments/:id/marks/bulk')
  @Roles(ROLES.TEACHER)
  bulkMarks(@Param('id') id: string, @Body() dto: BulkMarksDto, @CurrentUser() user?: RequestUser) {
    return this.assessmentsService.bulkUpsertMarks(id, dto, user!);
  }

  @Patch('assessments/:id/marks/:markId')
  @Roles(ROLES.TEACHER, ROLES.HEAD_OF_DEPARTMENT, ROLES.PRINCIPAL)
  updateMark(
    @Param('id') id: string,
    @Param('markId') markId: string,
    @Body() dto: UpdateMarkDto,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.assessmentsService.updateMark(id, markId, dto, user!);
  }

  @Post('assessments/:id/submit')
  @Roles(ROLES.TEACHER)
  submit(@Param('id') id: string, @Body() dto: SubmitAssessmentDto, @CurrentUser() user?: RequestUser) {
    return this.assessmentsService.submitAssessment(id, dto, user!);
  }

  @Get('assessments/:id/marks/review')
  @Roles(ROLES.HEAD_OF_DEPARTMENT, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA)
  review(@Param('id') id: string) {
    return this.assessmentsService.reviewAssessment(id);
  }

  @Patch('assessments/:id/approve')
  @Roles(ROLES.HEAD_OF_DEPARTMENT, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA)
  approve(@Param('id') id: string, @Body() dto: ApproveAssessmentDto, @CurrentUser() user?: RequestUser) {
    return this.assessmentsService.approveAssessment(id, dto, user!);
  }

  @Patch('assessments/:id/reject')
  @Roles(ROLES.HEAD_OF_DEPARTMENT, ROLES.PRINCIPAL, ROLES.ACADEMIC_QA)
  reject(@Param('id') id: string, @Body() dto: RejectAssessmentDto, @CurrentUser() user?: RequestUser) {
    return this.assessmentsService.rejectAssessment(id, dto, user!);
  }
}
