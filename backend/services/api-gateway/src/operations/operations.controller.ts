import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { GatewayUser, UiApiService, UiEnvelope } from '../ui/ui-api.service';
import { OperationRecord, OperationsStoreService } from './operations-store.service';

const ADMIN = ['SYSTEM_ADMIN'];
const LEADERSHIP = ['SYSTEM_ADMIN', 'PRINCIPAL', 'ACADEMIC_QA', 'HEAD_OF_DEPARTMENT', 'FINANCE'];
const ACADEMIC_LEADERS = ['SYSTEM_ADMIN', 'PRINCIPAL', 'ACADEMIC_QA', 'HEAD_OF_DEPARTMENT'];
const TEACHERS = ['SYSTEM_ADMIN', 'TEACHER', 'HEAD_OF_DEPARTMENT'];

@Controller(['', 'api/v1'])
export class OperationsController {
  constructor(
    private readonly store: OperationsStoreService,
    private readonly ui: UiApiService,
  ) {}

  @Get('admin/system/audit')
  @Roles(...ADMIN)
  systemAudit(@CurrentUser() user: GatewayUser, @Query() query: Record<string, string>): UiEnvelope {
    return this.auditEnvelope(user, query);
  }

  @Get('admin/system/audit/:id')
  @Roles(...ADMIN)
  systemAuditDetail(@Param('id') id: string): UiEnvelope {
    const event = this.store.get('audit-events', id);
    if (!event) throw new NotFoundException('Audit event not found');
    return this.ui.envelope({ event });
  }

  @Get('principal/audit')
  @Roles('PRINCIPAL', 'SYSTEM_ADMIN')
  principalAudit(@CurrentUser() user: GatewayUser, @Query() query: Record<string, string>): UiEnvelope {
    return this.auditEnvelope(user, query);
  }

  @Get('hod/audit')
  @Roles('HEAD_OF_DEPARTMENT', 'SYSTEM_ADMIN')
  hodAudit(@CurrentUser() user: GatewayUser, @Query() query: Record<string, string>): UiEnvelope {
    return this.auditEnvelope(user, query);
  }

  @Get('aqa/audit')
  @Roles('ACADEMIC_QA', 'SYSTEM_ADMIN')
  aqaAudit(@CurrentUser() user: GatewayUser, @Query() query: Record<string, string>): UiEnvelope {
    return this.auditEnvelope(user, query);
  }

  @Get('admin/system/settings')
  @Roles(...ADMIN)
  getSettings(): UiEnvelope {
    return this.ui.envelope({ settings: this.currentSettings(), featureFlags: this.store.list('feature-flags') });
  }

  @Patch('admin/system/settings')
  @Roles(...ADMIN)
  patchSettings(@CurrentUser() user: GatewayUser, @Body() body: Record<string, unknown>): UiEnvelope {
    const before = this.currentSettings();
    const updated = this.store.update('system-settings', 'global', {
      value: { ...before, ...(body.settings || body) },
      updatedById: user.id,
      updatedByRole: user.role,
    });
    this.store.appendAudit({
      action: 'SYSTEM_SETTINGS_UPDATED',
      entityType: 'SystemSetting',
      entityId: 'global',
      beforeJson: before,
      afterJson: updated.value,
    }, user);
    return this.ui.envelope({ settings: updated.value });
  }

  @Get('admin/system/feature-flags')
  @Roles(...ADMIN)
  featureFlags(): UiEnvelope {
    return this.ui.envelope({ featureFlags: this.seedFeatureFlags() });
  }

  @Patch('admin/system/feature-flags/:key')
  @Roles(...ADMIN)
  updateFeatureFlag(@CurrentUser() user: GatewayUser, @Param('key') key: string, @Body() body: Record<string, unknown>): UiEnvelope {
    const flag = this.store.update('feature-flags', key, {
      key,
      enabled: Boolean(body.enabled),
      audienceJson: body.audienceJson || body.audience || {},
      updatedById: user.id,
      updatedByRole: user.role,
    });
    this.store.appendAudit({ action: 'FEATURE_FLAG_UPDATED', entityType: 'FeatureFlag', entityId: key, afterJson: flag }, user);
    return this.ui.envelope({ featureFlag: flag });
  }

  @Post('admin/system/session-reset')
  @Roles(...ADMIN)
  sessionReset(@CurrentUser() user: GatewayUser, @Body() body: Record<string, unknown>): UiEnvelope {
    const event = this.store.appendAudit({
      action: 'GLOBAL_SESSION_RESET_REQUESTED',
      entityType: 'AuthSession',
      metadataJson: { reason: body.reason || 'Admin requested session reset' },
    }, user);
    return this.ui.envelope({ status: 'QUEUED', auditEventId: event.id });
  }

  @Get('admin/system/backups')
  @Roles(...ADMIN)
  backups(): UiEnvelope {
    return this.ui.envelope({ backups: this.store.list('backups') });
  }

  @Post('admin/system/backups')
  @Roles(...ADMIN)
  createBackup(@CurrentUser() user: GatewayUser, @Body() body: Record<string, unknown>): UiEnvelope {
    const backup = this.store.create('backups', {
      type: body.type || 'MANUAL',
      status: 'QUEUED',
      requestedById: user.id,
      requestedByRole: user.role,
      note: body.note,
    }, user);
    this.store.appendAudit({ action: 'BACKUP_REQUESTED', entityType: 'BackupJob', entityId: backup.id, afterJson: backup }, user);
    return this.ui.envelope({ backup });
  }

