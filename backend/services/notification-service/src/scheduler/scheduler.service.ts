import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AnnouncementsService } from '../announcements/announcements.service';
import { DispatchService } from '../dispatch/dispatch.service';
import { DownstreamService } from '../downstream/downstream.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueuesService } from '../queues/queues.service';

@Injectable()
export class SchedulerService {
  constructor(
    private readonly announcements: AnnouncementsService,
    private readonly prisma: PrismaService,
    private readonly queues: QueuesService,
    private readonly downstream: DownstreamService,
    private readonly dispatch: DispatchService,
  ) {}

  @Cron('*/5 * * * *')
  async publishScheduledAnnouncements() {
    await this.announcements.publishScheduled();
  }

  @Cron('0 1 * * *')
  async expireOldAnnouncements() {
    await this.announcements.expireOld();
  }

  @Cron('*/30 * * * *')
  async retryFailedNotifications() {
    const failed = await this.prisma.notification.findMany({ where: { status: 'FAILED', attemptCount: { lt: 3 } }, take: 500 });
    for (const n of failed) {
      if (n.channel === 'SMS') await this.queues.addSms({ notificationId: n.id });
      if (n.channel === 'EMAIL') await this.queues.addEmail({ notificationId: n.id });
      if (n.channel === 'PUSH') await this.queues.addPush({ notificationId: n.id, title: n.subject || 'Kilimanjaro Schools' });
      if (n.channel === 'IN_APP') await this.queues.addInApp({ notificationId: n.id });
    }
  }

  @Cron('0 3 * * 0')
  async cleanupTokens() {
    await this.prisma.deviceToken.deleteMany({ where: { isActive: false, lastUsedAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } });
  }

  @Cron('0 7 * * 1')
  async weeklyPerformanceDigest() {
    const alerts = (await this.downstream.activeHighAlerts()) || [];
    const grouped = alerts.reduce<Record<string, any[]>>((acc, item) => {
      const teacherId = item.teacherId;
      if (!teacherId) return acc;
      if (!acc[teacherId]) acc[teacherId] = [];
      acc[teacherId].push(item);
      return acc;
    }, {});

    for (const [teacherId, teacherAlerts] of Object.entries(grouped)) {
      const summary = teacherAlerts
        .map((a) => `${a.studentName || a.studentId} - ${a.subjectName || 'Subject'} - ${a.alertType || 'ALERT'}`)
        .join('\n');

      await this.dispatch.dispatchFromEvent(
        'performance.weekly.digest',
        {
          recipientIds: [teacherId],
          subject: 'Weekly Performance Digest',
          body: `Weekly performance digest:\n${summary}`,
        },
        'notification-service',
      );
    }
  }
}
