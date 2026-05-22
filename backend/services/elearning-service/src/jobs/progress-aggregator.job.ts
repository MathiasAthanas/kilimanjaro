import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProgressAggregatorJob {
  private readonly logger = new Logger(ProgressAggregatorJob.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Runs at midnight — refreshes enrolledCount on all active courses */
  @Cron('0 0 * * *')
  async run(): Promise<void> {
    try {
      const courses = await this.prisma.courseSpace.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true },
      });

      for (const course of courses) {
        const enrolledCount = await this.prisma.courseEnrollment.count({
          where: { courseSpaceId: course.id, status: 'ACTIVE' },
        });
        await this.prisma.courseSpace.update({
          where: { id: course.id },
          data: { enrolledCount },
        });
      }

      this.logger.log(`ProgressAggregator: updated enrolledCount for ${courses.length} course(s)`);
    } catch (error) {
      this.logger.error(`ProgressAggregatorJob failed: ${(error as Error).message}`);
    }
  }
}