  @Get('admin/system/health/deep')
  @Roles(...ADMIN)
  async deepHealth(@CurrentUser() user: GatewayUser): Promise<UiEnvelope> {
    const health = await this.ui.collect({
      auth: { service: 'auth', path: '/auth/health', fallback: { status: 'unavailable' } },
      student: { service: 'student', path: '/students/health', fallback: { status: 'unavailable' } },
      academic: { service: 'academic', path: '/academics/health', fallback: { status: 'unavailable' } },
      finance: { service: 'finance', path: '/finance/health', fallback: { status: 'unavailable' } },
      notification: { service: 'notification', path: '/notifications/health', fallback: { status: 'unavailable' } },
      analytics: { service: 'analytics', path: '/analytics/health', fallback: { status: 'unavailable' } },
    }, user);
    return this.ui.envelope({
      services: health.data,
      checks: {
        database: 'service-owned',
        redis: 'gateway-connected',
        rabbitmq: 'optional-degraded-safe',
      },
    }, health.warnings);
  }

  @Post('files')
  @Roles(...LEADERSHIP, 'TEACHER', 'PARENT', 'STUDENT')
  createFile(@CurrentUser() user: GatewayUser, @Body() body: Record<string, unknown>): UiEnvelope {
    const file = this.store.create('files', {
      ownerService: body.ownerService || 'api-gateway',
      entityType: body.entityType || 'general',
      entityId: body.entityId,
      uploadedById: user.id,
      originalName: body.originalName || body.fileName || 'attachment',
      mimeType: body.mimeType || 'application/octet-stream',
      sizeBytes: Number(body.sizeBytes || 0),
      storageKey: body.storageKey || `local://${Date.now()}-${body.originalName || 'attachment'}`,
      checksum: body.checksum,
      visibility: body.visibility || 'PRIVATE',
      metadataJson: body.metadataJson || body.metadata || {},
    }, user);
    this.store.appendAudit({ action: 'FILE_REGISTERED', entityType: 'FileObject', entityId: file.id, afterJson: file }, user);
    return this.ui.envelope({ file });
  }

  @Get('files/:id')
  @Roles(...LEADERSHIP, 'TEACHER', 'PARENT', 'STUDENT')
  getFile(@Param('id') id: string): UiEnvelope {
    const file = this.store.get('files', id);
    if (!file) throw new NotFoundException('File not found');
    return this.ui.envelope({ file });
  }

  @Get('files/:id/download')
  @Roles(...LEADERSHIP, 'TEACHER', 'PARENT', 'STUDENT')
  downloadFile(@CurrentUser() user: GatewayUser, @Param('id') id: string): UiEnvelope {
    const file = this.store.get('files', id);
    if (!file) throw new NotFoundException('File not found');
    this.store.appendAudit({ action: 'FILE_DOWNLOADED', entityType: 'FileObject', entityId: id, metadataJson: { storageKey: file.storageKey } }, user);
    return this.ui.envelope({ file, download: { url: file.storageKey, expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() } });
  }

  @Delete('files/:id')
  @Roles(...LEADERSHIP)
  deleteFile(@CurrentUser() user: GatewayUser, @Param('id') id: string): UiEnvelope {
    const file = this.store.remove('files', id);
    if (!file) throw new NotFoundException('File not found');
    this.store.appendAudit({ action: 'FILE_DELETED', entityType: 'FileObject', entityId: id, beforeJson: file }, user);
    return this.ui.envelope({ deleted: true, file });
  }

  @Post('reports/builder/preview')
  @Roles(...LEADERSHIP)
  reportPreview(@CurrentUser() user: GatewayUser, @Body() body: Record<string, unknown>): UiEnvelope {
    this.store.appendAudit({ action: 'REPORT_PREVIEWED', entityType: 'ReportPreview', metadataJson: body }, user);
    return this.ui.envelope({
      preview: {
        title: body.title || 'Custom report preview',
        columns: body.columns || ['Metric', 'Value', 'Trend'],
        rows: body.rows || [],
        estimatedRows: Array.isArray(body.rows) ? body.rows.length : 0,
      },
    });
  }

  @Post('reports/jobs')
  @Roles(...LEADERSHIP)
  createReportJob(@CurrentUser() user: GatewayUser, @Body() body: Record<string, unknown>): UiEnvelope {
    const job = this.store.create('report-jobs', {
      type: body.type || body.reportType || 'CUSTOM',
      title: body.title || 'Generated report',
      status: 'READY',
      requestedById: user.id,
      requestedByRole: user.role,
      paramsJson: body.paramsJson || body.params || {},
      format: body.format || 'PDF',
      rowCount: body.rowCount || 0,
      completedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }, user);
    this.store.appendAudit({ action: 'REPORT_JOB_CREATED', entityType: 'ReportJob', entityId: job.id, afterJson: job }, user);
    return this.ui.envelope({ job });
  }

  @Get('reports/jobs/:id')
  @Roles(...LEADERSHIP)
  reportJob(@Param('id') id: string): UiEnvelope {
    const job = this.store.get('report-jobs', id);
    if (!job) throw new NotFoundException('Report job not found');
    return this.ui.envelope({ job });
  }

  @Post('reports/jobs/:id/retry')
  @Roles(...LEADERSHIP)
  retryReportJob(@CurrentUser() user: GatewayUser, @Param('id') id: string): UiEnvelope {
    const current = this.store.get('report-jobs', id);
    if (!current) throw new NotFoundException('Report job not found');
    const job = this.store.update('report-jobs', id, { status: 'READY', retriedById: user.id, completedAt: new Date().toISOString() });
    this.store.appendAudit({ action: 'REPORT_JOB_RETRIED', entityType: 'ReportJob', entityId: id, afterJson: job }, user);
    return this.ui.envelope({ job });
  }

