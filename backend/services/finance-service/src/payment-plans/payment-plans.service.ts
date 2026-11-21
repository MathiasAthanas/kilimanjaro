import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FinancialAuditAction, InvoiceStatus, Prisma } from '../../generated/prisma';
import { AuditService } from '../audit/audit.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { assertSchoolInScope, schoolScopeFilter } from '../common/helpers/school-scope.helper';
import { PrismaService } from '../prisma/prisma.service';
import { requireSchoolId } from '../finance-settings/finance-settings.service';
import { ApplyInvoicePlanDto, BulkApplyPlansDto, PlanInstallmentDto, PreviewPlanDto, SavePaymentPlanDto, SetCustomPlanDto } from './payment-plans.dto';
import { allocatePaid, buildSchedule, PlanDef, PlanInstallmentDef, rescaleAmounts, ScheduleLine, validatePlanDefinition } from './plan-schedule';

const OPEN_STATUSES: InvoiceStatus[] = [InvoiceStatus.ISSUED, InvoiceStatus.PARTIALLY_PAID, InvoiceStatus.OVERDUE];

const toDef = (i: PlanInstallmentDto, index: number): PlanInstallmentDef => ({
  sequence: index + 1,
  groupLabel: i.groupLabel?.trim() || null,
  label: i.label.trim(),
  percent: i.percent ?? null,
  fixedAmount: i.fixedAmount ?? null,
  isRemainder: !!i.isRemainder,
  dueDate: i.dueDate ? new Date(i.dueDate) : null,
  dueDaysAfterIssue: i.dueDaysAfterIssue ?? null,
});

type TemplateWithRows = Prisma.PaymentPlanTemplateGetPayload<{ include: { installments: true } }>;

function templateDef(t: TemplateWithRows): PlanDef {
  return {
    coveredCategoryIds: t.coveredCategoryIds,
    otherItemsLabel: t.otherItemsLabel,
    otherItemsDueDays: t.otherItemsDueDays,
    installments: t.installments.map((i) => ({
      sequence: i.sequence,
      groupLabel: i.groupLabel,
      label: i.label,
      percent: i.percent ? Number(i.percent) : null,
      fixedAmount: i.fixedAmount ? Number(i.fixedAmount) : null,
      isRemainder: i.isRemainder,
      dueDate: i.dueDate,
      dueDaysAfterIssue: i.dueDaysAfterIssue,
    })),
  };
}

