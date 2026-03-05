import { Injectable, Logger } from '@nestjs/common';
import {
  AttendanceStatus,
  AlertSeverity,
  AlertType,
  PairingStatus,
  PairingSuggestedBy,
  Prisma,
  StudentStatus,
  TrendDirection,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitMqService } from '../rabbitmq/rabbitmq.service';
import { RedisService } from '../redis/redis.service';
import { linearRegressionSlope, mean, standardDeviation } from '../common/helpers/statistics.helper';

interface SnapshotPayload {
  studentId: string;
  subjectId: string;
  subjectName: string;
  classId: string;
  termId: string;
  academicYearId: string;
  score: number;
  grade: string;
  assessmentBreakdown: unknown;
  rank?: number;
  totalStudentsInClass?: number;
  teacherId: string;
}

interface EngineRunStats {
  estimatedRecords: number;
  studentsProcessed: number;
  alertsCreated: number;
  alertsResolved: number;
  pairingsCreated: number;
  durationMs: number;
}

@Injectable()
export class PerformanceEngineService {
  private readonly logger = new Logger(PerformanceEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitMq: RabbitMqService,
    private readonly redis: RedisService,
  ) {}

  async getEngineConfig(): Promise<any> {
    const cacheKey = 'engine:config';
    const cached = await this.redis.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    let config = await this.prisma.performanceEngineConfig.findFirst();
    if (!config) {
      config = await this.prisma.performanceEngineConfig.create({ data: {} });
    }

    await this.redis.set(cacheKey, config, 3600);
    return config;
  }

  async updateEngineConfig(input: Record<string, unknown>, userId: string): Promise<unknown> {
    const existing = await this.prisma.performanceEngineConfig.findFirst();
    const updated = existing
      ? await this.prisma.performanceEngineConfig.update({
          where: { id: existing.id },
          data: { ...input, updatedBy: userId },
        })
      : await this.prisma.performanceEngineConfig.create({
          data: { ...input, updatedBy: userId },
        });

    await this.redis.del('engine:config', 'performance:school:summary');
    await this.redis.delByPattern('performance:class:*:summary');
    await this.redis.delByPattern('performance:*:trends');
    await this.redis.delByPattern('performance:*:alerts:active');
    return updated;
  }

  private async invalidatePerformanceCache(studentId: string): Promise<void> {
    await this.redis.del(`performance:${studentId}:trends`, `performance:${studentId}:alerts:active`, 'performance:school:summary');
    await this.redis.delByPattern('performance:class:*:summary');
  }

  async ingestSnapshot(payload: SnapshotPayload): Promise<void> {
    const snapshot = await this.prisma.performanceSnapshot.upsert({
      where: {
        studentId_subjectId_termId: {
          studentId: payload.studentId,
          subjectId: payload.subjectId,
          termId: payload.termId,
        },
      },
      create: {
        ...payload,
        assessmentBreakdown: payload.assessmentBreakdown as Prisma.InputJsonValue,
      },
      update: {
        ...payload,
        assessmentBreakdown: payload.assessmentBreakdown as Prisma.InputJsonValue,
      },
    });

    await this.analyzeStudentSubject(payload.studentId, payload.subjectId, snapshot.id);
    await this.recordPairingOutcome(payload.studentId, payload.subjectId, payload.score);
    await this.invalidatePerformanceCache(payload.studentId);
  }

  private countConsecutiveDirection(scores: number[], direction: 'up' | 'down'): number {
    let count = 0;
    for (let i = scores.length - 1; i > 0; i -= 1) {
      const previous = scores[i - 1];
      const current = scores[i];
      const qualifies = direction === 'up' ? current > previous : current < previous;
      if (!qualifies) {
        break;
      }
      count += 1;
    }
    return count;
  }

