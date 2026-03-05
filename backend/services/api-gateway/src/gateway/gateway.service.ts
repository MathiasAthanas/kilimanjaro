import { Injectable, UnauthorizedException, Logger, HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { SERVICE_URLS } from '@kilimanjaro/types';

@Injectable()
export class GatewayService {
  private readonly logger = new Logger(GatewayService.name);

  constructor(
    private http: HttpService,
    private config: ConfigService,
  ) {}

  // ─── Validate token with Auth Service ────────────────────────────────────────

  async validateToken(token: string): Promise<any> {
    try {
      const authUrl = this.config.get('AUTH_SERVICE_URL', SERVICE_URLS.AUTH);
      const response = await firstValueFrom(
        this.http.post(`${authUrl}/api/v1/auth/validate`, { token }),
      );
      return response.data.data;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  // ─── Proxy request to a downstream service ───────────────────────────────────

  async proxy(
    serviceUrl: string,
    path: string,
    method: string,
    body?: any,
    headers?: Record<string, string>,
  ): Promise<any> {
    const url = `${serviceUrl}${path}`;
    this.logger.debug(`Proxying ${method.toUpperCase()} → ${url}`);

    try {
      const response = await firstValueFrom(
        this.http.request({
          method,
          url,
          data: body,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
        }),
      );
      return response.data;
    } catch (error: any) {
      const status = error?.response?.status || 500;
      const message = error?.response?.data?.message || 'Service error';
      throw new HttpException(message, status);
    }
  }

  getServiceUrl(service: string): string {
    const urls: Record<string, string> = {
      auth: this.config.get('AUTH_SERVICE_URL', SERVICE_URLS.AUTH),
      student: this.config.get('STUDENT_SERVICE_URL', SERVICE_URLS.STUDENT),
      academic: this.config.get('ACADEMIC_SERVICE_URL', SERVICE_URLS.ACADEMIC),
      finance: this.config.get('FINANCE_SERVICE_URL', SERVICE_URLS.FINANCE),
      notification: this.config.get('NOTIFICATION_SERVICE_URL', SERVICE_URLS.NOTIFICATION),
      analytics: this.config.get('ANALYTICS_SERVICE_URL', SERVICE_URLS.ANALYTICS),
    };
    return urls[service];
  }
}