@Injectable()
export class PaymentPlansService {
  private readonly logger = new Logger(PaymentPlansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Templates ─────────────────────────────────────────────────────────────────────

  list(user: RequestUser | undefined, includeInactive = false) {
    return this.prisma.paymentPlanTemplate.findMany({
      where: { ...schoolScopeFilter(user), ...(includeInactive ? {} : { isActive: true }) },
      include: { installments: { orderBy: { sequence: 'asc' } } },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  private checkDefinition(dto: SavePaymentPlanDto) {
    const errors = validatePlanDefinition(dto.installments.map(toDef));
    if (errors.length) throw new BadRequestException(errors.join('. '));
  }

  private data(dto: SavePaymentPlanDto) {
    return {
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      isActive: dto.isActive ?? true,
      residenceType: dto.residenceType ?? null,
      educationStage: (dto.educationStage || null) as any,
      classLevel: dto.classLevel ?? null,
      academicYearId: dto.academicYearId || null,
      termId: dto.termId || null,
      coveredCategoryIds: dto.coveredCategoryIds ?? [],
      otherItemsLabel: dto.otherItemsLabel?.trim() || null,
      otherItemsDueDays: dto.otherItemsDueDays ?? 0,
    };
  }

  private rows(dto: SavePaymentPlanDto) {
    return dto.installments.map((i, index) => ({
      sequence: index + 1,
      groupLabel: i.groupLabel?.trim() || null,
      label: i.label.trim(),
      percent: i.percent != null ? new Prisma.Decimal(i.percent) : null,
      fixedAmount: i.fixedAmount != null ? new Prisma.Decimal(i.fixedAmount) : null,
      isRemainder: !!i.isRemainder,
      dueDate: i.dueDate ? new Date(i.dueDate) : null,
      dueDaysAfterIssue: i.dueDate ? null : i.dueDaysAfterIssue ?? null,
    }));
  }

  async create(dto: SavePaymentPlanDto, user: RequestUser) {
    this.checkDefinition(dto);
    const schoolId = requireSchoolId(user);
    const row = await this.prisma.paymentPlanTemplate.create({
      data: { schoolId, ...this.data(dto), createdById: user.id, installments: { create: this.rows(dto) } },
      include: { installments: { orderBy: { sequence: 'asc' } } },
    });
    await this.audit.log({ entityType: 'PaymentPlanTemplate', entityId: row.id, action: FinancialAuditAction.PAYMENT_PLAN_SAVED, performedById: user.id, performedByRole: user.role, newValue: row });
    return row;
  }

  async update(id: string, dto: SavePaymentPlanDto, user: RequestUser) {
    this.checkDefinition(dto);
    const existing = await this.prisma.paymentPlanTemplate.findUnique({ where: { id }, include: { installments: true } });
    if (!existing) throw new NotFoundException('Payment plan not found');
    assertSchoolInScope(user, existing.schoolId);
    // Invoices keep their own copy of the schedule, so changing a plan never rewrites an invoice that already exists.
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.paymentPlanInstallment.deleteMany({ where: { templateId: id } });
      return tx.paymentPlanTemplate.update({
        where: { id },
        data: { ...this.data(dto), updatedById: user.id, installments: { create: this.rows(dto) } },
        include: { installments: { orderBy: { sequence: 'asc' } } },
      });
    });
    await this.audit.log({ entityType: 'PaymentPlanTemplate', entityId: id, action: FinancialAuditAction.PAYMENT_PLAN_SAVED, performedById: user.id, performedByRole: user.role, previousValue: existing, newValue: row });
    return row;
  }

  async setActive(id: string, isActive: boolean, user: RequestUser) {
    const existing = await this.prisma.paymentPlanTemplate.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Payment plan not found');
    assertSchoolInScope(user, existing.schoolId);
    const row = await this.prisma.paymentPlanTemplate.update({ where: { id }, data: { isActive, updatedById: user.id } });
    await this.audit.log({ entityType: 'PaymentPlanTemplate', entityId: id, action: FinancialAuditAction.PAYMENT_PLAN_SAVED, performedById: user.id, performedByRole: user.role, previousValue: existing, newValue: row });
    return row;
  }

  /** Show what a plan would produce, before saving it. */
  preview(dto: PreviewPlanDto) {
    const errors = validatePlanDefinition(dto.installments.map(toDef));
    const lines: ScheduleLine[] = [{ feeCategoryId: 'covered', name: 'Covered fees', amount: dto.amountToSplit }];
    if (dto.otherAmount && dto.otherAmount > 0) lines.push({ feeCategoryId: 'other', name: 'Other items', amount: dto.otherAmount });
    const rows = buildSchedule(
      { coveredCategoryIds: dto.otherAmount && dto.otherAmount > 0 ? ['covered'] : [], otherItemsLabel: dto.otherItemsLabel, otherItemsDueDays: dto.otherItemsDueDays ?? 0, installments: dto.installments.map(toDef) },
      lines,
      new Date(),
    );
    return { errors, rows };
  }

  // ── Invoices ──────────────────────────────────────────────────────────────────────

  /** The best plan for an invoice: every target a plan sets must match; more specific plans win. */
  async pickTemplate(ctx: { schoolId: string | null; residenceType?: string | null; educationStage?: string | null; classLevel?: number | null; academicYearId: string; termId: string }): Promise<TemplateWithRows | null> {
    if (!ctx.schoolId) return null;
    const templates = await this.prisma.paymentPlanTemplate.findMany({ where: { schoolId: ctx.schoolId, isActive: true }, include: { installments: true } });
    const scored = templates
      .filter((t) =>
        (!t.residenceType || t.residenceType === ctx.residenceType) &&
        (!t.educationStage || t.educationStage === ctx.educationStage) &&
        (t.classLevel == null || t.classLevel === ctx.classLevel) &&
        (!t.academicYearId || t.academicYearId === ctx.academicYearId) &&
        (!t.termId || t.termId === ctx.termId) &&
        t.installments.length > 0,
      )
      .map((t) => ({ t, score: (t.termId ? 16 : 0) + (t.academicYearId ? 8 : 0) + (t.classLevel != null ? 4 : 0) + (t.educationStage ? 2 : 0) + (t.residenceType ? 1 : 0) }))
      .sort((a, b) => b.score - a.score || b.t.createdAt.getTime() - a.t.createdAt.getTime());
    return scored[0]?.t ?? null;
  }

  /** Copy a plan's schedule onto an invoice (replacing any schedule it had). Returns the number of instalments, 0 when none apply. */
  async attach(invoiceId: string, templateId: string | null, actor: { id: string; role: string }): Promise<number> {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId }, include: { lineItems: true } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    const template = templateId
      ? await this.prisma.paymentPlanTemplate.findUnique({ where: { id: templateId }, include: { installments: true } })
      : await this.pickTemplate({ schoolId: invoice.schoolId, residenceType: invoice.residenceType, educationStage: invoice.educationStage, classLevel: invoice.classLevel, academicYearId: invoice.academicYearId, termId: invoice.termId });
    if (!template) return 0;
    if (template.schoolId !== invoice.schoolId) throw new BadRequestException('That payment plan belongs to another school');
    const lines: ScheduleLine[] = invoice.lineItems.map((l) => ({ feeCategoryId: l.feeCategoryId, name: l.feeCategoryName, amount: Number(l.amount) }));
    // A discount lowers the fees being split, so it is taken off the covered amount before splitting.
    const rows = buildSchedule(templateDef(template), lines, invoice.issuedAt ?? invoice.createdAt);
    if (!rows.length) return 0;
    const total = Number(invoice.totalAmount);
    const amounts = rescaleAmounts(rows.map((r) => r.amount), total);
    await this.prisma.$transaction(async (tx) => {
      await tx.invoiceInstallment.deleteMany({ where: { invoiceId } });
      await tx.invoiceInstallment.createMany({
        data: rows.map((r, idx) => ({
          invoiceId,
          sequence: r.sequence,
          groupLabel: r.groupLabel,
          label: r.label,
          description: r.description,
          amount: new Prisma.Decimal(amounts[idx]),
          dueDate: r.dueDate,
          templateId: template.id,
          isCustom: false,
        })),
      });
    });
    await this.audit.log({
      entityType: 'Invoice',
      entityId: invoiceId,
      action: FinancialAuditAction.INVOICE_PLAN_APPLIED,
      performedById: actor.id,
      performedByRole: actor.role,
      metadata: { schoolId: invoice.schoolId, templateId: template.id, templateName: template.name, instalments: rows.length },
    });
    return rows.length;
  }

  private async invoiceFor(invoiceId: string, user: RequestUser | undefined) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    assertSchoolInScope(user, invoice.schoolId);
    return invoice;
  }