  async analyzeStudentSubject(studentId: string, subjectId: string, triggeredBySnapshotId?: string): Promise<{
    alertsCreated: number;
    alertsResolved: number;
    pairingsCreated: number;
  }> {
    const [config, student, snapshots] = await Promise.all([
      this.getEngineConfig(),
      this.prisma.student.findUnique({ where: { id: studentId } }),
      this.prisma.performanceSnapshot.findMany({
        where: { studentId, subjectId },
        include: { term: true },
        orderBy: [{ term: { startDate: 'asc' } }, { createdAt: 'asc' }],
      }),
    ]);

    if (!student || snapshots.length === 0) {
      return { alertsCreated: 0, alertsResolved: 0, pairingsCreated: 0 };
    }

    const scores = snapshots.map((snapshot) => snapshot.score);
    const avg = mean(scores);
    const stdDev = standardDeviation(scores);
    const slope = snapshots.length >= 2 ? linearRegressionSlope(scores) : 0;

    const currentSnapshot = snapshots[snapshots.length - 1];
    const previousSnapshot = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;
    const currentScore = currentSnapshot.score;
    const previousScore = previousSnapshot?.score;

    const consecutiveDeclines = this.countConsecutiveDirection(scores, 'down');
    const consecutiveImprovements = this.countConsecutiveDirection(scores, 'up');

    let direction: TrendDirection = TrendDirection.INSUFFICIENT_DATA;
    if (snapshots.length >= 2) {
      if (Math.abs(slope) < 1.0 && stdDev < 10) {
        direction = TrendDirection.STABLE;
      } else if (slope >= 2.0 && consecutiveImprovements >= 2) {
        direction = TrendDirection.IMPROVING;
      } else if (slope <= -2.0 && consecutiveDeclines >= 2) {
        direction = TrendDirection.DECLINING;
      } else if (stdDev >= config.volatilityStdDevThreshold) {
        direction = TrendDirection.VOLATILE;
      } else {
        direction = TrendDirection.STABLE;
      }
    }

    await this.prisma.performanceTrend.upsert({
      where: {
        studentId_subjectId: {
          studentId,
          subjectId,
        },
      },
      create: {
        studentId,
        subjectId,
        subjectName: currentSnapshot.subjectName,
        currentScore,
        previousScore,
        averageScore: avg,
        highestScore: Math.max(...scores),
        lowestScore: Math.min(...scores),
        trendDirection: direction,
        trendSlope: snapshots.length >= 2 ? slope : null,
        consecutiveDeclines,
        consecutiveImprovements,
        termCount: snapshots.length,
      },
      update: {
        subjectName: currentSnapshot.subjectName,
        currentScore,
        previousScore,
        averageScore: avg,
        highestScore: Math.max(...scores),
        lowestScore: Math.min(...scores),
        trendDirection: direction,
        trendSlope: snapshots.length >= 2 ? slope : null,
        consecutiveDeclines,
        consecutiveImprovements,
        termCount: snapshots.length,
      },
    });

    const triggerSnapshotId = triggeredBySnapshotId ?? currentSnapshot.id;

    const alertResult = await this.evaluateAlerts({
      config,
      student,
      snapshots,
      currentScore,
      previousScore,
      slope,
      stdDev,
      consecutiveDeclines,
      triggerSnapshotId,
      subjectId,
      subjectName: currentSnapshot.subjectName,
      teacherId: currentSnapshot.teacherId,
    });

    let pairingsCreated = 0;

    const highRiskTypes: AlertType[] = [
      AlertType.FAILURE_RISK,
      AlertType.AT_RISK,
      AlertType.CHRONIC_UNDERPERFORMER,
      AlertType.SUDDEN_DECLINE,
    ];

    for (const alert of alertResult.createdAlerts) {
      if (highRiskTypes.includes(alert.alertType)) {
        const pairing = await this.suggestPeerPairing({
          studentId,
          subjectId,
          subjectName: alert.subjectName,
          classId: currentSnapshot.classId,
          termId: currentSnapshot.termId,
          studentScore: currentScore,
          teacherId: currentSnapshot.teacherId,
        });

        if (pairing?.id) {
          pairingsCreated += 1;
          await this.publishAlert(alert.id, pairing.id);
        }
      }
    }

    await this.invalidatePerformanceCache(studentId);

    return {
      alertsCreated: alertResult.createdCount,
      alertsResolved: alertResult.resolvedCount,
      pairingsCreated,
    };
  }

