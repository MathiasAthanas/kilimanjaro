import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel } from '@prisma/client';
import { compileTemplateSafe } from '../common/helpers/handlebars.helper';
import { QueuesService } from '../queues/queues.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { PreferencesService } from '../preferences/preferences.service';
import { RecipientResolverService } from './recipient-resolver.service';

@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly queues: QueuesService,
    private readonly preferences: PreferencesService,
    private readonly resolver: RecipientResolverService,
  ) {}

  private sourceEventId(eventType: string, payload: any): string {
    const basis = `${eventType}:${JSON.stringify(payload || {})}`;
    return createHash('sha256').update(basis).digest('hex');
  }

  private async eventRecipients(eventType: string, payload: any): Promise<Array<{ userId: string; role: string; email?: string; phone?: string }>> {
    const recipients: Array<{ userId: string; role: string; email?: string; phone?: string }> = [];

    if (eventType.startsWith('finance.') || ['payment.confirmed', 'invoice.generated', 'fee.overdue', 'fee.reminder', 'receipt.generated'].includes(eventType)) {
      if (payload.studentId) {
        const guardian = await this.resolver.resolveGuardian(payload.studentId);
        if (guardian?.authUserId) {
          recipients.push({ userId: guardian.authUserId, role: 'PARENT', email: guardian.email, phone: guardian.phone });
        }
      }
      if (eventType === 'payment.rejected' && payload.enteredById) {
        const staff = await this.resolver.resolveUser(payload.enteredById);
        if (staff?.id || staff?.authUserId) recipients.push({ userId: staff.id || staff.authUserId, role: staff.role || 'FINANCE', email: staff.email, phone: staff.phone });
      }
    } else if (eventType === 'results.published' || eventType === 'report_card.generated') {
      const guardian = payload.studentId ? await this.resolver.resolveGuardian(payload.studentId) : null;
      if (guardian?.authUserId) recipients.push({ userId: guardian.authUserId, role: 'PARENT', email: guardian.email, phone: guardian.phone });
      if (payload.studentAuthUserId) recipients.push({ userId: payload.studentAuthUserId, role: 'STUDENT' });
    } else if (eventType.startsWith('performance.alert') || eventType === 'alert.escalated') {
      if (payload.teacherId) {
        const teacher = await this.resolver.resolveUser(payload.teacherId);
        if (teacher?.id || teacher?.authUserId) recipients.push({ userId: teacher.id || teacher.authUserId, role: teacher.role || 'TEACHER', email: teacher.email, phone: teacher.phone });
      }
      const academic = await this.resolver.resolveStaffByRole(['PRINCIPAL', 'ACADEMIC_QA']);
      for (const user of academic) recipients.push({ userId: user.id || user.authUserId, role: user.role || 'PRINCIPAL', email: user.email, phone: user.phone });
      if (payload.severity === 'CRITICAL' && payload.studentId) {
        const guardian = await this.resolver.resolveGuardian(payload.studentId);
        if (guardian?.authUserId) recipients.push({ userId: guardian.authUserId, role: 'PARENT', email: guardian.email, phone: guardian.phone });
      }
    } else if (eventType === 'user.created' || eventType === 'password.reset.requested' || eventType === 'account.locked') {
      if (payload.userId || payload.authUserId) {
        const user = await this.resolver.resolveUser(payload.userId || payload.authUserId);
        if (user?.id || user?.authUserId) recipients.push({ userId: user.id || user.authUserId, role: user.role || payload.role || 'USER', email: user.email, phone: user.phone });
      }
      if (eventType === 'account.locked') {
        const admins = await this.resolver.resolveStaffByRole(['SYSTEM_ADMIN']);
        for (const user of admins) recipients.push({ userId: user.id || user.authUserId, role: 'SYSTEM_ADMIN', email: user.email, phone: user.phone });
      }
    } else if (payload.recipientIds?.length) {
      for (const id of payload.recipientIds) {
        const user = await this.resolver.resolveUser(id);
        if (user?.id || user?.authUserId) recipients.push({ userId: user.id || user.authUserId, role: user.role || 'USER', email: user.email, phone: user.phone });
      }
    }

    const unique = new Map<string, any>();
    recipients.forEach((r) => unique.set(r.userId, r));
    return Array.from(unique.values());
  }

  private channelsForEvent(eventType: string): NotificationChannel[] {
    if (eventType === 'manual') return ['IN_APP'];
    if (eventType === 'results.published') return ['SMS', 'PUSH', 'IN_APP'];
    if (eventType.includes('payment') || eventType.includes('fee') || eventType.includes('invoice') || eventType.includes('receipt')) {
      return ['SMS', 'EMAIL', 'IN_APP'];
    }
    if (eventType.includes('alert') || eventType.includes('marks') || eventType.includes('report_card')) return ['EMAIL', 'IN_APP', 'PUSH'];
    return ['IN_APP'];
  }

  async dispatchFromEvent(eventType: string, payload: any, sourceService: string) {
    const sourceEventId = payload?.sourceEventId || this.sourceEventId(eventType, payload?.key_identifiers || payload);
    const idemKey = `notif:idempotency:${sourceEventId}`;
    if (await this.redis.has(idemKey)) {
      return { accepted: true, duplicate: true };
    }
    await this.redis.set(idemKey, true, 24 * 60 * 60);

    const recipients = await this.eventRecipients(eventType, payload || {});
    const channels = this.channelsForEvent(eventType);

    const createdIds: string[] = [];
    for (const recipient of recipients) {
      for (const channel of channels) {
        const allowed = await this.preferences.isAllowed(recipient.userId, eventType, channel);
        if (!allowed) continue;

        const template = await this.prisma.notificationTemplate.findFirst({ where: { eventType, channel, language: 'en', isActive: true } });
        if (!template && eventType !== 'manual') continue;

        let subject = template?.subject || payload?.subject || null;
        let body = template?.body || payload?.body || '';

        try {
          subject = subject ? compileTemplateSafe(subject, payload || {}) : null;
          body = compileTemplateSafe(body, payload || {});
        } catch (error) {
          this.logger.warn(`Template compile failure for ${eventType}/${channel}: ${(error as Error).message}`);
          continue;
        }

        const row = await this.prisma.notification.create({
          data: {
            recipientId: recipient.userId,
            recipientRole: recipient.role,
            recipientPhone: recipient.phone,
            recipientEmail: recipient.email,
            channel,
            eventType,
            templateId: template?.id,
            subject,
            body,
            status: 'QUEUED',
            sourceService,
            sourceEventId,
            metadata: payload,
          },
        });

        createdIds.push(row.id);

        if (channel === 'SMS') await this.queues.addSms({ notificationId: row.id });
        if (channel === 'EMAIL') await this.queues.addEmail({ notificationId: row.id });
        if (channel === 'PUSH') await this.queues.addPush({ notificationId: row.id, title: subject || 'Kilimanjaro Schools' });
        if (channel === 'IN_APP') await this.queues.addInApp({ notificationId: row.id });
      }
    }

    return { accepted: true, notifications: createdIds.length, ids: createdIds };
  }

  async dispatchManual(recipientIds: string[], channel: NotificationChannel, subject: string | undefined, body: string) {
    return this.dispatchFromEvent('manual', { recipientIds, subject, body, channel }, 'manual');
  }

  async dispatchAnnouncement(announcement: any) {
    const roles = announcement.targetRoles?.length ? announcement.targetRoles : ['PARENT', 'STUDENT', 'TEACHER', 'PRINCIPAL', 'ACADEMIC_QA', 'FINANCE', 'HEAD_OF_DEPARTMENT'];
    const users = await this.resolver.resolveStaffByRole(roles);
    const recipientIds = users.map((u) => u.id || u.authUserId).filter(Boolean);
    await this.dispatchFromEvent('announcement.posted', {
      recipientIds,
      subject: announcement.title,
      body: announcement.body,
      channels: announcement.channels,
      priority: announcement.priority,
      announcementId: announcement.id,
    }, 'notification-service');
  }
}
