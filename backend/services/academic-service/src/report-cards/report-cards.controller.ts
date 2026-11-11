import { BadRequestException, Controller, Get, Param, Patch, Post, Res, Body, NotFoundException, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { constants } from 'fs';
import { access, readFile } from 'fs/promises';
import { resolve, sep } from 'path';
import { PDFDocument } from 'pdf-lib';
const archiver: any = require('archiver');
import { ConfigService } from '@nestjs/config';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { GenerateReportCardsDto } from './dto/generate-report-cards.dto';
import { UpdateCommentsDto } from './dto/update-comments.dto';
import { BulkReportCardFile, ReportCardsService } from './report-cards.service';
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
    return this.reportCardsService.listForClass(classId, termId, user!);
  }

  @Get('report-cards/bulk/class/:classId/term/:termId')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.SUPER_ADMIN, ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL, ROLES.ACADEMIC_QA)
  async downloadClassCards(
    @Param('classId') classId: string,
    @Param('termId') termId: string,
    @Query('format') format: string | undefined,
    @Query('examLabel') examLabel: string | undefined,
    @CurrentUser() user: RequestUser,
    @Res() res: Response,
  ) {
    const selection = await this.reportCardsService.bulkFiles({ classId }, termId, examLabel, user);
    return this.streamBulkDownload(selection.files, selection.baseName, format, res);
  }

  @Get('report-cards/bulk/level/:educationStage/:classLevel/term/:termId')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.SUPER_ADMIN, ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL, ROLES.ACADEMIC_QA)
  async downloadLevelCards(
    @Param('educationStage') educationStage: string,
    @Param('classLevel') classLevelValue: string,
    @Param('termId') termId: string,
    @Query('format') format: string | undefined,
    @Query('examLabel') examLabel: string | undefined,
    @CurrentUser() user: RequestUser,
    @Res() res: Response,
  ) {
    const classLevel = Number(classLevelValue);
    if (!Number.isInteger(classLevel) || classLevel < 0) {
      throw new BadRequestException('A valid class level is required.');
    }
    const selection = await this.reportCardsService.bulkFiles({ educationStage, classLevel }, termId, examLabel, user);
    return this.streamBulkDownload(selection.files, selection.baseName, format, res);
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

  private safeDownloadName(value: string): string {
    return value.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'Report_Cards';
  }

  private async bulkPaths(files: BulkReportCardFile[]): Promise<Array<BulkReportCardFile & { absolutePath: string; entryName: string }>> {
    const storageRoot = resolve(this.configService.get<string>('PDF_STORAGE_PATH', './storage/report-cards'));
    const results: Array<BulkReportCardFile & { absolutePath: string; entryName: string }> = [];
    for (const [index, file] of files.entries()) {
      const absolutePath = resolve(storageRoot, file.pdfUrl);
      if (absolutePath !== storageRoot && !absolutePath.startsWith(`${storageRoot}${sep}`)) {
        throw new BadRequestException('A report-card file path is invalid.');
      }
      try {
        await access(absolutePath, constants.R_OK);
      } catch {
        throw new NotFoundException(`Report card ${index + 1} is unavailable. Recalculate the report cards and retry.`);
      }
      const identity = file.registrationNumber || file.studentId;
      const entryName = `${String(index + 1).padStart(3, '0')}_${this.safeDownloadName(file.className)}_${this.safeDownloadName(identity)}.pdf`;
      results.push({ ...file, absolutePath, entryName });
    }
    return results;
  }

  private async streamBulkDownload(
    files: BulkReportCardFile[],
    baseName: string,
    requestedFormat: string | undefined,
    res: Response,
  ) {
    const format = (requestedFormat || 'pdf').toLowerCase();
    if (!['pdf', 'zip', 'zip-base64'].includes(format)) {
      throw new BadRequestException('Format must be pdf, zip or zip-base64.');
    }
    const ready = await this.bulkPaths(files);
    const safeBase = this.safeDownloadName(baseName);

    if (format === 'zip-base64') {
      const archive = await this.buildZipBuffer(ready);
      return res.json({
        filename: `${safeBase}.zip`,
        mimeType: 'application/zip',
        reportCardCount: ready.length,
        base64: archive.toString('base64'),
      });
    }

    if (format === 'zip') {
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${safeBase}.zip"`);
      const archive = archiver('zip', { zlib: { level: 6 } });
      archive.on('warning', (error: Error) => {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') res.destroy(error);
      });
      archive.on('error', (error: Error) => res.destroy(error));
      archive.pipe(res);
      for (const file of ready) archive.file(file.absolutePath, { name: file.entryName });
      await archive.finalize();
      return;
    }

    const combined = await PDFDocument.create();
    for (const file of ready) {
      const source = await PDFDocument.load(await readFile(file.absolutePath), { ignoreEncryption: true });
      const pages = await combined.copyPages(source, source.getPageIndices());
      for (const page of pages) combined.addPage(page);
    }
    const bytes = await combined.save({ useObjectStreams: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeBase}.pdf"`);
    res.setHeader('X-Report-Card-Count', String(ready.length));
    return res.send(Buffer.from(bytes));
  }

  private buildZipBuffer(
    files: Array<BulkReportCardFile & { absolutePath: string; entryName: string }>,
  ): Promise<Buffer> {
    return new Promise((resolveArchive, rejectArchive) => {
      const archive = archiver('zip', { zlib: { level: 6 } });
      const chunks: Buffer[] = [];

      archive.on('data', (chunk: Buffer | Uint8Array) => chunks.push(Buffer.from(chunk)));
      archive.on('warning', (error: Error) => {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') rejectArchive(error);
      });
      archive.on('error', rejectArchive);
      archive.on('end', () => resolveArchive(Buffer.concat(chunks)));

      for (const file of files) archive.file(file.absolutePath, { name: file.entryName });
      void archive.finalize().catch(rejectArchive);
    });
  }
}
