import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMqService } from '../rabbitmq/rabbitmq.service';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitMq: RabbitMqService,
  ) {}

  @Cron('0 8 * * 1,3,5')
  async pendingSubmissionReminder(): Promise<void> {
    const assessments = await this.prisma.assessment.findMany({
      where: { status: 'OPEN' },
      include: { classSubject: true },
      take: 500,
    });

    for (const assessment of assessments) {
      await this.rabbitMq.publish('marks.submission.reminder', {
        assessmentId: assessment.id,
        teacherId: assessment.classSubject.teacherId,
        classId: assessment.classId,
        termId: assessment.termId,
      });
    }

    this.logger.log(`Pending submission reminders sent: ${assessments.length}`);
  }

  @Cron('0 9 * * 1')
  async syllabusCompletionAlert(): Promise<void> {
    const trackers = await this.prisma.syllabusTracker.findMany({
      where: { completionPercentage: { lt: 80 } },
      include: { classSubject: { include: { subject: true } } },
      take: 500,
    });

    for (const tracker of trackers) {
      await this.rabbitMq.publish('syllabus.completion.alert', {
        classSubjectId: tracker.classSubjectId,
        termId: tracker.termId,
        subjectName: tracker.classSubject.subject.name,
        completionPercentage: tracker.completionPercentage,
      });
    }

    this.logger.log(`Syllabus completion alerts sent: ${trackers.length}`);
  }

  @Cron('0 8 * * 2,4')
  async pendingApprovalReminder(): Promise<void> {
    const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const assessments = await this.prisma.assessment.findMany({
      where: {
        status: { in: ['SUBMITTED', 'HOD_APPROVED'] },
        submittedAt: { lte: cutoff },
      },
      take: 500,
    });

    for (const assessment of assessments) {
      await this.rabbitMq.publish('marks.approval.reminder', {
        assessmentId: assessment.id,
        status: assessment.status,
        classId: assessment.classId,
        termId: assessment.termId,
      });
    }

    this.logger.log(`Pending approval reminders sent: ${assessments.length}`);
  }
}
