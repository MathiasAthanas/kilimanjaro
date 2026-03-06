import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { StudentClientService } from '../student-client/student-client.service';
import { RabbitMqService } from '../rabbitmq/rabbitmq.service';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { ROLES } from '../common/constants/roles';
import { AccessControlService } from '../common/helpers/access-control.service';

@Injectable()
export class PerformanceProxyService {
  constructor(
    private readonly studentClient: StudentClientService,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly rabbitMq: RabbitMqService,
    private readonly accessControl: AccessControlService,
  ) {}

  private unwrap<T>(payload: any): T {
    if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) {
      return payload.data as T;
    }

    return payload as T;
  }

  private buildCacheKey(path: string, query?: Record<string, unknown>): string {
    return `performance-proxy:${path}:${JSON.stringify(query || {})}`;
  }

  async alerts(query: Record<string, unknown>, user: RequestUser) {
    const finalQuery = { ...query };
    if (user.role === ROLES.TEACHER) {
      finalQuery.teacherId = user.id;
    }

    const cacheKey = this.buildCacheKey('alerts', finalQuery);
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return cached;
    }

    const payload = await this.studentClient.get<any>(
      '/api/v1/students/performance/alerts',
      finalQuery,
      { 'X-User-Id': user.id, 'X-User-Role': user.role },
    );

    const data = this.unwrap(payload);
    await this.redis.set(cacheKey, data, 300);
    return data;
  }

  async alertsByClass(classId: string, user: RequestUser) {
    const payload = await this.studentClient.get<any>(
      `/api/v1/students/performance/alerts/class/${classId}`,
      {},
      { 'X-User-Id': user.id, 'X-User-Role': user.role },
    );

    return this.unwrap(payload);
  }

  async resolveAlert(alertId: string, body: { resolutionNote: string }, user: RequestUser) {
    const payload = await this.studentClient.patch<any>(
      `/api/v1/students/performance/alerts/${alertId}/resolve`,
      body,
      { 'X-User-Id': user.id, 'X-User-Role': user.role },
    );

    const resolved = this.unwrap<any>(payload);

    if (resolved?.studentId) {
      await this.prisma.academicIntervention.create({
        data: {
          alertId,
          studentId: resolved.studentId,
          subjectId: resolved.subjectId,
          subjectName: resolved.subjectName,
          type: 'ALERT_RESOLVED',
          performedById: user.id,
          performedByRole: user.role,
          note: body.resolutionNote,
        },
      });
    }

    return resolved;
  }

  async escalateAlert(alertId: string, body: { studentId: string; subjectName?: string; note: string }, user: RequestUser) {
    const intervention = await this.prisma.academicIntervention.create({
      data: {
        alertId,
        studentId: body.studentId,
        subjectName: body.subjectName,
        type: 'ALERT_ESCALATED',
        performedById: user.id,
        performedByRole: user.role,
        note: body.note,
      },
    });

    await this.rabbitMq.publish('alert.escalated', {
      alertId,
      studentId: body.studentId,
      subjectName: body.subjectName,
      escalatedById: user.id,
      escalatedByRole: user.role,
    });

    return intervention;
  }

  async pairings(query: Record<string, unknown>, user: RequestUser) {
    const payload = await this.studentClient.get<any>('/api/v1/students/performance/pairings', query, {
      'X-User-Id': user.id,
      'X-User-Role': user.role,
    });

    return this.unwrap(payload);
  }

  private async pairingAction(
    pairingId: string,
    status: 'ACTIVE' | 'REJECTED',
    reason: string | undefined,
    user: RequestUser,
    interventionType: 'PAIRING_ACTIVATED' | 'PAIRING_REJECTED',
  ) {
    const payload = await this.studentClient.patch<any>(
      `/api/v1/students/performance/pairings/${pairingId}/status`,
      { status, reason },
      { 'X-User-Id': user.id, 'X-User-Role': user.role },
    );

    const result = this.unwrap<any>(payload);

    if (result?.studentId) {
      await this.prisma.academicIntervention.create({
        data: {
          pairingId,
          studentId: result.studentId,
          subjectId: result.subjectId,
          subjectName: result.subjectName,
          type: interventionType,
          performedById: user.id,
          performedByRole: user.role,
          note: reason || status,
        },
      });
    }

    return result;
  }

  activatePairing(pairingId: string, user: RequestUser) {
    return this.pairingAction(pairingId, 'ACTIVE', undefined, user, 'PAIRING_ACTIVATED');
  }

  rejectPairing(pairingId: string, reason: string, user: RequestUser) {
    return this.pairingAction(pairingId, 'REJECTED', reason, user, 'PAIRING_REJECTED');
  }

  async createPairing(body: any, user: RequestUser) {
    const payload = await this.studentClient.post<any>('/api/v1/students/performance/pairings', body, {
      'X-User-Id': user.id,
      'X-User-Role': user.role,
    });

    const result = this.unwrap<any>(payload);

    if (result?.studentId) {
      await this.prisma.academicIntervention.create({
        data: {
          pairingId: result.id,
          studentId: result.studentId,
          subjectId: result.subjectId,
          subjectName: result.subjectName,
          type: 'MANUAL_PAIRING_CREATED',
          performedById: user.id,
          performedByRole: user.role,
          note: body.reason || 'Manual pairing created',
        },
      });
    }

    return result;
  }

  async pairingsEffectiveness(user: RequestUser) {
    const payload = await this.studentClient.get<any>('/api/v1/students/performance/pairings/effectiveness', {}, {
      'X-User-Id': user.id,
      'X-User-Role': user.role,
    });

    return this.unwrap(payload);
  }

  async studentProfile(studentId: string, user: RequestUser) {
    if (user.role === ROLES.PARENT) {
      await this.accessControl.assertParentOwnsStudent(user.id, studentId);
    }
    if (user.role === ROLES.STUDENT) {
      await this.accessControl.assertStudentOwnsRecord(user.id, studentId);
    }

    const [localHistory, performance] = await Promise.all([
      this.prisma.termResult.findMany({
        where: { studentId },
        orderBy: { createdAt: 'desc' },
      }),
      this.studentClient.get<any>(`/api/v1/students/performance/${studentId}`, {}, {
        'X-User-Id': user.id,
        'X-User-Role': user.role,
      }),
    ]);

    const perf = this.unwrap<any>(performance);

    const payload = {
      student: perf?.student,
      academicHistory: localHistory,
      performanceTrends: perf?.performanceTrends || perf?.trends || [],
      activeAlerts: perf?.activeAlerts || [],
      activePairings: perf?.activePairings || [],
      overallSummary: perf?.overallSummary || {},
    };

    if ([ROLES.PARENT, ROLES.STUDENT].includes(user.role as any)) {
      return {
        ...payload,
        activeAlerts: (payload.activeAlerts || []).map((item: any) => ({
          alertType: item.alertType,
          severity: item.severity,
          subjectName: item.subjectName,
          message: item.message,
        })),
      };
    }

    return payload;
  }

  async classSummary(classId: string, user: RequestUser) {
    const [local, remote] = await Promise.all([
      this.prisma.termResult.groupBy({
        by: ['subjectId', 'subjectName'],
        where: { classId },
        _avg: { weightedTotal: true },
      }),
      this.studentClient.get<any>(`/api/v1/students/performance/summary/class/${classId}`, {}, {
        'X-User-Id': user.id,
        'X-User-Role': user.role,
      }),
    ]);

    return {
      academicSubjectAverages: local,
      performanceSummary: this.unwrap(remote),
    };
  }

  async schoolSummary(user: RequestUser) {
    const [local, remote] = await Promise.all([
      this.prisma.termResult.groupBy({
        by: ['subjectId', 'subjectName'],
        _avg: { weightedTotal: true },
      }),
      this.studentClient.get<any>('/api/v1/students/performance/summary/school', {}, {
        'X-User-Id': user.id,
        'X-User-Role': user.role,
      }),
    ]);

    return {
      subjectPerformanceRankings: local.sort((a, b) => (b._avg.weightedTotal || 0) - (a._avg.weightedTotal || 0)),
      performanceSummary: this.unwrap(remote),
    };
  }

  runEngine(body: any, user: RequestUser) {
    return this.studentClient.post('/api/v1/students/performance/engine/run', body, {
      'X-User-Id': user.id,
      'X-User-Role': user.role,
    });
  }

  getEngineConfig(user: RequestUser) {
    return this.studentClient.get('/api/v1/students/performance/engine/config', {}, {
      'X-User-Id': user.id,
      'X-User-Role': user.role,
    });
  }

  async updateEngineConfig(body: any, user: RequestUser) {
    const payload = await this.studentClient.patch('/api/v1/students/performance/engine/config', body, {
      'X-User-Id': user.id,
      'X-User-Role': user.role,
    });

    await this.prisma.academicAuditLog.create({
      data: {
        action: 'ENGINE_CONFIG_UPDATED',
        performedById: user.id,
        payload: body,
      },
    });

    return this.unwrap(payload);
  }
}
