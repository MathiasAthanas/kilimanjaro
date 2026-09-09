import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface ParentAccountResult {
  id: string;
  created: boolean;
  phoneNumber: string;
  temporaryPassword?: string;
}

interface StudentAccountResult {
  id: string;
  temporaryPassword?: string;
}

/**
 * Thin HTTP client for auth-service internal endpoints, authenticated with
 * the shared INTERNAL_API_KEY. Used by the admissions conversion flow so
 * parent phone deduplication happens server-side (same behaviour as the
 * dashboard bulk CSV import).
 */
@Injectable()
export class AuthClientService {
  private readonly logger = new Logger(AuthClientService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = (this.configService.get<string>('AUTH_SERVICE_URL') || 'http://localhost:3001').replace(/\/$/, '');
    this.apiKey = this.configService.get<string>('INTERNAL_API_KEY') || '';
  }

  private async request<T>(method: 'POST' | 'PATCH', path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}/api/v1${path}`;
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-internal-api-key': this.apiKey,
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      this.logger.error(`Auth service unreachable at ${url}: ${(error as Error).message}`);
      throw new ServiceUnavailableException('Auth service is unreachable');
    }

    const payload = (await response.json().catch(() => null)) as { data?: T; message?: string } | T | null;
    if (!response.ok) {
      const message =
        payload && typeof payload === 'object' && 'message' in payload
          ? String((payload as { message?: string }).message)
          : `Auth service responded ${response.status}`;
      this.logger.error(`Auth internal call ${path} failed: ${message}`);
      throw new ServiceUnavailableException(message);
    }

    // auth-service wraps responses as { success, data } via its interceptor
    if (payload && typeof payload === 'object' && 'data' in (payload as Record<string, unknown>)) {
      return (payload as { data: T }).data;
    }
    return payload as T;
  }

  async ensureParentAccount(input: {
    firstName: string;
    lastName: string;
    phoneNumber: string;
    email?: string;
    actorId: string;
    schoolId: string;
  }): Promise<ParentAccountResult> {
    return this.request<ParentAccountResult>('POST', '/auth/internal/parent-account', input);
  }

  async createStudentAccount(input: {
    firstName: string;
    lastName: string;
    actorId: string;
    schoolId: string;
  }): Promise<StudentAccountResult> {
    return this.request<StudentAccountResult>('POST', '/auth/internal/student-account', input);
  }

  async setRegistrationNumber(userId: string, registrationNumber: string, actorId: string): Promise<void> {
    await this.request<unknown>('PATCH', `/auth/internal/users/${userId}/registration-number`, {
      registrationNumber,
      actorId,
    });
  }
}
