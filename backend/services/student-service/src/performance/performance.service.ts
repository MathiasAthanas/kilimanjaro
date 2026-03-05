import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AlertSeverity,
  AlertType,
  PairingStatus,
  PairingSuggestedBy,
  Prisma,
  TrendDirection,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { RabbitMqService } from '../rabbitmq/rabbitmq.service';
import { PerformanceFilterDto } from './dto/performance-filter.dto';
import { CreatePairingDto } from './dto/create-pairing.dto';
import { UpdatePairingStatusDto } from './dto/update-pairing-status.dto';

@Injectable()
export class PerformanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly rabbitMq: RabbitMqService,
  ) {}

  private async assertScope(user: { id: string; role: string }, studentId: string): Promise<void> {
    if (user.role === 'PARENT') {
      const link = await this.prisma.studentGuardianLink.findFirst({
        where: {
          studentId,
          isActive: true,
          guardian: { authUserId: user.id },
        },
      });
      if (!link) {
        throw new ForbiddenException('Parent access denied');
      }
    }

    if (user.role === 'STUDENT') {
      const student = await this.prisma.student.findUnique({ where: { id: studentId } });
      if (!student || student.authUserId !== user.id) {
        throw new ForbiddenException('Student access denied');
      }
    }
  }

  async profile(studentId: string, user?: { id: string; role: string }): Promise<unknown> {
    if (user) {
      await this.assertScope(user, studentId);
    }

    const cacheKey = `performance:${studentId}:trends`;
    const cached = await this.redis.get<unknown>(cacheKey);
    if (cached) {
      return cached;
    }

    const [trends, alerts, pairings, snapshots] = await Promise.all([
      this.prisma.performanceTrend.findMany({ where: { studentId } }),
      this.prisma.performanceAlert.findMany({ where: { studentId, isResolved: false } }),
      this.prisma.peerPairing.findMany({
        where: { studentId, status: { in: [PairingStatus.SUGGESTED, PairingStatus.ACTIVE] } },
      }),
      this.prisma.performanceSnapshot.findMany({
        where: { studentId },
        include: { term: true },
        orderBy: [{ term: { startDate: 'asc' } }, { createdAt: 'asc' }],
      }),
    ]);

    const chartData = snapshots.reduce<Record<string, Array<{ termName: string; score: number }>>>((acc, snapshot) => {
      if (!acc[snapshot.subjectId]) {
        acc[snapshot.subjectId] = [];
      }
      acc[snapshot.subjectId].push({ termName: snapshot.term.name, score: snapshot.score });
      return acc;
    }, {});

    const payload = { trends, alerts, pairings, chartData };
    await this.redis.set(cacheKey, payload, 900);
    return payload;
  }

  async subjectDeepDive(studentId: string, subjectId: string, user?: { id: string; role: string }): Promise<unknown> {
    if (user) {
      await this.assertScope(user, studentId);
    }

    const [snapshots, trend, alerts, pairings] = await Promise.all([
      this.prisma.performanceSnapshot.findMany({
        where: { studentId, subjectId },
        include: { term: true },
        orderBy: [{ term: { startDate: 'asc' } }, { createdAt: 'asc' }],
      }),
      this.prisma.performanceTrend.findUnique({
        where: {
          studentId_subjectId: { studentId, subjectId },
        },
      }),
      this.prisma.performanceAlert.findMany({
        where: { studentId, subjectId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.peerPairing.findMany({
        where: { studentId, subjectId },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { snapshots, trend, alerts, pairings };
  }

  async alerts(filters: PerformanceFilterDto, user: { id: string; role: string }): Promise<unknown> {
    const where: Prisma.PerformanceAlertWhereInput = {
      alertType: filters.alertType,
      severity: filters.severity,
      isResolved: filters.isResolved,
      subjectId: filters.subjectId,
      ...(filters.classId || filters.teacherId
        ? {
            triggeredBySnapshot: {
              ...(filters.classId ? { classId: filters.classId } : {}),
              ...(filters.teacherId ? { teacherId: filters.teacherId } : {}),
            },
          }
        : {}),
    };

    if (user.role === 'TEACHER') {
      where.OR = [
        { triggeredBySnapshot: { teacherId: user.id } },
        { triggeredBySnapshot: { class: { classTeacherId: user.id } } },
      ];
    }

    return this.prisma.performanceAlert.findMany({
      where,
      include: {
        student: true,
        triggeredBySnapshot: true,
      },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async alertsByClass(classId: string, user: { id: string; role: string }): Promise<unknown> {
    if (user.role === 'TEACHER') {
      const classEntity = await this.prisma.class.findUnique({ where: { id: classId } });
      if (!classEntity) {
        throw new NotFoundException('Class not found');
      }

      const allowed = classEntity.classTeacherId === user.id;
      const hasSubject = await this.prisma.performanceSnapshot.findFirst({
        where: { classId, teacherId: user.id },
      });

      if (!allowed && !hasSubject) {
        throw new ForbiddenException('Teacher cannot access this class alerts');
      }
    }

    const alerts = await this.prisma.performanceAlert.findMany({
      where: {
        isResolved: false,
        triggeredBySnapshot: { classId },
      },
      include: { student: true },
      orderBy: { createdAt: 'desc' },
    });

    const grouped = alerts.reduce<Record<string, unknown[]>>((acc, alert) => {
      if (!acc[alert.subjectName]) {
        acc[alert.subjectName] = [];
      }
      acc[alert.subjectName].push(alert);
      return acc;
    }, {});

    return grouped;
  }

  async resolveAlert(alertId: string, resolutionNote: string | undefined, resolvedById: string): Promise<unknown> {
    return this.prisma.performanceAlert.update({
      where: { id: alertId },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
        resolvedById,
        resolutionNote,
      },
    });
  }

  async listPairings(filters: PerformanceFilterDto): Promise<unknown> {
    return this.prisma.peerPairing.findMany({
      where: {
        status: filters.status,
        classId: filters.classId,
        subjectId: filters.subjectId,
        termId: filters.termId,
      },
      include: {
        student: true,
        peer: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private toSuggestedBy(role: string): PairingSuggestedBy {
    if (role === 'PRINCIPAL') return PairingSuggestedBy.PRINCIPAL;
    if (role === 'HEAD_OF_DEPARTMENT') return PairingSuggestedBy.HOD;
    return PairingSuggestedBy.TEACHER;
  }

  async manualPairing(dto: CreatePairingDto, role: string): Promise<unknown> {
    const studentSnapshot = await this.prisma.performanceSnapshot.findFirst({
      where: {
        studentId: dto.studentId,
        subjectId: dto.subjectId,
        termId: dto.termId,
      },
      orderBy: { createdAt: 'desc' },
    });

    const peerSnapshot = await this.prisma.performanceSnapshot.findFirst({
      where: {
        studentId: dto.peerId,
        subjectId: dto.subjectId,
        termId: dto.termId,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!studentSnapshot || !peerSnapshot) {
      throw new NotFoundException('Performance snapshots required to create pairing');
    }

    const term = await this.prisma.term.findUnique({ where: { id: dto.termId } });
    const pairing = await this.prisma.peerPairing.create({
      data: {
        studentId: dto.studentId,
        peerId: dto.peerId,
        subjectId: dto.subjectId,
        subjectName: dto.subjectName,
        classId: studentSnapshot.classId,
        termId: dto.termId,
        suggestedBy: this.toSuggestedBy(role),
        status: PairingStatus.SUGGESTED,
        reason: dto.reason,
        studentScoreAtPairing: studentSnapshot.score,
        peerScoreAtPairing: peerSnapshot.score,
        expiresAt: term?.endDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    await this.rabbitMq.publish('performance.pairing.suggested', {
      pairingId: pairing.id,
      studentId: pairing.studentId,
      peerId: pairing.peerId,
      subjectName: pairing.subjectName,
      reason: pairing.reason,
    });

    return pairing;
  }

  async updatePairingStatus(pairingId: string, dto: UpdatePairingStatusDto): Promise<unknown> {
    return this.prisma.peerPairing.update({
      where: { id: pairingId },
      data: {
        status: dto.status,
        activatedAt: dto.status === PairingStatus.ACTIVE ? new Date() : undefined,
        completedAt: dto.status === PairingStatus.COMPLETED ? new Date() : undefined,
      },
    });
  }

  async classSummary(classId: string): Promise<unknown> {
    const cacheKey = `performance:class:${classId}:summary`;
    const cached = await this.redis.get<unknown>(cacheKey);
    if (cached) {
      return cached;
    }

    const snapshots = await this.prisma.performanceSnapshot.findMany({
      where: { classId },
      include: { student: true },
    });

    const grouped = snapshots.reduce<Record<string, typeof snapshots>>((acc, snapshot) => {
      if (!acc[snapshot.subjectId]) {
        acc[snapshot.subjectId] = [];
      }
      acc[snapshot.subjectId].push(snapshot);
      return acc;
    }, {});

    const summary = Object.values(grouped).map((group) => {
      const sorted = [...group].sort((a, b) => b.score - a.score);
      const subjectName = group[0].subjectName;
      const classAverage = group.reduce((acc, item) => acc + item.score, 0) / group.length;

      return {
        subjectName,
        classAverage,
        topPerformer: sorted[0] ? { studentId: sorted[0].studentId, score: sorted[0].score } : null,
        bottomPerformer: sorted[sorted.length - 1]
          ? { studentId: sorted[sorted.length - 1].studentId, score: sorted[sorted.length - 1].score }
          : null,
        atRiskCount: group.filter((item) => item.score < 50 && item.score >= 40).length,
        criticalCount: group.filter((item) => item.score < 40).length,
        improvingCount: 0,
      };
    });

    await this.redis.set(cacheKey, summary, 1800);
    return summary;
  }

  async schoolSummary(): Promise<unknown> {
    const cacheKey = 'performance:school:summary';
    const cached = await this.redis.get<unknown>(cacheKey);
    if (cached) {
      return cached;
    }

    const [atRiskCount, criticalCount, improvingCount, pairings] = await Promise.all([
      this.prisma.performanceAlert.count({
        where: { isResolved: false, alertType: AlertType.AT_RISK },
      }),
      this.prisma.performanceAlert.count({
        where: { isResolved: false, alertType: AlertType.FAILURE_RISK },
      }),
      this.prisma.performanceTrend.count({ where: { trendDirection: TrendDirection.IMPROVING } }),
      this.prisma.peerPairing.findMany({ where: { status: PairingStatus.COMPLETED, outcomeDelta: { not: null } } }),
    ]);

    const positiveOutcomes = pairings.filter((pairing) => (pairing.outcomeDelta ?? 0) > 0).length;
    const pairingEffectivenessRate = pairings.length > 0 ? (positiveOutcomes / pairings.length) * 100 : 0;

    const payload = {
      atRiskCount,
      criticalCount,
      improvingCount,
      pairingEffectivenessRate,
    };

    await this.redis.set(cacheKey, payload, 3600);
    return payload;
  }

  async pairingEffectiveness(): Promise<unknown> {
    const pairings = await this.prisma.peerPairing.findMany({
      where: {
        status: PairingStatus.COMPLETED,
        outcomeDelta: { not: null },
      },
    });

    const positiveCount = pairings.filter((pairing) => (pairing.outcomeDelta ?? 0) > 0).length;
    const averageImprovement =
      pairings.length > 0
        ? pairings.reduce((acc, pairing) => acc + (pairing.outcomeDelta ?? 0), 0) / pairings.length
        : 0;

    return {
      total: pairings.length,
      positiveCount,
      positiveRate: pairings.length > 0 ? (positiveCount / pairings.length) * 100 : 0,
      averageImprovement,
    };
  }
}
