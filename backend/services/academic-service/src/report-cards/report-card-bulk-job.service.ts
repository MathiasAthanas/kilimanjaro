import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { constants, createWriteStream } from 'fs';
import { access, mkdir, readFile, rename, rm, stat, writeFile } from 'fs/promises';
import { resolve, sep } from 'path';
import { PDFDocument } from 'pdf-lib';
const archiver: any = require('archiver');
import { BulkReportCardJob } from '../../generated/prisma';
import { assertSchoolInScope } from '../common/helpers/school-scope.helper';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBulkReportCardJobDto } from './dto/create-bulk-report-card-job.dto';
import { BulkReportCardFile, ReportCardsService } from './report-cards.service';

type ReadyFile = BulkReportCardFile & { absolutePath: string; entryName: string };

@Injectable()
export class ReportCardBulkJobService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReportCardBulkJobService.name);
  private readonly running = new Map<string, Promise<void>>();
  private readonly pending = new Map<string, BulkReportCardFile[] | undefined>();
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly reportCards: ReportCardsService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    setTimeout(() => void this.resumeInterruptedJobs(), 1_000);
    this.cleanupTimer = setInterval(() => void this.cleanupExpiredJobs(), 60 * 60 * 1_000);
    this.cleanupTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  async create(dto: CreateBulkReportCardJobDto, user: RequestUser) {
    this.validateScope(dto);
    const scope = dto.scopeType === 'CLASS'
      ? { classId: dto.classId! }
      : { educationStage: dto.educationStage!, classLevel: dto.classLevel! };
    const selection = await this.reportCards.bulkFiles(scope, dto.termId, dto.examLabel, user);
    const now = new Date();
    const existing = await this.prisma.bulkReportCardJob.findFirst({
      where: {
        requestedById: user.id,
        schoolId: selection.schoolId,
        scopeType: dto.scopeType,
        classId: dto.classId ?? null,
        educationStage: dto.educationStage ?? null,
        classLevel: dto.classLevel ?? null,
        termId: dto.termId,
        examLabel: dto.examLabel?.trim() || null,
        format: dto.format,
        status: { in: ['QUEUED', 'PREPARING', 'READY'] },
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      if (existing.status !== 'READY') this.start(existing.id);
      return this.present(existing);
    }

    const job = await this.prisma.bulkReportCardJob.create({
      data: {
        schoolId: selection.schoolId,
        requestedById: user.id,
        requestedByRole: user.role,
        scopeType: dto.scopeType,
        classId: dto.classId ?? null,
        educationStage: dto.educationStage ?? null,
        classLevel: dto.classLevel ?? null,
        termId: dto.termId,
        examLabel: dto.examLabel?.trim() || null,
        format: dto.format,
        includeClassName: dto.scopeType === 'LEVEL',
        totalFiles: selection.files.length,
        fileName: `${this.safeDownloadName(selection.baseName)}.${dto.format}`,
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1_000),
      },
    });
    this.start(job.id, selection.files);
    return this.present(job);
  }

  async get(jobId: string, user: RequestUser) {
    return this.present(await this.authorizedJob(jobId, user));
  }

  async retry(jobId: string, user: RequestUser) {
    const job = await this.authorizedJob(jobId, user);
    if (!['FAILED', 'EXPIRED'].includes(job.status)) {
      throw new BadRequestException('Only a failed or expired preparation can be retried.');
    }
    const reset = await this.prisma.bulkReportCardJob.update({
      where: { id: job.id },
      data: {
        status: 'QUEUED', stage: 'QUEUED', progress: 0, processedFiles: 0,
        filePath: null, fileSize: null, errorMessage: null, startedAt: null, completedAt: null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000),
      },
    });
    this.start(reset.id);
    return this.present(reset);
  }

  async download(jobId: string, user: RequestUser) {
    const job = await this.authorizedJob(jobId, user);
    if (job.status !== 'READY' || !job.filePath || !job.fileName) {
      throw new BadRequestException('This report-card file is still being prepared.');
    }
    if (job.expiresAt <= new Date()) {
      await this.prisma.bulkReportCardJob.update({ where: { id: job.id }, data: { status: 'EXPIRED', stage: 'EXPIRED' } });
      throw new BadRequestException('This prepared file has expired. Start the preparation again.');
    }
    const absolutePath = this.resolveArtifact(job.filePath);
    try {
      await access(absolutePath, constants.R_OK);
    } catch {
      await this.prisma.bulkReportCardJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', stage: 'FAILED', errorMessage: 'The prepared file is no longer available. Retry the preparation.' },
      });
      throw new NotFoundException('The prepared file is unavailable. Retry the preparation.');
    }
    return { absolutePath, filename: job.fileName, mimeType: job.format === 'zip' ? 'application/zip' : 'application/pdf' };
  }

  private validateScope(dto: CreateBulkReportCardJobDto): void {
    if (dto.scopeType === 'CLASS' && !dto.classId?.trim()) {
      throw new BadRequestException('Select a class before preparing report cards.');
    }
    if (dto.scopeType === 'LEVEL' && (!dto.educationStage?.trim() || !Number.isInteger(dto.classLevel))) {
      throw new BadRequestException('Select a valid education stage and class level.');
    }
  }

  private async authorizedJob(jobId: string, user: RequestUser): Promise<BulkReportCardJob> {
    const job = await this.prisma.bulkReportCardJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Report-card preparation not found.');
    assertSchoolInScope(user, job.schoolId);
    return job;
  }

  private start(jobId: string, files?: BulkReportCardFile[]): void {
    if (this.running.has(jobId) || this.pending.has(jobId)) return;
    this.pending.set(jobId, files);
    this.pump();
  }

  private pump(): void {
    while (this.running.size < 2 && this.pending.size) {
      const next = this.pending.entries().next().value as [string, BulkReportCardFile[] | undefined] | undefined;
      if (!next) return;
      const [jobId, files] = next;
      this.pending.delete(jobId);
      const work = this.run(jobId, files)
        .catch((error) => this.fail(jobId, error))
        .finally(() => {
          this.running.delete(jobId);
          this.pump();
        });
      this.running.set(jobId, work);
    }
  }

  private async run(jobId: string, suppliedFiles?: BulkReportCardFile[]): Promise<void> {
    const job = await this.prisma.bulkReportCardJob.findUnique({ where: { id: jobId } });
    if (!job || job.status === 'READY') return;
    const user: RequestUser = {
      id: job.requestedById,
      role: job.requestedByRole,
      scope: 'SCHOOL',
      schoolIds: [job.schoolId],
      activeSchoolId: job.schoolId,
    };
    const scope = job.scopeType === 'CLASS'
      ? { classId: job.classId! }
      : { educationStage: job.educationStage!, classLevel: job.classLevel! };
    const selection = suppliedFiles
      ? { files: suppliedFiles, baseName: job.fileName?.replace(/\.(pdf|zip)$/i, '') || 'Report_Cards' }
      : await this.reportCards.bulkFiles(scope, job.termId, job.examLabel ?? undefined, user);

    await this.prisma.bulkReportCardJob.update({
      where: { id: job.id },
      data: {
        status: 'PREPARING', stage: 'VALIDATING', progress: 2, processedFiles: 0,
        totalFiles: selection.files.length, errorMessage: null, startedAt: job.startedAt ?? new Date(),
      },
    });
    const ready = await this.readyFiles(job, selection.files);
    const outputDir = resolve(this.storageRoot(), 'bulk-jobs');
    await mkdir(outputDir, { recursive: true });
    const extension = job.format === 'zip' ? 'zip' : 'pdf';
    const relativePath = `bulk-jobs/${job.id}.${extension}`;
    const finalPath = this.resolveArtifact(relativePath);
    const tempPath = `${finalPath}.partial`;
    await rm(tempPath, { force: true });

    await this.updateProgress(job.id, 'BUILDING', 58, ready.length, ready.length);
    if (job.format === 'zip') await this.writeZip(job.id, ready, tempPath);
    else await this.writeCombinedPdf(job.id, ready, tempPath);
    await rename(tempPath, finalPath);
    const details = await stat(finalPath);
    await this.prisma.bulkReportCardJob.update({
      where: { id: job.id },
      data: {
        status: 'READY', stage: 'READY', progress: 100, processedFiles: ready.length,
        totalFiles: ready.length, filePath: relativePath, fileSize: details.size,
        completedAt: new Date(), errorMessage: null,
      },
    });
  }

  private async readyFiles(job: BulkReportCardJob, files: BulkReportCardFile[]): Promise<ReadyFile[]> {
    const root = this.storageRoot();
    const ready: ReadyFile[] = [];
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const absolutePath = resolve(root, file.pdfUrl);
      if (absolutePath !== root && !absolutePath.startsWith(`${root}${sep}`)) {
        throw new BadRequestException('A report-card file path is invalid.');
      }
      try {
        await access(absolutePath, constants.R_OK);
      } catch {
        throw new NotFoundException(`Report card ${index + 1} is unavailable. Recalculate the report cards and retry.`);
      }
      const identity = file.registrationNumber || file.studentId;
      const nameParts = [
        ...(job.includeClassName ? [file.className] : []),
        file.studentName,
        identity,
      ].map((part) => this.safeArchivePart(part));
      ready.push({ ...file, absolutePath, entryName: `${nameParts.join(' - ')}.pdf` });
      await this.updateProgress(job.id, 'VALIDATING', 5 + Math.floor(((index + 1) / files.length) * 48), index + 1, files.length);
    }
    return ready;
  }

  private async writeZip(jobId: string, files: ReadyFile[], outputPath: string): Promise<void> {
    const output = createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 6 } });
    const completed = new Promise<void>((resolveOutput, rejectOutput) => {
      output.on('close', resolveOutput);
      output.on('error', rejectOutput);
      archive.on('warning', (error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') rejectOutput(error);
      });
      archive.on('error', rejectOutput);
    });
    let processed = 0;
    let progressUpdates = Promise.resolve();
    archive.on('entry', () => {
      processed += 1;
      const completedFiles = processed;
      const progress = 58 + Math.floor((completedFiles / Math.max(files.length, 1)) * 39);
      progressUpdates = progressUpdates.then(() => this.updateProgress(jobId, 'COMPRESSING', progress, completedFiles, files.length));
    });
    archive.pipe(output);
    for (const file of files) archive.file(file.absolutePath, { name: file.entryName });
    await archive.finalize();
    await completed;
    await progressUpdates;
  }

  private async writeCombinedPdf(jobId: string, files: ReadyFile[], outputPath: string): Promise<void> {
    const combined = await PDFDocument.create();
    for (let index = 0; index < files.length; index += 1) {
      const source = await PDFDocument.load(await readFile(files[index].absolutePath), { ignoreEncryption: true });
      const pages = await combined.copyPages(source, source.getPageIndices());
      for (const page of pages) combined.addPage(page);
      await this.updateProgress(jobId, 'COMBINING', 58 + Math.floor(((index + 1) / files.length) * 38), index + 1, files.length);
    }
    const bytes = await combined.save({ useObjectStreams: true });
    await writeFile(outputPath, Buffer.from(bytes));
  }

  private async updateProgress(jobId: string, stage: string, progress: number, processedFiles: number, totalFiles: number): Promise<void> {
    await this.prisma.bulkReportCardJob.update({
      where: { id: jobId },
      data: { stage, progress: Math.min(99, progress), processedFiles, totalFiles },
    });
  }

  private async fail(jobId: string, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : 'The report-card preparation failed.';
    this.logger.error(`Bulk report-card job ${jobId} failed: ${message}`, error instanceof Error ? error.stack : undefined);
    await this.prisma.bulkReportCardJob.update({
      where: { id: jobId },
      data: { status: 'FAILED', stage: 'FAILED', errorMessage: message.slice(0, 1_000), completedAt: new Date() },
    }).catch(() => undefined);
  }

  private async resumeInterruptedJobs(): Promise<void> {
    await this.cleanupExpiredJobs();
    const now = new Date();
    const interrupted = await this.prisma.bulkReportCardJob.findMany({
      where: { status: { in: ['QUEUED', 'PREPARING'] }, expiresAt: { gt: now } },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });
    for (const job of interrupted) {
      await this.prisma.bulkReportCardJob.update({
        where: { id: job.id },
        data: { status: 'QUEUED', stage: 'RESUMING', errorMessage: null },
      });
      this.start(job.id);
    }
  }

  private async cleanupExpiredJobs(): Promise<void> {
    const expired = await this.prisma.bulkReportCardJob.findMany({
      where: { status: { in: ['QUEUED', 'PREPARING', 'READY'] }, expiresAt: { lte: new Date() } },
      select: { id: true, filePath: true },
      take: 100,
    });
    for (const job of expired) {
      if (job.filePath) await rm(this.resolveArtifact(job.filePath), { force: true }).catch(() => undefined);
    }
    if (expired.length) {
      await this.prisma.bulkReportCardJob.updateMany({
        where: { id: { in: expired.map((job) => job.id) } },
        data: { status: 'EXPIRED', stage: 'EXPIRED', filePath: null, fileSize: null },
      });
    }
  }

  private storageRoot(): string {
    return resolve(this.config.get<string>('PDF_STORAGE_PATH', './storage/report-cards'));
  }

  private resolveArtifact(relativePath: string): string {
    const root = this.storageRoot();
    const absolutePath = resolve(root, relativePath);
    if (absolutePath !== root && !absolutePath.startsWith(`${root}${sep}`)) {
      throw new BadRequestException('The prepared file path is invalid.');
    }
    return absolutePath;
  }

  private safeDownloadName(value: string): string {
    return value.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'Report_Cards';
  }

  private safeArchivePart(value: string): string {
    return value.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Unknown';
  }

  private present(job: BulkReportCardJob) {
    return {
      id: job.id,
      schoolId: job.schoolId,
      scopeType: job.scopeType,
      classId: job.classId,
      educationStage: job.educationStage,
      classLevel: job.classLevel,
      termId: job.termId,
      examLabel: job.examLabel,
      format: job.format,
      status: job.status,
      stage: job.stage,
      progress: job.progress,
      processedFiles: job.processedFiles,
      totalFiles: job.totalFiles,
      filename: job.fileName,
      fileSize: job.fileSize,
      errorMessage: job.errorMessage,
      canRetry: ['FAILED', 'EXPIRED'].includes(job.status),
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      expiresAt: job.expiresAt,
    };
  }
}