  @Get('reports/jobs/:id/download')
  @Roles(...LEADERSHIP)
  reportJobDownload(@CurrentUser() user: GatewayUser, @Param('id') id: string): UiEnvelope {
    const job = this.store.get('report-jobs', id);
    if (!job) throw new NotFoundException('Report job not found');
    this.store.appendAudit({ action: 'REPORT_DOWNLOADED', entityType: 'ReportJob', entityId: id }, user);
    return this.ui.envelope({ job, download: { url: `report://${id}`, expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() } });
  }

  @Get('reports/downloads')
  @Roles(...LEADERSHIP)
  reportDownloads(): UiEnvelope {
    const downloads = this.store.list('report-jobs').filter((job) => job.status === 'READY');
    return this.ui.envelope({ downloads });
  }

  @Post('reports/templates')
  @Roles(...LEADERSHIP)
  createReportTemplate(@CurrentUser() user: GatewayUser, @Body() body: Record<string, unknown>): UiEnvelope {
    const template = this.store.create('report-templates', {
      name: body.name || body.title || 'Untitled template',
      type: body.type || 'CUSTOM',
      paramsJson: body.paramsJson || body.params || {},
      allowedRolesJson: body.allowedRolesJson || body.allowedRoles || LEADERSHIP,
      createdById: user.id,
    }, user);
    return this.ui.envelope({ template });
  }

  @Post('reports/scheduled')
  @Roles(...LEADERSHIP)
  createScheduledReport(@CurrentUser() user: GatewayUser, @Body() body: Record<string, unknown>): UiEnvelope {
    const scheduled = this.store.create('scheduled-reports', {
      templateId: body.templateId,
      cron: body.cron || '0 6 * * 1',
      recipientsJson: body.recipientsJson || body.recipients || [],
      enabled: body.enabled !== false,
      nextRunAt: body.nextRunAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      createdById: user.id,
    }, user);
    return this.ui.envelope({ scheduledReport: scheduled });
  }

  @Patch('reports/templates/:id')
  @Roles(...LEADERSHIP)
  updateReportTemplate(@Param('id') id: string, @Body() body: Record<string, unknown>): UiEnvelope {
    return this.ui.envelope({ template: this.store.update('report-templates', id, body) });
  }

  @Delete('reports/templates/:id')
  @Roles(...LEADERSHIP)
  deleteReportTemplate(@Param('id') id: string): UiEnvelope {
    return this.ui.envelope({ deleted: Boolean(this.store.remove('report-templates', id)) });
  }

  @Patch('reports/scheduled/:id')
  @Roles(...LEADERSHIP)
  updateScheduledReport(@Param('id') id: string, @Body() body: Record<string, unknown>): UiEnvelope {
    return this.ui.envelope({ scheduledReport: this.store.update('scheduled-reports', id, body) });
  }

  @Delete('reports/scheduled/:id')
  @Roles(...LEADERSHIP)
  deleteScheduledReport(@Param('id') id: string): UiEnvelope {
    return this.ui.envelope({ deleted: Boolean(this.store.remove('scheduled-reports', id)) });
  }

  @Post('finance/payments/:id/evidence')
  @Roles('FINANCE', 'PRINCIPAL', 'SYSTEM_ADMIN')
  paymentEvidence(@CurrentUser() user: GatewayUser, @Param('id') id: string, @Body() body: Record<string, unknown>): UiEnvelope {
    const evidence = this.store.create('payment-evidence', {
      paymentId: id,
      fileObjectId: body.fileObjectId,
      note: body.note,
      status: 'SUBMITTED',
      submittedById: user.id,
      submittedByRole: user.role,
      metadataJson: body.metadataJson || body.metadata || {},
    }, user);
    this.store.appendAudit({ action: 'PAYMENT_EVIDENCE_SUBMITTED', entityType: 'Payment', entityId: id, afterJson: evidence }, user);
    return this.ui.envelope({ evidence });
  }

  @Get('finance/payments/:id/evidence')
  @Roles('FINANCE', 'PRINCIPAL', 'SYSTEM_ADMIN')
  paymentEvidenceList(@Param('id') id: string): UiEnvelope {
    return this.ui.envelope({ evidence: this.store.list('payment-evidence').filter((item) => item.paymentId === id) });
  }

  @Get('finance/reconciliation/cash-drawers')
  @Roles('FINANCE', 'PRINCIPAL', 'SYSTEM_ADMIN')
  cashDrawers(): UiEnvelope {
    return this.ui.envelope({ cashDrawers: this.store.list('cash-drawers') });
  }

  @Post('finance/reconciliation/cash-drawers/open')
  @Roles('FINANCE', 'SYSTEM_ADMIN')
  openCashDrawer(@CurrentUser() user: GatewayUser, @Body() body: Record<string, unknown>): UiEnvelope {
    const drawer = this.store.create('cash-drawers', {
      status: 'OPEN',
      openedById: user.id,
      openingFloat: Number(body.openingFloat || 0),
      openedAt: new Date().toISOString(),
      note: body.note,
    }, user);
    this.store.appendAudit({ action: 'CASH_DRAWER_OPENED', entityType: 'CashDrawerSession', entityId: drawer.id, afterJson: drawer }, user);
    return this.ui.envelope({ cashDrawer: drawer });
  }