  private async evaluateAlerts(input: {
    config: any;
    student: { id: string; firstName: string; lastName: string };
    snapshots: Array<{ score: number }>;
    currentScore: number;
    previousScore: number | undefined;
    slope: number;
    stdDev: number;
    consecutiveDeclines: number;
    triggerSnapshotId: string;
    subjectId: string;
    subjectName: string;
    teacherId: string;
  }): Promise<{
    createdAlerts: Array<{ id: string; alertType: AlertType; subjectName: string }>;
    createdCount: number;
    resolvedCount: number;
  }> {
    const {
      config,
      student,
      snapshots,
      currentScore,
      previousScore,
      slope,
      stdDev,
      consecutiveDeclines,
      triggerSnapshotId,
      subjectId,
      subjectName,
    } = input;

    const name = `${student.firstName} ${student.lastName}`;
    const lastN = snapshots.slice(-Math.max(config.chronicUnderperformanceTerms, 3));

    const existingUnresolvedRiskCount = await this.prisma.performanceAlert.count({
      where: {
        studentId: student.id,
        subjectId,
        isResolved: false,
        alertType: {
          in: [AlertType.AT_RISK, AlertType.CHRONIC_UNDERPERFORMER, AlertType.FAILURE_RISK],
        },
      },
    });

    const conditions: Array<{
      type: AlertType;
      active: boolean;
      severity: AlertSeverity;
      thresholdValue: number;
      message: string;
      positive?: boolean;
    }> = [
      {
        type: AlertType.FAILURE_RISK,
        active: currentScore < config.failureThreshold,
        severity: AlertSeverity.CRITICAL,
        thresholdValue: config.failureThreshold,
        message: `${name} is scoring ${currentScore.toFixed(1)}% in ${subjectName}, below the passing mark of ${config.failureThreshold}%`,
      },
      {
        type: AlertType.AT_RISK,
        active: currentScore < config.atRiskThreshold && currentScore >= config.failureThreshold,
        severity: AlertSeverity.HIGH,
        thresholdValue: config.atRiskThreshold,
        message: `${name} is at risk in ${subjectName} with a score of ${currentScore.toFixed(1)}%`,
      },
      {
        type: AlertType.SUDDEN_DECLINE,
        active: typeof previousScore === 'number' && previousScore - currentScore >= config.suddenDeclineThreshold,
        severity: AlertSeverity.HIGH,
        thresholdValue: config.suddenDeclineThreshold,
        message:
          typeof previousScore === 'number'
            ? `${name} dropped ${(previousScore - currentScore).toFixed(1)} points in ${subjectName} this term (from ${previousScore.toFixed(1)}% to ${currentScore.toFixed(1)}%)`
            : `${name} had a sudden decline in ${subjectName}`,
      },
      {
        type: AlertType.CHRONIC_UNDERPERFORMER,
        active:
          snapshots.length >= config.chronicUnderperformanceTerms &&
          snapshots
            .slice(-config.chronicUnderperformanceTerms)
            .every((snapshot) => snapshot.score < config.atRiskThreshold),
        severity: AlertSeverity.HIGH,
        thresholdValue: config.atRiskThreshold,
        message: `${name} has been performing below ${config.atRiskThreshold}% in ${subjectName} for ${config.chronicUnderperformanceTerms} consecutive terms`,
      },
      {
        type: AlertType.VOLATILE_PERFORMANCE,
        active: snapshots.length >= 3 && stdDev >= config.volatilityStdDevThreshold,
        severity: AlertSeverity.MEDIUM,
        thresholdValue: config.volatilityStdDevThreshold,
        message: `${name} shows highly inconsistent performance in ${subjectName} (std dev: ${stdDev.toFixed(2)})`,
      },
      {
        type: AlertType.CONSECUTIVE_DECLINE,
        active: consecutiveDeclines >= config.consecutiveDeclineTerms,
        severity: consecutiveDeclines >= 3 ? AlertSeverity.HIGH : AlertSeverity.MEDIUM,
        thresholdValue: config.consecutiveDeclineTerms,
        message: `${name} has declined in ${subjectName} for ${consecutiveDeclines} consecutive terms`,
      },
      {
        type: AlertType.RAPID_IMPROVEMENT,
        active:
          typeof previousScore === 'number' &&
          currentScore - previousScore >= config.rapidImprovementThreshold,
        severity: AlertSeverity.LOW,
        thresholdValue: config.rapidImprovementThreshold,
        message:
          typeof previousScore === 'number'
            ? `${name} improved by ${(currentScore - previousScore).toFixed(1)} points in ${subjectName} this term from ${previousScore.toFixed(1)}% to ${currentScore.toFixed(1)}%`
            : `${name} improved rapidly in ${subjectName}`,
        positive: true,
      },
      {
        type: AlertType.CONSISTENT_EXCELLENCE,
        active:
          lastN.length >= 3 &&
          lastN.slice(-3).every((snapshot) => snapshot.score >= config.excellenceThreshold),
        severity: AlertSeverity.LOW,
        thresholdValue: config.excellenceThreshold,
        message: `${name} has maintained excellent performance in ${subjectName} for 3 consecutive terms`,
        positive: true,
      },
      {
        type: AlertType.RECOVERED,
        active:
          typeof previousScore === 'number' &&
          previousScore < config.atRiskThreshold &&
          currentScore >= config.atRiskThreshold &&
          existingUnresolvedRiskCount > 0,
        severity: AlertSeverity.LOW,
        thresholdValue: config.atRiskThreshold,
        message: `${name} has recovered in ${subjectName}, now scoring ${currentScore.toFixed(1)}%`,
        positive: true,
      },
    ];

    const createdAlerts: Array<{ id: string; alertType: AlertType; subjectName: string }> = [];
    let resolvedCount = 0;

    for (const condition of conditions) {
      const unresolved = await this.prisma.performanceAlert.findFirst({
        where: {
          studentId: student.id,
          subjectId,
          alertType: condition.type,
          isResolved: false,
        },
      });

      if (condition.active && !unresolved) {
        const alert = await this.prisma.performanceAlert.create({
          data: {
            studentId: student.id,
            subjectId,
            subjectName,
            alertType: condition.type,
            severity: condition.severity,
            message: condition.message,
            triggeredBySnapshotId: triggerSnapshotId,
            currentScore,
            thresholdValue: condition.thresholdValue,
            trendSlope: slope,
          },
        });

        createdAlerts.push({ id: alert.id, alertType: alert.alertType, subjectName });
        await this.publishAlert(alert.id);
      }

      if (!condition.active && unresolved) {
        await this.prisma.performanceAlert.update({
          where: { id: unresolved.id },
          data: { isResolved: true, resolvedAt: new Date(), resolvedById: 'SYSTEM' },
        });
        resolvedCount += 1;
      }
    }

    if (conditions.find((condition) => condition.type === AlertType.RECOVERED)?.active) {
      const result = await this.prisma.performanceAlert.updateMany({
        where: {
          studentId: student.id,
          subjectId,
          isResolved: false,
          alertType: {
            in: [AlertType.AT_RISK, AlertType.CHRONIC_UNDERPERFORMER, AlertType.FAILURE_RISK],
          },
        },
        data: { isResolved: true, resolvedAt: new Date(), resolvedById: 'SYSTEM' },
      });
      resolvedCount += result.count;
    }

    return {
      createdAlerts,
      createdCount: createdAlerts.length,
      resolvedCount,
    };
  }

