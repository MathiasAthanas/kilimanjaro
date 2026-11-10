import { Controller, Get, Param, Patch, Post, Res, Body, NotFoundException, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { constants } from 'fs';
import { access } from 'fs/promises';
import { resolve } from 'path';
import { ConfigService } from '@nestjs/config';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { GenerateReportCardsDto } from './dto/generate-report-cards.dto';
import { UpdateCommentsDto } from './dto/update-comments.dto';
import { ReportCardsService } from './report-cards.service';
import { ReportCardPolicyService } from './report-card-policy.service';
import { UpdateReportCardPolicyDto } from './dto/update-report-card-policy.dto';
import { RecalculateReportCardsDto } from './dto/recalculate-report-cards.dto';

@ApiTags('Academic - Report Cards')
@Controller('academics')
export class ReportCardsController {
  constructor(
    private readonly reportCardsService: ReportCardsService,
    private readonly reportCardPolicyService: ReportCardPolicyService,
    private readonly configService: ConfigService,
  ) {}

  @Get('report-card-policy')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.SUPER_ADMIN, ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL)
  getPolicy(@CurrentUser() user?: RequestUser) {
    return this.reportCardPolicyService.getForUser(user!);
  }

  @Patch('report-card-policy')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.SUPER_ADMIN, ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL)
  updatePolicy(@Body() dto: UpdateReportCardPolicyDto, @CurrentUser() user?: RequestUser) {
    return this.reportCardPolicyService.update(dto, user!);
  }

  @Get('report-card-policy/recalculation-preview')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.SUPER_ADMIN, ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL)
  previewRecalculation(@Query('termId') termId: string, @CurrentUser() user?: RequestUser) {
    return this.reportCardsService.previewRecalculation(termId, user!);
  }

  @Post('report-card-policy/recalculate')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.SUPER_ADMIN, ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL)
  recalculate(@Body() dto: RecalculateReportCardsDto, @CurrentUser() user?: RequestUser) {
    return this.reportCardsService.recalculateExisting(dto.termId, user!);
  }

  @Post('report-cards/generate')
  @Roles(ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL, ROLES.SUPER_ADMIN, ROLES.ACADEMIC_QA)
  generate(@Body() dto: GenerateReportCardsDto, @CurrentUser() user?: RequestUser) {
    return this.reportCardsService.generate(dto, user!);
  }

  @Get('report-cards/student/:studentId')
  @Roles(
    ROLES.SYSTEM_ADMIN,
    ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL, ROLES.SUPER_ADMIN,
    ROLES.ACADEMIC_QA,
    ROLES.HEAD_OF_DEPARTMENT,
    ROLES.TEACHER,
    ROLES.PARENT,
    ROLES.STUDENT,
  )
  listForStudent(@Param('studentId') studentId: string, @CurrentUser() user?: RequestUser) {
    return this.reportCardsService.listForStudent(studentId, user!);
  }

  @Get('report-cards/available/classes')
  @Roles(
    ROLES.SYSTEM_ADMIN,
    ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL, ROLES.SUPER_ADMIN,
    ROLES.ACADEMIC_QA,
    ROLES.HEAD_OF_DEPARTMENT,
    ROLES.TEACHER,
  )
  listAvailableClasses(@CurrentUser() user?: RequestUser) {
    return this.reportCardsService.listAvailableClasses(user!);
  }

  @Get('report-cards/class/:classId/term/:termId')
  @Roles(
    ROLES.SYSTEM_ADMIN,
    ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL, ROLES.SUPER_ADMIN,
    ROLES.ACADEMIC_QA,
    ROLES.HEAD_OF_DEPARTMENT,
    ROLES.TEACHER,
  )
  listForClass(@Param('classId') classId: string, @Param('termId') termId: string, @CurrentUser() user?: RequestUser) {
    return this.reportCardsService.listForClass(classId, termId, user?.id || 'system');
  }

  @Get('report-cards/:studentId/term/:termId')
  @Roles(
    ROLES.SYSTEM_ADMIN,
    ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL, ROLES.SUPER_ADMIN,
    ROLES.ACADEMIC_QA,
    ROLES.HEAD_OF_DEPARTMENT,
    ROLES.TEACHER,
    ROLES.PARENT,
    ROLES.STUDENT,
  )
  getCard(@Param('studentId') studentId: string, @Param('termId') termId: string, @CurrentUser() user?: RequestUser) {
    return this.reportCardsService.getReportCard(studentId, termId, user!);
  }

  @Get('report-cards/:studentId/term/:termId/pdf')
  @Roles(
    ROLES.SYSTEM_ADMIN,
    ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL, ROLES.SUPER_ADMIN,
    ROLES.ACADEMIC_QA,
    ROLES.HEAD_OF_DEPARTMENT,
    ROLES.TEACHER,
    ROLES.PARENT,
    ROLES.STUDENT,
  )
  async streamPdf(
    @Param('studentId') studentId: string,
    @Param('termId') termId: string,
    @CurrentUser() user: RequestUser,
    @Res() res: Response,
  ) {
    const fileName = await this.reportCardsService.getReportPdfPath(studentId, termId, user);
    const storageRoot = this.configService.get<string>('PDF_STORAGE_PATH', './storage/report-cards');
    const absolutePath = resolve(storageRoot, fileName);

    try {
      await access(absolutePath, constants.R_OK);
    } catch {
      throw new NotFoundException('The report card PDF is unavailable. Compose the report card again.');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    return res.sendFile(absolutePath);
  }

  @Patch('report-cards/:id/sign')
  @Roles(ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL, ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMIN)
  signReportCard(@Param('id') id: string, @Body() body: { signatureText?: string }, @CurrentUser() user?: RequestUser) {
    return this.reportCardsService.signReportCard(id, body.signatureText || 'Approved', user!);
  }

  @Patch('report-cards/:id/comments')
  @Roles(ROLES.TEACHER, ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL, ROLES.SUPER_ADMIN)
  updateComments(@Param('id') id: string, @Body() dto: UpdateCommentsDto, @CurrentUser() user?: RequestUser) {
    return this.reportCardsService.updateComments(id, dto, user!);
  }
}