  @Post('finance/reconciliation/cash-drawers/:id/close')
  @Roles('FINANCE', 'SYSTEM_ADMIN')
  closeCashDrawer(@CurrentUser() user: GatewayUser, @Param('id') id: string, @Body() body: Record<string, unknown>): UiEnvelope {
    const expectedCash = Number(body.expectedCash || 0);
    const countedCash = Number(body.countedCash || 0);
    const drawer = this.store.update('cash-drawers', id, {
      status: 'CLOSED',
      closedById: user.id,
      expectedCash,
      countedCash,
      variance: countedCash - expectedCash,
      closedAt: new Date().toISOString(),
      closeNote: body.note,
    });
    this.store.appendAudit({ action: 'CASH_DRAWER_CLOSED', entityType: 'CashDrawerSession', entityId: id, afterJson: drawer }, user);
    return this.ui.envelope({ cashDrawer: drawer });
  }

  @Post('finance/reconciliation/bank-statements/import')
  @Roles('FINANCE', 'SYSTEM_ADMIN')
  importBankStatement(@CurrentUser() user: GatewayUser, @Body() body: Record<string, unknown>): UiEnvelope {
    const statement = this.store.create('bank-statement-imports', {
      fileObjectId: body.fileObjectId,
      status: 'IMPORTED',
      totalRows: Number(body.totalRows || 0),
      matchedRows: Number(body.matchedRows || 0),
      importedById: user.id,
      metadataJson: body.metadataJson || {},
    }, user);
    this.store.appendAudit({ action: 'BANK_STATEMENT_IMPORTED', entityType: 'BankStatementImport', entityId: statement.id, afterJson: statement }, user);
    return this.ui.envelope({ bankStatementImport: statement });
  }

  @Get('finance/reconciliation/matches')
  @Roles('FINANCE', 'PRINCIPAL', 'SYSTEM_ADMIN')
  reconciliationMatches(): UiEnvelope {
    return this.ui.envelope({ matches: this.store.list('bank-reconciliation-matches') });
  }

  @Patch('finance/reconciliation/matches/:id/confirm')
  @Roles('FINANCE', 'SYSTEM_ADMIN')
  confirmReconciliationMatch(@CurrentUser() user: GatewayUser, @Param('id') id: string, @Body() body: Record<string, unknown>): UiEnvelope {
    const match = this.store.update('bank-reconciliation-matches', id, {
      status: 'CONFIRMED',
      confirmedById: user.id,
      confirmedAt: new Date().toISOString(),
      note: body.note,
    });
    this.store.appendAudit({ action: 'BANK_RECONCILIATION_CONFIRMED', entityType: 'BankReconciliationMatch', entityId: id, afterJson: match }, user);
    return this.ui.envelope({ match });
  }

  @Get('finance/assets/:id/maintenance')
  @Roles('FINANCE', 'PRINCIPAL', 'SYSTEM_ADMIN')
  assetMaintenance(@Param('id') id: string): UiEnvelope {
    return this.ui.envelope({ events: this.store.list('asset-maintenance').filter((item) => item.assetId === id) });
  }

  @Post('finance/assets/:id/maintenance')
  @Roles('FINANCE', 'SYSTEM_ADMIN')
  createAssetMaintenance(@CurrentUser() user: GatewayUser, @Param('id') id: string, @Body() body: Record<string, unknown>): UiEnvelope {
    const event = this.store.create('asset-maintenance', {
      assetId: id,
      type: body.type || 'MAINTENANCE',
      cost: Number(body.cost || 0),
      note: body.note,
      performedAt: body.performedAt || new Date().toISOString(),
      createdById: user.id,
    }, user);
    this.store.appendAudit({ action: 'ASSET_MAINTENANCE_RECORDED', entityType: 'Asset', entityId: id, afterJson: event }, user);
    return this.ui.envelope({ event });
  }

  @Post('finance/assets/:id/photos')
  @Roles('FINANCE', 'SYSTEM_ADMIN')
  assetPhoto(@CurrentUser() user: GatewayUser, @Param('id') id: string, @Body() body: Record<string, unknown>): UiEnvelope {
    const photo = this.store.create('asset-photos', {
      assetId: id,
      fileObjectId: body.fileObjectId,
      caption: body.caption,
      uploadedById: user.id,
    }, user);
    this.store.appendAudit({ action: 'ASSET_PHOTO_ATTACHED', entityType: 'Asset', entityId: id, afterJson: photo }, user);
    return this.ui.envelope({ photo });
  }

  @Post('finance/fee-defaulters/notify')
  @Roles('FINANCE', 'PRINCIPAL', 'SYSTEM_ADMIN')
  notifyFeeDefaulters(@CurrentUser() user: GatewayUser, @Body() body: Record<string, unknown>): UiEnvelope {
    const job = this.store.create('notification-jobs', {
      type: 'FEE_DEFAULTERS',
      status: 'QUEUED',
      requestedById: user.id,
      filtersJson: body.filtersJson || body.filters || {},
      channel: body.channel || 'SMS',
    }, user);
    this.store.appendAudit({ action: 'FEE_DEFAULTERS_NOTIFICATION_QUEUED', entityType: 'NotificationJob', entityId: job.id, afterJson: job }, user);
    return this.ui.envelope({ job });
  }

  @Post('academics/marks/import/validate')
  @Roles(...TEACHERS)
  validateMarksImport(@Body() body: Record<string, unknown>): UiEnvelope {
    const rows = Array.isArray(body.rows) ? body.rows : [];
    const errors = rows.flatMap((row, index) => {
      const item = row as Record<string, unknown>;
      return item.studentId && item.score !== undefined ? [] : [{ row: index + 1, message: 'studentId and score are required' }];
    });
    return this.ui.envelope({ valid: errors.length === 0, totalRows: rows.length, errors });
  }

