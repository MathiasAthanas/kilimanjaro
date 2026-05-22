import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMqService } from '../rabbitmq/rabbitmq.service';

@Injectable()
export class OverdueJob {
  private readonly logger = new Logger(OverdueJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitMqService,
  ) {}

  /** Runs every 2 hours — closes past-due assignments and emits assignment.overdue */
  @Cron('0 */2 * * *')
  async run(): Promise<void> {
    const now = new Date();

    try {
      const overdueAssignments = await this.prisma.assignment.findMany({
        where: {
          status: 'PUBLISHED',
          allowLateSubmission: false,
          dueAt: { lt: now },
        },
        include: {
          courseSpace: { include: { enrollments: { where: { status: 'ACTIVE' } } } },
          submissions: { where: { status: { in: ['SUBMITTED', 'GRADED'] } }, select: { studentId: true } },
        },
      });

      for (const assignment of overdueAssignments) {
        await this.prisma.assignment.update({
          where: { id: assignment.id },
          data: { status: 'CLOSED', closedAt: now },
        });

        const submittedIds = new Set(assignment.submissions.map((s) => s.studentId));
        const missingStudentIds = assignment.courseSpace.enrollments
          .filter((e) => !submittedIds.has(e.studentId))
          .map((e) => e.studentId);

        if (missingStudentIds.length) {
          await this.rabbitmq.publish('assignment.overdue', {
            assignmentId: assignment.id,
            courseId: assignment.courseSpaceId,
            title: assignment.title,
            dueAt: assignment.dueAt,
            missingStudentIds,
          });
        }
      }

      if (overdueAssignments.length) {
        this.logger.log(`Overdue: closed ${overdueAssignments.length} assignment(s)`);
      }
    } catch (error) {
      this.logger.error(`OverdueJob failed: ${(error as Error).message}`);
    }
  }
}