  private async publishAlert(alertId: string, pairingId?: string): Promise<void> {
    const [config, alert] = await Promise.all([
      this.getEngineConfig(),
      this.prisma.performanceAlert.findUnique({
        where: { id: alertId },
        include: {
          student: true,
          triggeredBySnapshot: {
            include: {
              class: true,
            },
          },
        },
      }),
    ]);

    if (!alert) {
      return;
    }

    const payload = {
      alertId: alert.id,
      studentId: alert.studentId,
      studentName: `${alert.student.firstName} ${alert.student.lastName}`,
      subjectName: alert.subjectName,
      alertType: alert.alertType,
      severity: alert.severity,
      message: alert.message,
      teacherId: alert.triggeredBySnapshot.teacherId,
      academicDeptNotify: Boolean(config.autoNotifyAcademicDept),
      parentNotify:
        (alert.severity === AlertSeverity.CRITICAL || alert.severity === AlertSeverity.HIGH)
          ? Boolean(config.autoNotifyParent)
          : false,
      pairingId: pairingId ?? null,
    };

    if (alert.severity === AlertSeverity.CRITICAL || alert.severity === AlertSeverity.HIGH || alert.severity === AlertSeverity.MEDIUM) {
      await this.rabbitMq.publish('performance.alert.created', payload);
    }

    if (
      alert.alertType === AlertType.RAPID_IMPROVEMENT ||
      alert.alertType === AlertType.CONSISTENT_EXCELLENCE ||
      alert.alertType === AlertType.RECOVERED
    ) {
      await this.rabbitMq.publish('performance.alert.positive', payload);
    }
  }

