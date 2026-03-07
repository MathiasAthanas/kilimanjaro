import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { getServiceUrls } from '../common/config/service-urls.config';

@Injectable()
export class HealthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  async getStatus() {
    const urls = getServiceUrls(this.configService);

    const checks = await Promise.all([
      this.check(`${urls.auth}/api/v1/auth`),
      this.check(`${urls.student}/students/health`),
      this.check(`${urls.academic}/api/v1/academics/health`),
      this.check(`${urls.finance}/api/v1/finance/health`),
      this.check(`${urls.notification}/api/v1/notifications/health`),
      this.check(`${urls.analytics}/api/v1/analytics/health`),
    ]);

    return {
      status: 'ok',
      gateway: 'api-gateway',
      timestamp: new Date().toISOString(),
      services: {
        auth: checks[0],
        students: checks[1],
        academics: checks[2],
        finance: checks[3],
        notifications: checks[4],
        analytics: checks[5],
      },
    };
  }

  private async check(url: string): Promise<'reachable' | 'unreachable'> {
    try {
      await firstValueFrom(
        this.httpService.get(url, {
          timeout: 3000,
          validateStatus: () => true,
        }),
      );
      return 'reachable';
    } catch {
      return 'unreachable';
    }
  }
}
