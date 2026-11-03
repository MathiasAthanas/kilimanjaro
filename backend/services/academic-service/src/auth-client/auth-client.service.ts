import { HttpService } from '@nestjs/axios';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export type AuthUserSummary = {
  id: string;
  role: string;
  isActive: boolean;
  schoolIds: string[];
};

@Injectable()
export class AuthClientService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async getUserById(userId: string): Promise<AuthUserSummary | null> {
    const configuredUrl = this.configService.get<string>('AUTH_SERVICE_URL') || 'http://localhost:3001';
    const baseUrl = configuredUrl.replace(/\/$/, '');
    try {
      const response = await firstValueFrom(
        this.httpService.get<{ data?: { users?: AuthUserSummary[] }; users?: AuthUserSummary[] }>(
          `${baseUrl}/api/v1/auth/internal/users-by-ids`,
          {
            params: { ids: userId },
            headers: { 'X-Internal-Api-Key': this.configService.get<string>('INTERNAL_API_KEY', '') },
            timeout: Number(this.configService.get<string>('AUTH_SERVICE_TIMEOUT_MS', '20000')),
          },
        ),
      );
      const payload = response.data.data ?? response.data;
      return payload.users?.[0] ?? null;
    } catch {
      throw new ServiceUnavailableException('auth-service unavailable while validating the selected teacher');
    }
  }

  /** id -> full name for a batch of users. Best effort: unknown/unreachable ids are simply absent. */
  async getUserNames(userIds: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    const ids = [...new Set(userIds.filter(Boolean))];
    if (!ids.length) return out;
    const configuredUrl = this.configService.get<string>('AUTH_SERVICE_URL') || 'http://localhost:3001';
    const baseUrl = configuredUrl.replace(/\/$/, '');
    try {
      const response = await firstValueFrom(
        this.httpService.get<any>(`${baseUrl}/api/v1/auth/internal/users-by-ids`, {
          params: { ids: ids.join(',') },
          headers: { 'X-Internal-Api-Key': this.configService.get<string>('INTERNAL_API_KEY', '') },
          timeout: 8000,
        }),
      );
      const payload = response.data?.data ?? response.data;
      for (const u of payload?.users ?? []) out.set(u.id, u.fullName || `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim());
    } catch {
      /* names are decoration; never fail the request */
    }
    return out;
  }
}