  private normalizeTrendScore(slope: number): number {
    const normalized = (slope + 10) / 20;
    return Math.max(0, Math.min(1, normalized));
  }

  private async buildPeerCandidates(input: {
    subjectId: string;
    termId: string;
    studentId: string;
    studentScore: number;
    classId: string;
    classLevel?: number;
    excludeClassId?: string;
    peerSuggestionMinPeerScore: number;
    peerSuggestionMaxScoreGap: number;
  }): Promise<Array<{ peerId: string; score: number; candidateScore: number; reason: string }>> {
    const termSnapshots = await this.prisma.performanceSnapshot.findMany({
      where: {
        subjectId: input.subjectId,
        termId: input.termId,
        studentId: { not: input.studentId },
        score: { gte: input.peerSuggestionMinPeerScore },
        ...(input.excludeClassId ? { classId: { not: input.excludeClassId } } : { classId: input.classId }),
        ...(input.classLevel !== undefined
          ? {
              class: {
                level: input.classLevel,
              },
            }
          : {}),
      },
      include: {
        student: true,
      },
      orderBy: { score: 'desc' },
    });

    const latestByStudent = new Map<string, (typeof termSnapshots)[number]>();
    for (const snapshot of termSnapshots) {
      if (!latestByStudent.has(snapshot.studentId)) {
        latestByStudent.set(snapshot.studentId, snapshot);
      }
    }

    const candidates: Array<{ peerId: string; score: number; candidateScore: number; reason: string }> = [];

    for (const snapshot of latestByStudent.values()) {
      if (snapshot.student.status !== StudentStatus.ACTIVE) {
        continue;
      }

      const gap = snapshot.score - input.studentScore;
      if (gap > input.peerSuggestionMaxScoreGap) {
        continue;
      }

      const activePairing = await this.prisma.peerPairing.findFirst({
        where: {
          studentId: input.studentId,
          peerId: snapshot.studentId,
          subjectId: input.subjectId,
          status: PairingStatus.ACTIVE,
        },
      });

      if (activePairing) {
        continue;
      }

      const peerSnapshots = await this.prisma.performanceSnapshot.findMany({
        where: { studentId: snapshot.studentId, subjectId: input.subjectId },
        orderBy: [{ term: { startDate: 'asc' } }, { createdAt: 'asc' }],
      });

      const peerScores = peerSnapshots.map((item) => item.score);
      const consistencyScore = (1 - standardDeviation(peerScores) / 100) * 100;
      const trendScore = this.normalizeTrendScore(linearRegressionSlope(peerScores)) * 100;
      const finalScore = (0.5 * snapshot.score) + (0.3 * consistencyScore) + (0.2 * trendScore);

      candidates.push({
        peerId: snapshot.studentId,
        score: snapshot.score,
        candidateScore: finalScore,
        reason: `Top scorer in ${snapshot.subjectName} with consistent trend`,
      });
    }

    return candidates.sort((a, b) => b.candidateScore - a.candidateScore);
  }

