import { Controller, Get, Query, Res, StreamableFile } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { PerformanceExportService, PerformanceQuery } from './performance-export.service';

const ALLOWED = [
  ROLES.SYSTEM_ADMIN,
  ROLES.PRINCIPAL,
  ROLES.MANAGER,
  ROLES.HEAD_OF_SCHOOL,
  ROLES.SUPER_ADMIN,
  ROLES.ACADEMIC_QA,
  ROLES.HEAD_OF_DEPARTMENT,
] as const;

function toQuery(q: Record<string, string | undefined>): PerformanceQuery {
  return {
    examWindowId: q.examWindowId || undefined,
    termId: q.termId || undefined,
    academicYearId: q.academicYearId || undefined,
    classId: q.classId || undefined,
    level: q.level !== undefined && q.level !== '' ? Number(q.level) : undefined,
    educationStage: q.educationStage || undefined,
  };
}

/**
 * Student lists + performance, ranked highest to lowest per stream and per standard.
 * Routes END in the format segment so the gateway streams them as binary downloads.
 */
@ApiTags('Academic - Performance Export')
@Controller('academics/performance-export')
export class PerformanceExportController {
  constructor(private readonly exporter: PerformanceExportService) {}

  @Get('preview')
  @Roles(...ALLOWED)
  preview(@Query() q: Record<string, string | undefined>, @CurrentUser() user: RequestUser) {
    return this.exporter.build(toQuery(q), user);
  }

  @Get('xlsx')
  @Roles(...ALLOWED)
  async xlsx(@Query() q: Record<string, string | undefined>, @CurrentUser() user: RequestUser, @Res({ passthrough: true }) res: Response) {
    const { filename, buffer } = await this.exporter.buildWorkbook(toQuery(q), user);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    return new StreamableFile(buffer);
  }

  @Get('pdf')
  @Roles(...ALLOWED)
  async pdf(@Query() q: Record<string, string | undefined>, @CurrentUser() user: RequestUser, @Res({ passthrough: true }) res: Response) {
    const { filename, buffer } = await this.exporter.buildPdf(toQuery(q), user);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}"` });
    return new StreamableFile(buffer);
  }

  @Get('csv')
  @Roles(...ALLOWED)
  async csv(@Query() q: Record<string, string | undefined>, @CurrentUser() user: RequestUser, @Res({ passthrough: true }) res: Response) {
    const { filename, csv } = await this.exporter.buildCsv(toQuery(q), user);
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"` });
    return new StreamableFile(Buffer.from(csv, 'utf-8'));
  }
}