  /** The invoice's instalments with how much of each is paid (earliest due first). */
  async view(invoiceId: string, user: RequestUser | undefined) {
    const invoice = await this.invoiceFor(invoiceId, user);
    const rows = await this.prisma.invoiceInstallment.findMany({ where: { invoiceId }, orderBy: { sequence: 'asc' } });
    const template = rows[0]?.templateId ? await this.prisma.paymentPlanTemplate.findUnique({ where: { id: rows[0].templateId }, select: { id: true, name: true } }) : null;
    const withPaid = allocatePaid(rows.map((r) => ({ ...r, amount: Number(r.amount) })), Number(invoice.paidAmount));
    return {
      invoiceId,
      totalAmount: Number(invoice.totalAmount),
      paidAmount: Number(invoice.paidAmount),
      isCustom: rows.some((r) => r.isCustom),
      template,
      installments: withPaid.map((r) => ({
        id: r.id, sequence: r.sequence, groupLabel: r.groupLabel, label: r.label, description: r.description,
        amount: r.amount, paid: r.paid, balance: r.balance, dueDate: r.dueDate,
        overdue: r.balance > 0 && new Date(r.dueDate).getTime() < Date.now(),
      })),
    };
  }

  /** Finance puts a plan on an invoice: a chosen template, or the best match. */
  async apply(invoiceId: string, dto: ApplyInvoicePlanDto, user: RequestUser) {
    const invoice = await this.invoiceFor(invoiceId, user);
    if (!OPEN_STATUSES.includes(invoice.status) && invoice.status !== InvoiceStatus.DRAFT) throw new BadRequestException('A plan can only be set on an open invoice');
    const count = await this.attach(invoiceId, dto.templateId ?? null, user);
    if (!count) throw new BadRequestException('No payment plan matches this invoice. Create one under Payment Plans first.');
    return this.view(invoiceId, user);
  }

