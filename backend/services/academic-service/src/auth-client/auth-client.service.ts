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
}
