import { Controller, Get, Param, Patch, Post, Res, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { createReadStream } from 'fs';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { GenerateReportCardsDto } from './dto/generate-report-cards.dto';
import { UpdateCommentsDto } from './dto/update-comments.dto';
import { ReportCardsService } from './report-cards.service';

@ApiTags('Academic - Report Cards')
@Controller('academics')
export class ReportCardsController {
  constructor(
    private readonly reportCardsService: ReportCardsService,
    private readonly configService: ConfigService,
  ) {}

  @Post('report-cards/generate')
  @Roles(ROLES.PRINCIPAL, ROLES.ACADEMIC_QA)
  generate(@Body() dto: GenerateReportCardsDto, @CurrentUser() user?: RequestUser) {
    return this.reportCardsService.generate(dto, user!);
  }

  @Get('report-cards/:studentId/term/:termId')
  @Roles(
    ROLES.SYSTEM_ADMIN,
    ROLES.PRINCIPAL,
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
    ROLES.PRINCIPAL,
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
    const absolutePath = join(storageRoot, fileName);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    return createReadStream(absolutePath).pipe(res);
  }

  @Patch('report-cards/:id/comments')
  @Roles(ROLES.TEACHER, ROLES.PRINCIPAL)
  updateComments(@Param('id') id: string, @Body() dto: UpdateCommentsDto, @CurrentUser() user?: RequestUser) {
    return this.reportCardsService.updateComments(id, dto, user!);
  }
}