  /** A one-off schedule for one invoice (a family agreeing different dates). The amounts must add up to the invoice total. */
  async setCustom(invoiceId: string, dto: SetCustomPlanDto, user: RequestUser) {
    const invoice = await this.invoiceFor(invoiceId, user);
    if (!OPEN_STATUSES.includes(invoice.status)) throw new BadRequestException('A plan can only be set on an open invoice');
    const sum = Math.round(dto.installments.reduce((s, i) => s + Number(i.amount), 0) * 100);
    const total = Math.round(Number(invoice.totalAmount) * 100);
    if (sum !== total) throw new BadRequestException(`The instalments add up to ${(sum / 100).toLocaleString('en-US')} but the invoice total is ${(total / 100).toLocaleString('en-US')}`);
    const before = await this.prisma.invoiceInstallment.findMany({ where: { invoiceId } });
    await this.prisma.$transaction(async (tx) => {
      await tx.invoiceInstallment.deleteMany({ where: { invoiceId } });
      await tx.invoiceInstallment.createMany({
        data: dto.installments.map((i, idx) => ({
          invoiceId,
          sequence: idx + 1,
          groupLabel: i.groupLabel?.trim() || null,
          label: i.label.trim(),
          description: i.description?.trim() || null,
          amount: new Prisma.Decimal(i.amount),
          dueDate: new Date(i.dueDate),
          isCustom: true,
        })),
      });
    });
    await this.audit.log({
      entityType: 'Invoice',
      entityId: invoiceId,
      action: FinancialAuditAction.INVOICE_PLAN_APPLIED,
      performedById: user.id,
      performedByRole: user.role,
      previousValue: before,
      metadata: { schoolId: invoice.schoolId, custom: true, reason: dto.reason, instalments: dto.installments.length },
    });
    return this.view(invoiceId, user);
  }

  async clear(invoiceId: string, user: RequestUser) {
    const invoice = await this.invoiceFor(invoiceId, user);
    await this.prisma.invoiceInstallment.deleteMany({ where: { invoiceId } });
    await this.audit.log({ entityType: 'Invoice', entityId: invoiceId, action: FinancialAuditAction.INVOICE_PLAN_APPLIED, performedById: user.id, performedByRole: user.role, metadata: { schoolId: invoice.schoolId, removed: true } });
    return { invoiceId, installments: [] };
  }

  /** The invoice total changed (discount, fee recalculation): keep the same schedule, re-split to the new total. */
  async rescaleToTotal(invoiceId: string): Promise<void> {
    try {
      const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId }, select: { totalAmount: true } });
      const rows = await this.prisma.invoiceInstallment.findMany({ where: { invoiceId }, orderBy: { sequence: 'asc' } });
      if (!invoice || !rows.length) return;
      const amounts = rescaleAmounts(rows.map((r) => Number(r.amount)), Number(invoice.totalAmount));
      await this.prisma.$transaction(rows.map((r, idx) => this.prisma.invoiceInstallment.update({ where: { id: r.id }, data: { amount: new Prisma.Decimal(amounts[idx]) } })));
    } catch (err) {
      this.logger.warn(`Could not re-split the payment plan of invoice ${invoiceId}: ${(err as Error)?.message}`);
    }
  }

  /** The invoice lines or total changed: rebuild a plan-based schedule from its plan, or re-split a hand-made one. */
  async refreshAfterChange(invoiceId: string, actor: { id: string; role: string }): Promise<void> {
    try {
      const rows = await this.prisma.invoiceInstallment.findMany({ where: { invoiceId }, orderBy: { sequence: 'asc' }, take: 1 });
      if (!rows.length) return;
      if (!rows[0].isCustom && rows[0].templateId) {
        const exists = await this.prisma.paymentPlanTemplate.findUnique({ where: { id: rows[0].templateId }, select: { id: true } });
        if (exists && (await this.attach(invoiceId, rows[0].templateId, actor)) > 0) return;
      }
      await this.rescaleToTotal(invoiceId);
    } catch (err) {
      this.logger.warn(`Could not refresh the payment plan of invoice ${invoiceId}: ${(err as Error)?.message}`);
    }
  }

  /** Give every open invoice of a term that has no plan yet its best matching one. */
  async bulkApply(dto: BulkApplyPlansDto, user: RequestUser) {
    const invoices = await this.prisma.invoice.findMany({
      where: { ...schoolScopeFilter(user), termId: dto.termId, academicYearId: dto.academicYearId, status: { in: OPEN_STATUSES }, installments: { none: {} } },
      select: { id: true },
      take: 2000,
    });
    let applied = 0;
    let skipped = 0;
    for (const invoice of invoices) {
      try {
        const count = await this.attach(invoice.id, dto.templateId ?? null, user);
        if (count) applied++;
        else skipped++;
      } catch {
        skipped++;
      }
    }
    return { checked: invoices.length, applied, skipped };
  }
}
