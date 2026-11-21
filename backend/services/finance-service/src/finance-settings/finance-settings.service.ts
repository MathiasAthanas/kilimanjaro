import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { FinancialAuditAction } from '../../generated/prisma';
import { AuditService } from '../audit/audit.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { assertSchoolInScope, schoolScopeFilter } from '../common/helpers/school-scope.helper';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentAccountDto, UpdateFinanceSettingsDto, UpdatePaymentAccountDto } from './finance-settings.dto';

export type BrandingKind = 'logo' | 'signature' | 'stamp';
const KINDS: BrandingKind[] = ['logo', 'signature', 'stamp'];
const MAX_IMAGE_BYTES = 600 * 1024;
export const DEFAULT_ACCENT = '#d59a1b';

/** The school this request is about: the selected school, or the only one the user belongs to. */
export function requireSchoolId(user: RequestUser | undefined): string {
  if (user?.activeSchoolId) return user.activeSchoolId;
  const ids = (user?.schoolIds ?? []).filter((id) => id && id !== '*');
  if (ids.length === 1) return ids[0];
  throw new BadRequestException('Select a school first (use the school switcher at the top).');
}

@Injectable()
export class FinanceSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  private root(schoolId: string) {
    return join(this.config.get<string>('PDF_STORAGE_PATH', './storage'), 'branding', schoolId);
  }

  private fileColumn(kind: BrandingKind) {
    return (kind + 'File') as 'logoFile' | 'signatureFile' | 'stampFile';
  }

  // ── Payment accounts ──────────────────────────────────────────────────────────────

  listAccounts(user: RequestUser | undefined, includeInactive = false) {
    return this.prisma.paymentAccount.findMany({
      where: { ...schoolScopeFilter(user), ...(includeInactive ? {} : { isActive: true }) },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /** What an invoice of this school prints under "Payment info". */
  activeAccountsForSchool(schoolId: string | null | undefined) {
    if (!schoolId) return Promise.resolve([]);
    return this.prisma.paymentAccount.findMany({ where: { schoolId, isActive: true }, orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }] });
  }

  async createAccount(dto: CreatePaymentAccountDto, user: RequestUser) {
    const schoolId = requireSchoolId(user);
    const count = await this.prisma.paymentAccount.count({ where: { schoolId } });
    const row = await this.prisma.paymentAccount.create({
      data: {
        schoolId,
        type: dto.type,
        bankName: dto.bankName.trim(),
        accountName: dto.accountName.trim(),
        accountNumber: dto.accountNumber.trim(),
        description: dto.description?.trim() || null,
        displayOrder: dto.displayOrder ?? count,
        createdById: user.id,
      },
    });
    await this.audit.log({ entityType: 'PaymentAccount', entityId: row.id, action: FinancialAuditAction.PAYMENT_ACCOUNT_CREATED, performedById: user.id, performedByRole: user.role, newValue: row });
    return row;
  }

  async updateAccount(id: string, dto: UpdatePaymentAccountDto, user: RequestUser) {
    const existing = await this.prisma.paymentAccount.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Payment account not found');
    assertSchoolInScope(user, existing.schoolId);
    const row = await this.prisma.paymentAccount.update({
      where: { id },
      data: {
        ...(dto.type ? { type: dto.type } : {}),
        ...(dto.bankName !== undefined ? { bankName: dto.bankName.trim() } : {}),
        ...(dto.accountName !== undefined ? { accountName: dto.accountName.trim() } : {}),
        ...(dto.accountNumber !== undefined ? { accountNumber: dto.accountNumber.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
        ...(dto.displayOrder !== undefined ? { displayOrder: dto.displayOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        updatedById: user.id,
      },
    });
    await this.audit.log({ entityType: 'PaymentAccount', entityId: id, action: FinancialAuditAction.PAYMENT_ACCOUNT_UPDATED, performedById: user.id, performedByRole: user.role, previousValue: existing, newValue: row });
    return row;
  }

  /** Accounts are switched off, never erased, so old invoices and the audit trail stay explainable. */
  async removeAccount(id: string, user: RequestUser) {
    const existing = await this.prisma.paymentAccount.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Payment account not found');
    assertSchoolInScope(user, existing.schoolId);
    const row = await this.prisma.paymentAccount.update({ where: { id }, data: { isActive: false, updatedById: user.id } });
    await this.audit.log({ entityType: 'PaymentAccount', entityId: id, action: FinancialAuditAction.PAYMENT_ACCOUNT_REMOVED, performedById: user.id, performedByRole: user.role, previousValue: existing, newValue: row });
    return row;
  }

  // ── School finance settings (invoice look, residence policy) ───────────────────────

  async getSettings(user: RequestUser | undefined) {
    const schoolId = requireSchoolId(user);
    assertSchoolInScope(user, schoolId);
    const row = await this.prisma.schoolFinanceSettings.findUnique({ where: { schoolId } });
    const images: Record<BrandingKind, string | null> = { logo: null, signature: null, stamp: null };
    for (const kind of KINDS) images[kind] = this.readImageDataUrl(schoolId, row?.[this.fileColumn(kind)] ?? null);
    return {
      schoolId,
      accentColor: row?.accentColor ?? DEFAULT_ACCENT,
      invoiceTitle: row?.invoiceTitle ?? 'INVOICE',
      invoiceNote: row?.invoiceNote ?? '',
      signatoryName: row?.signatoryName ?? '',
      residenceChangePolicy: (row?.residenceChangePolicy ?? 'ASK') as 'NEXT_TERM' | 'THIS_TERM' | 'ASK',
      images,
      updatedAt: row?.updatedAt ?? null,
    };
  }

  /** Just the policy: staff who change a student's residence (admin, admissions) need to read it, nothing else. */
  async residencePolicy(user: RequestUser | undefined) {
    const schoolId = requireSchoolId(user);
    assertSchoolInScope(user, schoolId);
    const row = await this.prisma.schoolFinanceSettings.findUnique({ where: { schoolId }, select: { residenceChangePolicy: true } });
    return { residenceChangePolicy: (row?.residenceChangePolicy ?? 'ASK') as 'NEXT_TERM' | 'THIS_TERM' | 'ASK' };
  }

  async updateSettings(dto: UpdateFinanceSettingsDto, user: RequestUser) {
    const schoolId = requireSchoolId(user);
    assertSchoolInScope(user, schoolId);
    const before = await this.prisma.schoolFinanceSettings.findUnique({ where: { schoolId } });
    const data = {
      ...(dto.accentColor !== undefined ? { accentColor: dto.accentColor.toLowerCase() } : {}),
      ...(dto.invoiceTitle !== undefined ? { invoiceTitle: dto.invoiceTitle.trim() || null } : {}),
      ...(dto.invoiceNote !== undefined ? { invoiceNote: dto.invoiceNote.trim() || null } : {}),
      ...(dto.signatoryName !== undefined ? { signatoryName: dto.signatoryName.trim() || null } : {}),
      ...(dto.residenceChangePolicy !== undefined ? { residenceChangePolicy: dto.residenceChangePolicy } : {}),
      updatedById: user.id,
    };
    const row = await this.prisma.schoolFinanceSettings.upsert({ where: { schoolId }, create: { schoolId, ...data }, update: data });
    await this.audit.log({ entityType: 'SchoolFinanceSettings', entityId: schoolId, action: FinancialAuditAction.FINANCE_SETTINGS_UPDATED, performedById: user.id, performedByRole: user.role, previousValue: before, newValue: { ...row, schoolId } });
    return this.getSettings(user);
  }

  // ── Branding images ───────────────────────────────────────────────────────────────

  private readImageDataUrl(schoolId: string, fileName: string | null): string | null {
    if (!fileName) return null;
    const path = join(this.root(schoolId), fileName);
    if (!existsSync(path)) return null;
    const mime = fileName.endsWith('.png') ? 'image/png' : 'image/jpeg';
    return `data:${mime};base64,${readFileSync(path).toString('base64')}`;
  }

  /** Raw image bytes for the PDF; null when the school has not uploaded that image. */
  async imageBuffer(schoolId: string | null | undefined, kind: BrandingKind): Promise<Buffer | null> {
    if (!schoolId) return null;
    const row = await this.prisma.schoolFinanceSettings.findUnique({ where: { schoolId } });
    const fileName = row?.[this.fileColumn(kind)];
    if (!fileName) return null;
    const path = join(this.root(schoolId), fileName);
    return existsSync(path) ? readFileSync(path) : null;
  }

  async saveImage(kind: BrandingKind, dataUrl: string, user: RequestUser) {
    if (!KINDS.includes(kind)) throw new BadRequestException('Unknown image type');
    const schoolId = requireSchoolId(user);
    assertSchoolInScope(user, schoolId);
    const match = /^data:image\/(png|jpeg|jpg);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(dataUrl.trim());
    if (!match) throw new BadRequestException('Upload a PNG or JPG image');
    const bytes = Buffer.from(match[2], 'base64');
    if (!bytes.length) throw new BadRequestException('The image is empty');
    if (bytes.length > MAX_IMAGE_BYTES) throw new BadRequestException('The image is too large. Use one under 600 KB.');
    const extension = match[1] === 'png' ? 'png' : 'jpg';
    const fileName = `${kind}-${Date.now()}.${extension}`;
    const dir = this.root(schoolId);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, fileName), bytes);
    const column = this.fileColumn(kind);
    const before = await this.prisma.schoolFinanceSettings.findUnique({ where: { schoolId } });
    await this.prisma.schoolFinanceSettings.upsert({ where: { schoolId }, create: { schoolId, [column]: fileName, updatedById: user.id }, update: { [column]: fileName, updatedById: user.id } });
    const previous = before?.[column];
    if (previous && previous !== fileName) rmSync(join(dir, previous), { force: true });
    await this.audit.log({ entityType: 'SchoolFinanceSettings', entityId: schoolId, action: FinancialAuditAction.FINANCE_SETTINGS_UPDATED, performedById: user.id, performedByRole: user.role, metadata: { schoolId, image: kind, action: 'uploaded' } });
    return this.getSettings(user);
  }

  async removeImage(kind: BrandingKind, user: RequestUser) {
    if (!KINDS.includes(kind)) throw new BadRequestException('Unknown image type');
    const schoolId = requireSchoolId(user);
    assertSchoolInScope(user, schoolId);
    const column = this.fileColumn(kind);
    const before = await this.prisma.schoolFinanceSettings.findUnique({ where: { schoolId } });
    const previous = before?.[column];
    if (previous) {
      await this.prisma.schoolFinanceSettings.update({ where: { schoolId }, data: { [column]: null, updatedById: user.id } });
      rmSync(join(this.root(schoolId), previous), { force: true });
      await this.audit.log({ entityType: 'SchoolFinanceSettings', entityId: schoolId, action: FinancialAuditAction.FINANCE_SETTINGS_UPDATED, performedById: user.id, performedByRole: user.role, metadata: { schoolId, image: kind, action: 'removed' } });
    }
    return this.getSettings(user);
  }

  /** Everything an invoice needs to look like the school's own. */
  async brandingForPdf(schoolId: string | null | undefined) {
    const row = schoolId ? await this.prisma.schoolFinanceSettings.findUnique({ where: { schoolId } }) : null;
    return {
      accentColor: row?.accentColor || DEFAULT_ACCENT,
      title: row?.invoiceTitle || 'INVOICE',
      note: row?.invoiceNote || null,
      signatoryName: row?.signatoryName || null,
      logo: await this.imageBuffer(schoolId, 'logo'),
      signature: await this.imageBuffer(schoolId, 'signature'),
      stamp: await this.imageBuffer(schoolId, 'stamp'),
    };
  }
}
