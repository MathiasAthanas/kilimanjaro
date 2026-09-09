import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqplib from 'amqplib';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RabbitMqConsumer implements OnModuleInit {
  private readonly logger = new Logger(RabbitMqConsumer.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    await this.bootstrap().catch((err) => this.logger.warn(`RabbitMQ consumer disabled: ${err.message}`));
  }

  private async bootstrap() {
    const url = this.config.get<string>('RABBITMQ_URL', 'amqp://localhost:5672');
    const conn = await amqplib.connect(url);
    const channel = await conn.createChannel();

    conn.on('error', (err: Error) => this.logger.warn(`RabbitMQ connection error: ${err.message}`));
    conn.on('close', () => this.logger.warn('RabbitMQ connection closed — elearning consumer will not reconnect until restart'));

    await channel.assertExchange('student.events', 'topic', { durable: true });
    await channel.assertExchange('dlq.direct', 'direct', { durable: true });

    const queue = 'elearning-service.student';
    await channel.assertQueue(queue, {
      durable: true,
      arguments: { 'x-dead-letter-exchange': 'dlq.direct', 'x-dead-letter-routing-key': queue },
    });
    await channel.assertQueue(`${queue}.dlq`, { durable: true });
    await channel.bindQueue(`${queue}.dlq`, 'dlq.direct', queue);

    // Bind only the events we actually handle — not a blanket # wildcard.
    await channel.bindQueue(queue, 'student.events', 'student.enrolled');
    await channel.bindQueue(queue, 'student.events', 'student.status.changed');

    await channel.prefetch(10);
    channel.consume(queue, async (msg) => {
      if (!msg) return;
      try {
        const payload = JSON.parse(msg.content.toString() || '{}');
        const routingKey: string = msg.fields.routingKey || '';

        if (routingKey === 'student.enrolled' || routingKey === 'student.status.changed') {
          const studentId: string | undefined = payload.studentId;
          await this.refreshEnrollmentCountsForStudent(studentId);
        }

        channel.ack(msg);
      } catch (err: any) {
        this.logger.error(`Failed to handle student event: ${err.message}`);
        channel.nack(msg, false, false);
      }
    });

    this.logger.log('Elearning RabbitMQ student event consumer registered');
  }

  // Recalculate enrolledCount only for courses the affected student is enrolled in.
  // Previously refreshed ALL courses on every student event — O(courses × 2 queries) per event.
  private async refreshEnrollmentCountsForStudent(studentId: string | undefined) {
    if (!studentId) {
      // No student context — fall back to a full refresh but log it.
      this.logger.warn('refreshEnrollmentCounts called without studentId — doing full refresh');
      return this.refreshAllEnrollmentCounts();
    }

    const enrollments = await this.prisma.courseEnrollment.findMany({
      where: { studentId, status: 'ACTIVE' },
      select: { courseSpaceId: true },
    });

    const courseIds = [...new Set(enrollments.map((e) => e.courseSpaceId))];
    if (!courseIds.length) return;

    // Count and update in parallel for only the affected courses.
    await Promise.all(
      courseIds.map(async (courseSpaceId) => {
        const count = await this.prisma.courseEnrollment.count({
          where: { courseSpaceId, status: 'ACTIVE' },
        });
        await this.prisma.courseSpace.update({
          where: { id: courseSpaceId },
          data: { enrolledCount: count },
        });
      }),
    );
  }

  private async refreshAllEnrollmentCounts() {
    const courses = await this.prisma.courseSpace.findMany({
      where: { status: { in: ['ACTIVE', 'DRAFT'] } },
      select: { id: true },
    });
    await Promise.all(
      courses.map(async (course) => {
        const count = await this.prisma.courseEnrollment.count({
          where: { courseSpaceId: course.id, status: 'ACTIVE' },
        });
        await this.prisma.courseSpace.update({ where: { id: course.id }, data: { enrolledCount: count } });
      }),
    );
  }
}
