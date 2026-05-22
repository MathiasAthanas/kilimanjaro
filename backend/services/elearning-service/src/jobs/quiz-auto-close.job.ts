import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class QuizAutoCloseJob {
  private readonly logger = new Logger(QuizAutoCloseJob.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Runs every 30 minutes — auto-submits in-progress attempts that exceeded their time limit */
  @Cron('*/30 * * * *')
  async run(): Promise<void> {
    const now = new Date();

    try {
      const staleAttempts = await this.prisma.quizAttempt.findMany({
        where: { status: 'IN_PROGRESS' },
        include: { quiz: { select: { timeLimitMinutes: true } } },
      });

      let closed = 0;
      for (const attempt of staleAttempts) {
        if (!attempt.quiz.timeLimitMinutes) continue;

        const deadline = new Date(attempt.startedAt.getTime() + attempt.quiz.timeLimitMinutes * 60 * 1000);
        if (now > deadline) {
          await this.prisma.quizAttempt.update({
            where: { id: attempt.id },
            data: { status: 'SUBMITTED', submittedAt: now },
          });
          closed++;
        }
      }

      if (closed) {
        this.logger.log(`QuizAutoClose: auto-submitted ${closed} timed-out attempt(s)`);
      }
    } catch (error) {
      this.logger.error(`QuizAutoCloseJob failed: ${(error as Error).message}`);
    }
  }
}
