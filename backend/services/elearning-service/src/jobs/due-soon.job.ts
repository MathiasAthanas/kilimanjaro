import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMqService } from '../rabbitmq/rabbitmq.service';

@Injectable()
export class DueSoonJob {
  private readonly logger = new Logger(DueSoonJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMqService,
  ) {}

  /** Runs every hour — emits assignment.due_soon for assignments due within 24 hours */
  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    try {
      const assignments = await this.prisma.assignment.findMany({
        where: {
          status: 'PUBLISHED',
          dueAt: { gte: now, lte: in24h },
          dueSoonNotifiedAt: null,
        },
        include: {
          courseSpace: { include: { enrollments: { where: { status: 'ACTIVE' } } } },
        },
      });

      for (const assignment of assignments) {
        const studentIds = assignment.courseSpace.enrollments.map((e) => e.studentId);
        await this.rabbitmq.publish('assignment.due_soon', {
          assignmentId: assignment.id,
          courseId: assignment.courseSpaceId,
          title: assignment.title,
          dueAt: assignment.dueAt,
          studentIds,
        });
        await this.prisma.assignment.update({
          where: { id: assignment.id },
          data: { dueSoonNotifiedAt: now },
        });
      }

      if (assignments.length) {
        this.logger.log(`Due-soon: notified ${assignments.length} assignment(s)`);
      }
    } catch (error) {
      this.logger.error(`DueSoonJob failed: ${(error as Error).message}`);
    }
  }
}
