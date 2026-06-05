import {
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { unlink } from 'fs/promises';
import { diskStorage } from 'multer';
import * as path from 'path';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { GatewayUser, UiApiService } from '../ui/ui-api.service';
import { OperationRecord, OperationsStoreService } from './operations-store.service';

const UPLOAD_DIR = process.env.UPLOAD_DIR || '/opt/kilimanjaro/storage/uploads';
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp',
  'application/pdf', 'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const storageOptions = diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req: unknown, file: Express.Multer.File, cb: (e: Error | null, fn: string) => void) => {
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '');
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const fileFilter = (_req: unknown, file: Express.Multer.File, cb: (e: Error | null, ok: boolean) => void) => {
  ALLOWED_MIME.has(file.mimetype)
    ? cb(null, true)
    : cb(new Error(`File type not allowed: ${file.mimetype}`), false);
};

@ApiTags('Files')
@ApiBearerAuth()
@Controller(['files', 'api/v1/files'])
export class UploadController {
  constructor(
    private readonly store: OperationsStoreService,
    private readonly ui: UiApiService,
  ) {}

  /** Upload a file via multipart/form-data — returns {file: {id, url, ...}} */
  @Post('upload')
  @ApiOperation({ summary: 'Upload file (multipart/form-data, field name: file)' })
  @ApiConsumes('multipart/form-data')
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL', 'FINANCE', 'HEAD_OF_DEPARTMENT', 'TEACHER', 'ACADEMIC_QA', 'MANAGING_DIRECTOR')
  @UseInterceptors(FileInterceptor('file', { storage: storageOptions, limits: { fileSize: MAX_FILE_SIZE_BYTES }, fileFilter }))
  uploadFile(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: GatewayUser) {
    if (!file) throw new NotFoundException('No file received — use field name "file"');
    const record = this.store.create('files', {
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      storageKey: `disk://${file.filename}`,
      uploadedById: user.id,
      uploadedByRole: user.role,
      visibility: 'PRIVATE',
      entityType: 'upload',
    }, user) as OperationRecord;
    this.store.appendAudit({ action: 'FILE_UPLOADED', entityType: 'FileObject', entityId: record.id, afterJson: { name: file.originalname, size: file.size, mime: file.mimetype } }, user);
    return this.ui.envelope({ file: { ...record, url: `/api/v1/files/${record.id}/serve` } });
  }

  /** Serve a stored file — streams the actual bytes */
  @Get(':id/serve')
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL', 'FINANCE', 'HEAD_OF_DEPARTMENT', 'TEACHER', 'ACADEMIC_QA', 'PARENT', 'STUDENT')
  async serveFile(@Param('id') id: string, @Res() res: Response, @CurrentUser() user: GatewayUser) {
    const record = this.store.get<OperationRecord>('files', id);
    if (!record) throw new NotFoundException('File not found');
    const storageKey = String(record.storageKey ?? '');
    if (!storageKey.startsWith('disk://')) return res.status(404).json({ success: false, message: 'File not available for streaming' });
    const filename = storageKey.slice(7);
    const filePath = path.join(UPLOAD_DIR, filename);
    if (!existsSync(filePath)) throw new NotFoundException('File missing from storage');
    this.store.appendAudit({ action: 'FILE_SERVED', entityType: 'FileObject', entityId: id }, user);
    res.setHeader('Content-Type', String(record.mimeType ?? 'application/octet-stream'));
    res.setHeader('Content-Disposition', `inline; filename="${String(record.originalName ?? filename)}"`);
    createReadStream(filePath).pipe(res);
  }

  /** Delete a file and remove from disk */
  @Delete(':id')
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL', 'FINANCE')
  async deleteFile(@Param('id') id: string, @CurrentUser() user: GatewayUser) {
    const record = this.store.get<OperationRecord>('files', id);
    if (!record) throw new NotFoundException('File not found');
    const storageKey = String(record.storageKey ?? '');
    if (storageKey.startsWith('disk://')) {
      const fp = path.join(UPLOAD_DIR, storageKey.slice(7));
      if (existsSync(fp)) await unlink(fp);
    }
    this.store.remove('files', id);
    this.store.appendAudit({ action: 'FILE_DELETED', entityType: 'FileObject', entityId: id, beforeJson: record }, user);
    return this.ui.envelope({ deleted: true });
  }
}