  @Post('academics/marks/import/commit')
  @Roles(...TEACHERS)
  commitMarksImport(@CurrentUser() user: GatewayUser, @Body() body: Record<string, unknown>): UiEnvelope {
    const job = this.store.create('marks-imports', {
      assessmentId: body.assessmentId,
      status: 'COMMITTED',
      rowCount: Array.isArray(body.rows) ? body.rows.length : 0,
      committedById: user.id,
    }, user);
    this.store.appendAudit({ action: 'MARKS_IMPORT_COMMITTED', entityType: 'Assessment', entityId: String(body.assessmentId || ''), afterJson: job }, user);
    return this.ui.envelope({ importJob: job });
  }

  @Get('academics/assessments/:id/marks/versions')
  @Roles(...TEACHERS, 'PRINCIPAL', 'ACADEMIC_QA')
  marksVersions(@Param('id') id: string): UiEnvelope {
    return this.ui.envelope({ assessmentId: id, versions: this.store.list('marks-autosaves').filter((item) => item.assessmentId === id) });
  }

  @Post('academics/assessments/:id/marks/autosave')
  @Roles(...TEACHERS)
  marksAutosave(@CurrentUser() user: GatewayUser, @Param('id') id: string, @Body() body: Record<string, unknown>): UiEnvelope {
    const autosave = this.store.create('marks-autosaves', {
      assessmentId: id,
      rows: body.rows || [],
      version: body.version || Date.now(),
      savedById: user.id,
      conflictCount: 0,
    }, user);
    return this.ui.envelope({ autosave });
  }

  @Patch('principal/approvals/marks/:assessmentId/lock')
  @Roles('PRINCIPAL', 'SYSTEM_ADMIN')
  lockMarks(@CurrentUser() user: GatewayUser, @Param('assessmentId') assessmentId: string, @Body() body: Record<string, unknown>): UiEnvelope {
    const lock = this.store.update('principal-mark-locks', assessmentId, {
      assessmentId,
      status: 'LOCKED',
      lockedById: user.id,
      reason: body.reason,
      lockedAt: new Date().toISOString(),
    });
    this.store.appendAudit({ action: 'MARKS_LOCKED', entityType: 'Assessment', entityId: assessmentId, afterJson: lock }, user);
    return this.ui.envelope({ lock });
  }

  @Patch('principal/approvals/marks/:assessmentId/return')
  @Roles('PRINCIPAL', 'SYSTEM_ADMIN')
  returnMarks(@CurrentUser() user: GatewayUser, @Param('assessmentId') assessmentId: string, @Body() body: Record<string, unknown>): UiEnvelope {
    const returned = this.store.update('principal-mark-locks', assessmentId, {
      assessmentId,
      status: 'RETURNED',
      returnedById: user.id,
      reason: body.reason,
      returnedAt: new Date().toISOString(),
    });
    this.store.appendAudit({ action: 'MARKS_RETURNED', entityType: 'Assessment', entityId: assessmentId, afterJson: returned }, user);
    return this.ui.envelope({ returned });
  }

  @Get('academics/report-cards/jobs/:jobId')
  @Roles(...ACADEMIC_LEADERS)
  reportCardJob(@Param('jobId') jobId: string): UiEnvelope {
    const job = this.store.get('report-card-jobs', jobId) || this.store.update('report-card-jobs', jobId, { status: 'UNKNOWN', jobId });
    return this.ui.envelope({ job });
  }

  @Post('principal/report-cards/batch-comment')
  @Roles('PRINCIPAL', 'SYSTEM_ADMIN')
  batchCommentReportCards(@CurrentUser() user: GatewayUser, @Body() body: Record<string, unknown>): UiEnvelope {
    const event = this.store.create('report-card-comments', {
      scope: 'BATCH',
      reportCardIds: body.reportCardIds || [],
      comment: body.comment,
      commentedById: user.id,
    }, user);
    return this.ui.envelope({ commentBatch: event });
  }

  @Post('principal/report-cards/:id/sign')
  @Roles('PRINCIPAL', 'SYSTEM_ADMIN')
  signReportCard(@CurrentUser() user: GatewayUser, @Param('id') id: string, @Body() body: Record<string, unknown>): UiEnvelope {
    const signature = this.store.update('report-card-signatures', id, {
      reportCardId: id,
      signedById: user.id,
      signatureText: body.signatureText || 'Approved',
      signedAt: new Date().toISOString(),
    });
    this.store.appendAudit({ action: 'REPORT_CARD_SIGNED', entityType: 'ReportCard', entityId: id, afterJson: signature }, user);
    return this.ui.envelope({ signature });
  }

  @Post('academics/timetables/validate-conflicts')
  @Roles(...ACADEMIC_LEADERS)
  validateTimetableConflicts(@Body() body: Record<string, unknown>): UiEnvelope {
    const entries = Array.isArray(body.entries) ? body.entries as Record<string, unknown>[] : [];
    const seen = new Set<string>();
    const conflicts: Array<Record<string, unknown>> = [];
    for (const entry of entries) {
      const key = `${entry.dayOfWeek}-${entry.periodNumber}-${entry.teacherId || entry.classId}`;
      if (seen.has(key)) conflicts.push({ key, entry, message: 'Duplicate teacher/class period allocation' });
      seen.add(key);
    }
    return this.ui.envelope({ valid: conflicts.length === 0, conflicts });
  }

  @Post('students/attendance/sessions')
  @Roles(...TEACHERS)
  attendanceSession(@CurrentUser() user: GatewayUser, @Body() body: Record<string, unknown>): UiEnvelope {
    const session = this.store.create('attendance-sessions', {
      classId: body.classId,
      subjectId: body.subjectId,
      date: body.date || new Date().toISOString().slice(0, 10),
      status: 'OPEN',
      openedById: user.id,
      records: body.records || [],
    }, user);
    return this.ui.envelope({ session });
  }

