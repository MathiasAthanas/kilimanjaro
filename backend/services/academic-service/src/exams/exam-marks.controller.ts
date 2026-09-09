import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { UploadMarksDto } from './dto/upload-marks.dto';
import { ExamMarksService } from './exam-marks.service';

const MARKERS = [
  ROLES.TEACHER,
  ROLES.HEAD_OF_DEPARTMENT,
  ROLES.SYSTEM_ADMIN,
  ROLES.PRINCIPAL,
  ROLES.MANAGER,
  ROLES.HEAD_OF_SCHOOL,
  ROLES.SUPER_ADMIN,
  ROLES.ACADEMIC_QA,
] as const;

@ApiTags('Academic - Exam Marks')
@Controller('academics')
export class ExamMarksController {
  constructor(private readonly examMarks: ExamMarksService) {}

  @Get('exam-windows/assessments/:assessmentId/template')
  @Roles(...MARKERS)
  templateData(@Param('assessmentId') assessmentId: string, @CurrentUser() user: RequestUser) {
    return this.examMarks.getTemplateData(assessmentId, user);
  }

  @Get('exam-windows/assessments/:assessmentId/template/csv')
  @Roles(...MARKERS)
  async templateCsv(
    @Param('assessmentId') assessmentId: string,
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { filename, csv } = await this.examMarks.buildTemplateCsv(assessmentId, user);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    // BOM so Excel opens UTF-8 correctly.
    return new StreamableFile(Buffer.from('﻿' + csv, 'utf-8'));
  }

  @Post('exam-windows/assessments/:assessmentId/marks/upload')
  @Roles(ROLES.TEACHER, ROLES.HEAD_OF_DEPARTMENT)
  upload(
    @Param('assessmentId') assessmentId: string,
    @Body() dto: UploadMarksDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.examMarks.uploadMarks(assessmentId, dto, user);
  }
}
