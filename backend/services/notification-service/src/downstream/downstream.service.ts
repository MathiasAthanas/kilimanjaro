import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class DownstreamService {
  private readonly logger = new Logger(DownstreamService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private headers(extra?: Record<string, string>) {
    return {
      'X-Internal-Api-Key': this.config.get<string>('INTERNAL_API_KEY', ''),
      'X-Internal-Request': 'true',
      ...(extra || {}),
    };
  }

  private async get<T>(base: string, path: string, params?: Record<string, unknown>): Promise<T | null> {
    try {
      const response = await firstValueFrom(
        this.http.get<T>(`${base}${path}`, {
          params,
          headers: this.headers(),
          timeout: 10000,
        }),
      );
      return response.data;
    } catch (error) {
      this.logger.warn(`Downstream request failed ${base}${path}: ${(error as Error).message}`);
      return null;
    }
  }

  async authUser(userId: string): Promise<any | null> {
    const base = this.config.get<string>('AUTH_SERVICE_URL', 'http://localhost:3001');
    return this.get<any>(base, `/auth/internal/user/${userId}`);
  }

  async authUsersByRole(roles: string[]): Promise<any[] | null> {
    const base = this.config.get<string>('AUTH_SERVICE_URL', 'http://localhost:3001');
    const data = await this.get<any>(base, '/auth/internal/users-by-role', { roles: roles.join(',') });
    return data?.data || data?.users || data || [];
  }

  async guardianForStudent(studentId: string): Promise<any | null> {
    const base = this.config.get<string>('STUDENT_SERVICE_URL', 'http://localhost:3002');
    return this.get<any>(base, `/students/internal/guardian-for-student/${studentId}`);
  }

  async classTeachers(classId: string): Promise<any[] | null> {
    const base = this.config.get<string>('STUDENT_SERVICE_URL', 'http://localhost:3002');
    const data = await this.get<any>(base, `/students/internal/class/${classId}/teachers`);
    return data?.data || data?.teachers || data || [];
  }

  async activeHighAlerts(): Promise<any[] | null> {
    const base = this.config.get<string>('STUDENT_SERVICE_URL', 'http://localhost:3002');
    const data = await this.get<any>(base, '/students/internal/performance-alerts', { severities: 'HIGH,CRITICAL' });
    return data?.data || data?.items || data || [];
  }
}