  @Patch('students/attendance/sessions/:id')
  @Roles(...TEACHERS)
  updateAttendanceSession(@Param('id') id: string, @Body() body: Record<string, unknown>): UiEnvelope {
    return this.ui.envelope({ session: this.store.update('attendance-sessions', id, body) });
  }

  @Post('students/attendance/sessions/:id/submit')
  @Roles(...TEACHERS)
  submitAttendanceSession(@CurrentUser() user: GatewayUser, @Param('id') id: string, @Body() body: Record<string, unknown>): UiEnvelope {
    const session = this.store.update('attendance-sessions', id, {
      status: 'SUBMITTED',
      submittedById: user.id,
      submittedAt: new Date().toISOString(),
      records: body.records,
    });
    this.store.appendAudit({ action: 'ATTENDANCE_SESSION_SUBMITTED', entityType: 'AttendanceSession', entityId: id, afterJson: session }, user);
    return this.ui.envelope({ session });
  }

  @Delete('notifications/:id')
  @Roles(...LEADERSHIP, 'TEACHER', 'PARENT', 'STUDENT')
  archiveNotification(@CurrentUser() user: GatewayUser, @Param('id') id: string): UiEnvelope {
    const archived = this.store.update('notification-archive', id, {
      notificationId: id,
      archivedById: user.id,
      archivedAt: new Date().toISOString(),
    });
    return this.ui.envelope({ archived });
  }

  @Post('notifications/logs/:id/retry')
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL')
  retryNotification(@CurrentUser() user: GatewayUser, @Param('id') id: string): UiEnvelope {
    const retry = this.store.create('notification-retries', {
      logId: id,
      status: 'QUEUED',
      requestedById: user.id,
    }, user);
    this.store.appendAudit({ action: 'NOTIFICATION_RETRY_QUEUED', entityType: 'NotificationLog', entityId: id, afterJson: retry }, user);
    return this.ui.envelope({ retry });
  }

  @Get('notifications/providers/health')
  @Roles(...LEADERSHIP)
  notificationProviderHealth(): UiEnvelope {
    return this.ui.envelope({
      providers: [
        { id: 'in-app', status: 'healthy', latencyMs: 5 },
        { id: 'email', status: 'configured', latencyMs: null },
        { id: 'sms', status: 'configured', latencyMs: null },
      ],
    });
  }

  @Post('notifications/templates/:id/test-send')
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL')
  testSendTemplate(@CurrentUser() user: GatewayUser, @Param('id') id: string, @Body() body: Record<string, unknown>): UiEnvelope {
    const job = this.store.create('notification-template-tests', {
      templateId: id,
      recipient: body.recipient,
      channel: body.channel || 'EMAIL',
      status: 'QUEUED',
      requestedById: user.id,
    }, user);
    return this.ui.envelope({ testSend: job });
  }

  @Get('notifications/templates/:id/versions')
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL')
  templateVersions(@Param('id') id: string): UiEnvelope {
    return this.ui.envelope({ versions: this.store.list('notification-template-versions').filter((item) => item.templateId === id) });
  }

  @Post('notifications/announcements/audience-preview')
  @Roles(...LEADERSHIP, 'TEACHER')
  async audiencePreview(@CurrentUser() user: GatewayUser, @Body() body: Record<string, unknown>): Promise<UiEnvelope> {
    const roles = Array.isArray(body.roles) ? body.roles.join(',') : String(body.roles || 'TEACHER,HEAD_OF_DEPARTMENT,PARENT,STUDENT');
    const users = await this.ui.tryGet(
      { service: 'auth', path: '/auth/internal/users-by-role', params: { roles } },
      [],
      user,
    );
    return this.ui.envelope({
      roles: roles.split(','),
      count: this.ui.asArray(users.data).length,
      sample: this.ui.asArray(users.data).slice(0, 10),
    }, this.warning(users));
  }

  @Get('teacher/classes/:classSubjectId/analytics')
  @Roles(...TEACHERS)
  async teacherClassAnalytics(@CurrentUser() user: GatewayUser, @Param('classSubjectId') classSubjectId: string): Promise<UiEnvelope> {
    const { data, warnings } = await this.ui.collect({
      classSubjects: { service: 'academic', path: '/academics/class-subjects', fallback: [] },
      alerts: { service: 'academic', path: '/academics/performance/alerts', fallback: [] },
      assessments: { service: 'academic', path: '/academics/assessments', fallback: [] },
    }, user);
    return this.ui.envelope({ classSubjectId, ...data }, warnings);
  }

  @Get('hod/teachers/performance')
  @Roles('HEAD_OF_DEPARTMENT', 'SYSTEM_ADMIN')
  async hodTeacherPerformance(@CurrentUser() user: GatewayUser): Promise<UiEnvelope> {
    const result = await this.ui.tryGet({ service: 'analytics', path: '/analytics/academic/overview' }, null, user);
    return this.ui.envelope({ teachers: [], overview: result.data }, this.warning(result));
  }

  @Get('hod/teachers/:teacherId/performance')
  @Roles('HEAD_OF_DEPARTMENT', 'SYSTEM_ADMIN')
  async hodTeacherDetail(@CurrentUser() user: GatewayUser, @Param('teacherId') teacherId: string): Promise<UiEnvelope> {
    const result = await this.ui.tryGet({ service: 'analytics', path: `/analytics/academic/teacher/${teacherId}` }, null, user);
    return this.ui.envelope({ teacherId, performance: result.data }, this.warning(result));
  }

