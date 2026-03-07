import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class DownstreamService {
  private readonly logger = new Logger(DownstreamService.name);

  constructor(private readonly http: HttpService, private readonly config: ConfigService) {}

  private headers() {
    return {
      'X-Internal-Api-Key': this.config.get<string>('INTERNAL_API_KEY', ''),
      'X-Internal-Request': 'true',
    };
  }

  async get<T>(url: string, params?: Record<string, unknown>): Promise<T | null> {
    try {
      const response = await firstValueFrom(this.http.get<T>(url, { params, headers: this.headers(), timeout: 10000 }));
      return response.data;
    } catch (error) {
      this.logger.warn(`Downstream call failed ${url}: ${(error as Error).message}`);
      return null;
    }
  }

  async post<T>(url: string, payload?: unknown): Promise<T | null> {
    try {
      const response = await firstValueFrom(this.http.post<T>(url, payload || {}, { headers: this.headers(), timeout: 10000 }));
      return response.data;
    } catch (error) {
      this.logger.warn(`Downstream call failed ${url}: ${(error as Error).message}`);
      return null;
    }
  }

  async studentIdByAuth(authUserId: string): Promise<string | null> {
    const base = this.config.get<string>('STUDENT_SERVICE_URL', 'http://localhost:3002');
    const payload: any = await this.get(`${base}/students/internal/by-auth/${authUserId}`);
    const data = payload?.data || payload;
    return data?.studentId || null;
  }

  async guardianStudentIds(authUserId: string): Promise<string[]> {
    const base = this.config.get<string>('STUDENT_SERVICE_URL', 'http://localhost:3002');
    const payload: any = await this.get(`${base}/students/internal/guardian-by-auth/${authUserId}`);
    const data = payload?.data || payload;
    return data?.studentIds || [];
  }

  async authUsersByRole(roles: string[]): Promise<Array<{ id: string; role: string }>> {
    if (!roles.length) return [];
    const base = this.config.get<string>('AUTH_SERVICE_URL', 'http://localhost:3001');
    const payload: any =
      (await this.get(`${base}/api/v1/auth/internal/users-by-role`, { roles: roles.join(',') })) ||
      (await this.get(`${base}/auth/internal/users-by-role`, { roles: roles.join(',') }));
    const data = payload?.data || payload;
    const users = data?.users || data || [];
    return Array.isArray(users)
      ? users
          .filter((item) => item?.id)
          .map((item) => ({ id: String(item.id), role: String(item.role || 'UNKNOWN') }))
      : [];
  }

  async dispatchInternalNotification(payload: {
    eventType: string;
    sourceService: string;
    body: string;
    subject?: string;
    recipientIds: string[];
  }) {
    const base = this.config.get<string>('NOTIFICATION_SERVICE_URL', 'http://localhost:3005');
    return this.post(`${base}/notifications/internal/dispatch`, {
      eventType: payload.eventType,
      sourceService: payload.sourceService,
      payload: {
        recipientIds: payload.recipientIds,
        subject: payload.subject || 'Analytics term-end reports ready',
        body: payload.body,
        channel: 'IN_APP',
      },
    });
  }
}
