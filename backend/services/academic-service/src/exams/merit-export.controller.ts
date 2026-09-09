import { Controller, Get, Param, Query, Res, StreamableFile } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { MeritExportService } from './merit-export.service';

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

@ApiTags('Academic - Merit List Export')
@Controller('academics')
export class MeritExportController {
  constructor(private readonly exporter: MeritExportService) {}

  private filter(classId?: string, level?: string) {
    return { classId, level: level ? Number(level) : undefined };
  }

  @Get('exam-windows/:id/merit-list/xlsx')
  @Roles(...STAFF)
  async xlsx(
    @Param('id') id: string,
    @Query('classId') classId: string | undefined,
    @Query('level') level: string | undefined,
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { filename, buffer } = await this.exporter.buildWorkbook(id, user, this.filter(classId, level));
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    return new StreamableFile(buffer);
  }

  @Get('exam-windows/:id/merit-list/pdf')
  @Roles(...STAFF)
  async pdf(
    @Param('id') id: string,
    @Query('classId') classId: string | undefined,
    @Query('level') level: string | undefined,
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { filename, buffer } = await this.exporter.buildPdf(id, user, this.filter(classId, level));
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    });
    return new StreamableFile(buffer);
  }

  @Get('exam-windows/:id/merit-list/csv')
  @Roles(...STAFF)
  async csv(
    @Param('id') id: string,
    @Query('classId') classId: string | undefined,
    @Query('level') level: string | undefined,
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { filename, csv } = await this.exporter.buildCsv(id, user, this.filter(classId, level));
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    return new StreamableFile(Buffer.from(csv, 'utf-8'));
  }
}