  @Get('aqa/performance/engine/runs')
  @Roles('ACADEMIC_QA', 'PRINCIPAL', 'SYSTEM_ADMIN')
  engineRuns(): UiEnvelope {
    return this.ui.envelope({ runs: this.store.list('engine-runs') });
  }

  @Get('aqa/performance/engine/runs/:id')
  @Roles('ACADEMIC_QA', 'PRINCIPAL', 'SYSTEM_ADMIN')
  engineRun(@Param('id') id: string): UiEnvelope {
    const run = this.store.get('engine-runs', id);
    if (!run) throw new NotFoundException('Engine run not found');
    return this.ui.envelope({ run });
  }

  @Get('aqa/analytics/heatmap')
  @Roles('ACADEMIC_QA', 'PRINCIPAL', 'SYSTEM_ADMIN')
  async aqaHeatmap(@CurrentUser() user: GatewayUser): Promise<UiEnvelope> {
    const { data, warnings } = await this.ui.collect({
      academic: { service: 'analytics', path: '/analytics/academic/overview', fallback: null },
      atRisk: { service: 'analytics', path: '/analytics/students/at-risk', fallback: [] },
      topPerformers: { service: 'analytics', path: '/analytics/students/top-performers', fallback: [] },
    }, user);
    return this.ui.envelope({ heatmap: data }, warnings);
  }

  @Get('principal/staff')
  @Roles('PRINCIPAL', 'SYSTEM_ADMIN')
  async principalStaff(@CurrentUser() user: GatewayUser): Promise<UiEnvelope> {
    const result = await this.ui.tryGet(
      { service: 'auth', path: '/auth/internal/users-by-role', params: { roles: 'TEACHER,HEAD_OF_DEPARTMENT,FINANCE,ACADEMIC_QA' } },
      [],
      user,
    );
    return this.ui.envelope({ staff: this.ui.asArray(result.data), raw: result.data }, this.warning(result));
  }

  @Get('principal/students/:studentId/profile')
  @Roles('PRINCIPAL', 'SYSTEM_ADMIN')
  async principalStudentProfile(@CurrentUser() user: GatewayUser, @Param('studentId') studentId: string): Promise<UiEnvelope> {
    const { data, warnings } = await this.ui.collect({
      profile: { service: 'student', path: `/students/${studentId}`, fallback: null },
      attendance: { service: 'student', path: `/students/attendance/summary/${studentId}`, fallback: null },
      performance: { service: 'academic', path: `/academics/performance/student/${studentId}`, fallback: null },
      finance: { service: 'finance', path: `/finance/invoices/student/${studentId}`, fallback: [] },
      discipline: { service: 'student', path: `/students/discipline/${studentId}`, fallback: [] },
    }, user);
    return this.ui.envelope({ studentId, ...data }, warnings);
  }

  @Get('principal/settings/school')
  @Roles('PRINCIPAL', 'SYSTEM_ADMIN')
  schoolSettings(): UiEnvelope {
    return this.ui.envelope({ settings: this.currentSettings().school });
  }

  @Patch('principal/settings/school')
  @Roles('PRINCIPAL', 'SYSTEM_ADMIN')
  patchSchoolSettings(@CurrentUser() user: GatewayUser, @Body() body: Record<string, unknown>): UiEnvelope {
    const current = this.currentSettings();
    const settings = { ...current, school: { ...(current.school as Record<string, unknown>), ...body } };
    this.store.update('system-settings', 'global', { value: settings, updatedById: user.id });
    this.store.appendAudit({ action: 'SCHOOL_SETTINGS_UPDATED', entityType: 'SchoolSetting', entityId: 'school', afterJson: settings.school }, user);
    return this.ui.envelope({ settings: settings.school });
  }

  @Post(':role(teacher|hod|aqa|principal)/exports')
  @Roles(...LEADERSHIP, 'TEACHER')
  roleExport(@CurrentUser() user: GatewayUser, @Param('role') role: string, @Body() body: Record<string, unknown>): UiEnvelope {
    const job = this.store.create('report-jobs', {
      type: `${role.toUpperCase()}_EXPORT`,
      title: body.title || `${role} export`,
      status: 'READY',
      requestedById: user.id,
      requestedByRole: user.role,
      paramsJson: body,
      format: body.format || 'XLSX',
      completedAt: new Date().toISOString(),
    }, user);
    return this.ui.envelope({ export: job });
  }

  @Get(':role(teacher|hod|aqa|principal)/exports/:id/download')
  @Roles(...LEADERSHIP, 'TEACHER')
  roleExportDownload(@CurrentUser() user: GatewayUser, @Param('id') id: string): UiEnvelope {
    return this.reportJobDownload(user, id);
  }

  @Get('mobile/teacher/dashboard')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  async mobileTeacherDashboard(@CurrentUser() user: GatewayUser): Promise<UiEnvelope> {
    const { data, warnings } = await this.ui.collect({
      assessments: { service: 'academic', path: '/academics/assessments', params: { teacherId: user.id }, fallback: [] },
      timetable: { service: 'academic', path: '/academics/timetables', params: { teacherId: user.id }, fallback: [] },
      alerts: { service: 'academic', path: '/academics/performance/alerts', fallback: [] },
    }, user);
    return this.ui.envelope({ userId: user.id, compact: true, ...data }, warnings);
  }

  @Get('mobile/teacher/today')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  async mobileTeacherToday(@CurrentUser() user: GatewayUser): Promise<UiEnvelope> {
    const result = await this.ui.tryGet({ service: 'academic', path: '/academics/timetables', params: { teacherId: user.id } }, [], user);
    return this.ui.envelope({ today: new Date().toISOString().slice(0, 10), timetable: result.data }, this.warning(result));
  }