  async suggestPeerPairing(input: {
    studentId: string;
    subjectId: string;
    subjectName: string;
    classId: string;
    termId: string;
    studentScore: number;
    teacherId: string;
  }): Promise<{ id: string } | null> {
    const config = await this.getEngineConfig();

    const existingActivePairing = await this.prisma.peerPairing.findFirst({
      where: {
        studentId: input.studentId,
        subjectId: input.subjectId,
        status: {
          in: [PairingStatus.SUGGESTED, PairingStatus.ACTIVE],
        },
      },
    });

    if (existingActivePairing) {
      return null;
    }

    const studentClass = await this.prisma.class.findUnique({ where: { id: input.classId } });

    let candidates = await this.buildPeerCandidates({
      subjectId: input.subjectId,
      termId: input.termId,
      studentId: input.studentId,
      studentScore: input.studentScore,
      classId: input.classId,
      peerSuggestionMinPeerScore: config.peerSuggestionMinPeerScore,
      peerSuggestionMaxScoreGap: config.peerSuggestionMaxScoreGap,
    });

    if (candidates.length === 0 && config.peerSuggestionSameClass && studentClass) {
      candidates = await this.buildPeerCandidates({
        subjectId: input.subjectId,
        termId: input.termId,
        studentId: input.studentId,
        studentScore: input.studentScore,
        classId: input.classId,
        classLevel: studentClass.level,
        excludeClassId: input.classId,
        peerSuggestionMinPeerScore: config.peerSuggestionMinPeerScore,
        peerSuggestionMaxScoreGap: config.peerSuggestionMaxScoreGap,
      });
    }

    if (candidates.length === 0) {
      this.logger.warn(`No eligible peer candidates for student ${input.studentId} / subject ${input.subjectId}`);
      return null;
    }

    const best = candidates[0];
    const term = await this.prisma.term.findUnique({ where: { id: input.termId } });

    const pairing = await this.prisma.peerPairing.create({
      data: {
        studentId: input.studentId,
        peerId: best.peerId,
        subjectId: input.subjectId,
        subjectName: input.subjectName,
        classId: input.classId,
        termId: input.termId,
        suggestedBy: PairingSuggestedBy.SYSTEM,
        status: PairingStatus.SUGGESTED,
        reason: best.reason,
        studentScoreAtPairing: input.studentScore,
        peerScoreAtPairing: best.score,
        expiresAt: term?.endDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      include: {
        student: true,
        peer: true,
      },
    });

    await this.rabbitMq.publish('performance.pairing.suggested', {
      pairingId: pairing.id,
      studentId: pairing.studentId,
      studentName: `${pairing.student.firstName} ${pairing.student.lastName}`,
      peerId: pairing.peerId,
      peerName: `${pairing.peer.firstName} ${pairing.peer.lastName}`,
      subjectName: pairing.subjectName,
      reason: pairing.reason,
      teacherId: input.teacherId,
    });

    return { id: pairing.id };
  }

  async recordPairingOutcome(studentId: string, subjectId: string, score: number): Promise<void> {
    const pairing = await this.prisma.peerPairing.findFirst({
      where: {
        studentId,
        subjectId,
        status: PairingStatus.COMPLETED,
        outcomeScore: null,
      },
      orderBy: { completedAt: 'desc' },
    });

    if (!pairing) {
      return;
    }

    const delta = score - pairing.studentScoreAtPairing;

    await this.prisma.peerPairing.update({
      where: { id: pairing.id },
      data: {
        outcomeScore: score,
        outcomeDelta: delta,
      },
    });

    if (delta > 0) {
      this.logger.log(`Pairing ${pairing.id} produced positive outcome delta ${delta.toFixed(2)}`);
    }

    await this.rabbitMq.publish('pairing.outcome.recorded', {
      pairingId: pairing.id,
      studentId,
      subjectId,
      outcomeDelta: delta,
    });
  }

  async runScope(scope: 'student' | 'class' | 'all', studentId?: string, classId?: string): Promise<EngineRunStats> {
    const start = Date.now();

    const config = await this.getEngineConfig();
    if (!config.analysisEnabled) {
      return {
        estimatedRecords: 0,
        studentsProcessed: 0,
        alertsCreated: 0,
        alertsResolved: 0,
        pairingsCreated: 0,
        durationMs: Date.now() - start,
      };
    }

    let pairs: Array<{ studentId: string; subjectId: string }> = [];

    if (scope === 'student' && studentId) {
      const snapshots = await this.prisma.performanceSnapshot.findMany({
        where: { studentId },
        distinct: ['subjectId'],
        select: { subjectId: true },
      });
      pairs = snapshots.map((item) => ({ studentId, subjectId: item.subjectId }));
    } else if (scope === 'class' && classId) {
      pairs = await this.prisma.performanceSnapshot.findMany({
        where: { classId },
        distinct: ['studentId', 'subjectId'],
        select: { studentId: true, subjectId: true },
      });
    } else {
      pairs = await this.prisma.performanceSnapshot.findMany({
        distinct: ['studentId', 'subjectId'],
        select: { studentId: true, subjectId: true },
      });
    }

    let alertsCreated = 0;
    let alertsResolved = 0;
    let pairingsCreated = 0;

    for (const pair of pairs) {
      const stats = await this.analyzeStudentSubject(pair.studentId, pair.subjectId);
      alertsCreated += stats.alertsCreated;
      alertsResolved += stats.alertsResolved;
      pairingsCreated += stats.pairingsCreated;
    }

    const studentsProcessed = new Set(pairs.map((item) => item.studentId)).size;
    return {
      estimatedRecords: pairs.length,
      studentsProcessed,
      alertsCreated,
      alertsResolved,
      pairingsCreated,
      durationMs: Date.now() - start,
    };
  }

  async runScopeAsync(scope: 'student' | 'class' | 'all', studentId?: string, classId?: string): Promise<number> {
    const estimate =
      scope === 'student' && studentId
        ? await this.prisma.performanceSnapshot.count({ where: { studentId } })
        : scope === 'class' && classId
          ? await this.prisma.performanceSnapshot.count({ where: { classId } })
          : await this.prisma.performanceSnapshot.count();

    setImmediate(async () => {
      try {
        const stats = await this.runScope(scope, studentId, classId);
        await this.rabbitMq.publish('engine.analysis.completed', {
          studentsProcessed: stats.studentsProcessed,
          alertsCreated: stats.alertsCreated,
          alertsResolved: stats.alertsResolved,
          pairingsCreated: stats.pairingsCreated,
          duration: stats.durationMs,
        });
      } catch (error) {
        this.logger.error('Async engine run failed', error as Error);
      }
    });

    return estimate;
  }

  async expireStalePairings(): Promise<number> {
    const config = await this.getEngineConfig();
    if (!config.analysisEnabled) {
      return 0;
    }

    const result = await this.prisma.peerPairing.updateMany({
      where: {
        status: { in: [PairingStatus.SUGGESTED, PairingStatus.ACTIVE] },
        expiresAt: { lt: new Date() },
      },
      data: { status: PairingStatus.EXPIRED },
    });

    return result.count;
  }

  async weeklyDigest(): Promise<void> {
    const config = await this.getEngineConfig();
    if (!config.analysisEnabled) {
      return;
    }

    const alerts = await this.prisma.performanceAlert.findMany({
      where: {
        isResolved: false,
        severity: { in: [AlertSeverity.HIGH, AlertSeverity.CRITICAL] },
      },
      include: {
        triggeredBySnapshot: true,
      },
    });

    const pairings = await this.prisma.peerPairing.findMany({
      where: {
        status: { in: [PairingStatus.SUGGESTED, PairingStatus.ACTIVE] },
      },
      include: {
        student: true,
        peer: true,
      },
    });

    const grouped = new Map<string, typeof alerts>();
    for (const alert of alerts) {
      const teacherId = alert.triggeredBySnapshot.teacherId;
      const current = grouped.get(teacherId) ?? [];
      current.push(alert);
      grouped.set(teacherId, current);
    }

    for (const [teacherId, teacherAlerts] of grouped.entries()) {
      await this.rabbitMq.publish('performance.weekly.digest', {
        teacherId,
        alerts: teacherAlerts.map((alert) => ({
          alertId: alert.id,
          studentId: alert.studentId,
          subjectId: alert.subjectId,
          severity: alert.severity,
          type: alert.alertType,
        })),
        pairings: pairings.filter((pairing) => teacherAlerts.some((alert) => alert.studentId === pairing.studentId)),
      });
    }

    await this.rabbitMq.publish('performance.weekly.digest', {
      audience: 'ACADEMIC_QA',
      alerts: alerts.length,
      pairings: pairings.length,
    });
  }

  async attendanceCorrelationCheck(): Promise<void> {
    const config = await this.getEngineConfig();
    if (!config.analysisEnabled) {
      return;
    }

    const students = await this.prisma.student.findMany({
      where: { status: StudentStatus.ACTIVE },
      select: { id: true },
    });

    for (const student of students) {
      const lastThirtyDays = new Date();
      lastThirtyDays.setDate(lastThirtyDays.getDate() - 30);

      const attendance = await this.prisma.attendanceRecord.findMany({
        where: {
          studentId: student.id,
          date: { gte: lastThirtyDays },
        },
      });

      if (attendance.length === 0) {
        continue;
      }

      const present = attendance.filter((record) => record.status === AttendanceStatus.PRESENT).length;
      const rate = (present / attendance.length) * 100;

      const recentSnapshots = await this.prisma.performanceSnapshot.findMany({
        where: { studentId: student.id },
        orderBy: [{ term: { startDate: 'desc' } }, { createdAt: 'desc' }],
        take: 2,
      });

      if (recentSnapshots.length < 2) {
        continue;
      }

      const declinedBy = recentSnapshots[1].score - recentSnapshots[0].score;
      const alert = await this.prisma.performanceAlert.findFirst({
        where: {
          studentId: student.id,
          subjectId: recentSnapshots[0].subjectId,
          alertType: AlertType.ATTENDANCE_IMPACT,
          isResolved: false,
        },
      });

      if (rate < 75 && declinedBy >= 10 && !alert) {
        await this.prisma.performanceAlert.create({
          data: {
            studentId: student.id,
            subjectId: recentSnapshots[0].subjectId,
            subjectName: recentSnapshots[0].subjectName,
            alertType: AlertType.ATTENDANCE_IMPACT,
            severity: AlertSeverity.MEDIUM,
            message: 'Attendance is likely impacting student performance',
            triggeredBySnapshotId: recentSnapshots[0].id,
            currentScore: recentSnapshots[0].score,
            thresholdValue: 75,
          },
        });
      }

      if (rate >= 85 && alert) {
        await this.prisma.performanceAlert.update({
          where: { id: alert.id },
          data: {
            isResolved: true,
            resolvedAt: new Date(),
            resolvedById: 'SYSTEM',
          },
        });
      }
    }
  }
}