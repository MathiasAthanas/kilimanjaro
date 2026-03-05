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
      this.check(`${urls.auth}/health`),
      this.check(`${urls.student}/health`),
      this.check(`${urls.academic}/health`),
      this.check(`${urls.finance}/health`),
      this.check(`${urls.notification}/health`),
      this.check(`${urls.analytics}/health`),
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
      await firstValueFrom(this.httpService.get(url, { timeout: 3000 }));
      return 'reachable';
    } catch {
      return 'unreachable';
    }
  }
}