  @Get('mobile/teacher/assessments')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  async mobileTeacherAssessments(@CurrentUser() user: GatewayUser): Promise<UiEnvelope> {
    const result = await this.ui.tryGet({ service: 'academic', path: '/academics/assessments', params: { teacherId: user.id } }, [], user);
    return this.ui.envelope({ assessments: this.ui.asArray(result.data), raw: result.data }, this.warning(result));
  }

  @Get('mobile/teacher/attendance/today')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  mobileTeacherAttendanceToday(@CurrentUser() user: GatewayUser): UiEnvelope {
    const sessions = this.store.list('attendance-sessions').filter((item) => item.openedById === user.id);
    return this.ui.envelope({ sessions });
  }

  @Post('mobile/teacher/attendance')
  @Roles('TEACHER', 'SYSTEM_ADMIN')
  mobileTeacherAttendance(@CurrentUser() user: GatewayUser, @Body() body: Record<string, unknown>): UiEnvelope {
    return this.attendanceSession(user, body);
  }

  @Get('mobile/hod/dashboard')
  @Roles('HEAD_OF_DEPARTMENT', 'SYSTEM_ADMIN')
  async mobileHodDashboard(@CurrentUser() user: GatewayUser): Promise<UiEnvelope> {
    const { data, warnings } = await this.ui.collect({
      approvals: { service: 'academic', path: '/academics/assessments/pending-approval', fallback: [] },
      alerts: { service: 'academic', path: '/academics/performance/alerts', fallback: [] },
    }, user);
    return this.ui.envelope({ userId: user.id, compact: true, ...data }, warnings);
  }

  @Get('mobile/hod/approvals')
  @Roles('HEAD_OF_DEPARTMENT', 'SYSTEM_ADMIN')
  async mobileHodApprovals(@CurrentUser() user: GatewayUser): Promise<UiEnvelope> {
    const result = await this.ui.tryGet({ service: 'academic', path: '/academics/assessments/pending-approval' }, [], user);
    return this.ui.envelope({ approvals: this.ui.asArray(result.data), raw: result.data }, this.warning(result));
  }

  @Get('mobile/hod/approvals/:assessmentId')
  @Roles('HEAD_OF_DEPARTMENT', 'SYSTEM_ADMIN')
  async mobileHodApproval(@CurrentUser() user: GatewayUser, @Param('assessmentId') assessmentId: string): Promise<UiEnvelope> {
    const result = await this.ui.tryGet({ service: 'academic', path: `/academics/assessments/${assessmentId}/marks/review` }, null, user);
    return this.ui.envelope({ assessmentId, review: result.data }, this.warning(result));
  }

  @Patch('mobile/hod/approvals/:assessmentId/approve')
  @Roles('HEAD_OF_DEPARTMENT', 'SYSTEM_ADMIN')
  mobileHodApprove(@CurrentUser() user: GatewayUser, @Param('assessmentId') assessmentId: string, @Body() body: Record<string, unknown>): UiEnvelope {
    const approval = this.store.create('mobile-hod-decisions', {
      assessmentId,
      decision: 'APPROVED',
      note: body.note,
      decidedById: user.id,
    }, user);
    this.store.appendAudit({ action: 'MOBILE_HOD_MARKS_APPROVED', entityType: 'Assessment', entityId: assessmentId, afterJson: approval }, user);
    return this.ui.envelope({ approval });
  }

  @Patch('mobile/hod/approvals/:assessmentId/reject')
  @Roles('HEAD_OF_DEPARTMENT', 'SYSTEM_ADMIN')
  mobileHodReject(@CurrentUser() user: GatewayUser, @Param('assessmentId') assessmentId: string, @Body() body: Record<string, unknown>): UiEnvelope {
    const rejection = this.store.create('mobile-hod-decisions', {
      assessmentId,
      decision: 'REJECTED',
      reason: body.reason,
      decidedById: user.id,
    }, user);
    this.store.appendAudit({ action: 'MOBILE_HOD_MARKS_REJECTED', entityType: 'Assessment', entityId: assessmentId, afterJson: rejection }, user);
    return this.ui.envelope({ rejection });
  }

  private auditEnvelope(user: GatewayUser, query: Record<string, string>): UiEnvelope {
    let events = this.store.list('audit-events');
    if (query.action) events = events.filter((event) => event.action === query.action);
    if (query.actorId) events = events.filter((event) => event.actorId === query.actorId);
    return this.ui.envelope({ events, actor: { id: user.id, role: user.role } });
  }

  private currentSettings(): Record<string, unknown> {
    const stored = this.store.get<OperationRecord & { value?: Record<string, unknown> }>('system-settings', 'global');
    return stored?.value || {
      academicYearMode: 'term-based',
      auditRetentionDays: 365,
      notificationChannels: ['in_app', 'email', 'sms'],
      exportFormats: ['pdf', 'xlsx', 'csv'],
      school: {
        name: 'Kilimanjaro Schools',
        timezone: 'Africa/Nairobi',
        currency: 'TZS',
      },
    };
  }

  private seedFeatureFlags(): OperationRecord[] {
    const existing = this.store.list('feature-flags');
    if (existing.length) return existing;
    return [
      this.store.update('feature-flags', 'mobile-live-api', { key: 'mobile-live-api', enabled: false, audienceJson: {} }),
      this.store.update('feature-flags', 'finance-reconciliation', { key: 'finance-reconciliation', enabled: true, audienceJson: { roles: ['FINANCE'] } }),
    ];
  }

  private warning(result: { warning?: string }): string[] {
    return result.warning ? [result.warning] : [];
  }
}
