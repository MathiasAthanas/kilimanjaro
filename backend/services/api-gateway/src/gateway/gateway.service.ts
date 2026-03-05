import { HttpException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class GatewayService {
  private readonly logger = new Logger(GatewayService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async validateToken(token: string): Promise<{ user: { id: string; role: string; isActive: boolean }; payload: any }> {
    const publicKey = (this.config.get<string>('JWT_PUBLIC_KEY') || '').replace(/\\n/g, '\n');
    if (!publicKey) {
      throw new UnauthorizedException('JWT public key is not configured');
    }

    let payload: any;
    try {
      payload = this.jwtService.verify(token, {
        publicKey,
        algorithms: ['RS256'],
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const authUrl = this.config.get<string>('AUTH_SERVICE_URL') || 'http://localhost:3001';
    const internalApiKey = this.config.get<string>('INTERNAL_API_KEY');

    if (!internalApiKey) {
      throw new UnauthorizedException('Internal API key is not configured');
    }

    const headers = { 'x-internal-api-key': internalApiKey };

    try {
      const jtiResponse = await firstValueFrom(
        this.http.get(`${authUrl}/api/v1/auth/internal/validate-jti/${payload.jti}`, { headers }),
      );

      const isBlacklisted = Boolean(jtiResponse?.data?.data?.blacklisted);
      if (isBlacklisted) {
        throw new UnauthorizedException('Token has been revoked');
      }

      const userResponse = await firstValueFrom(
        this.http.get(`${authUrl}/api/v1/auth/internal/user/${payload.sub}`, { headers }),
      );

      const user = userResponse?.data?.data;
      if (!user?.isActive) {
        throw new UnauthorizedException('Account is inactive');
      }

      return { user, payload };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Token validation failed');
    }
  }

  async proxy(
    serviceUrl: string,
    path: string,
    method: string,
    body?: any,
    headers?: Record<string, string | undefined>,
  ): Promise<any> {
    const url = `${serviceUrl}${path}`;
    this.logger.debug(`Proxying ${method.toUpperCase()} -> ${url}`);

    try {
      const response = await firstValueFrom(
        this.http.request({
          method,
          url,
          data: body,
          headers: {
            'Content-Type': 'application/json',
            ...(headers || {}),
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
      auth: this.config.get<string>('AUTH_SERVICE_URL') || 'http://localhost:3001',
      student: this.config.get<string>('STUDENT_SERVICE_URL') || 'http://localhost:3002',
      academic: this.config.get<string>('ACADEMIC_SERVICE_URL') || 'http://localhost:3003',
      finance: this.config.get<string>('FINANCE_SERVICE_URL') || 'http://localhost:3004',
      notification: this.config.get<string>('NOTIFICATION_SERVICE_URL') || 'http://localhost:3005',
      analytics: this.config.get<string>('ANALYTICS_SERVICE_URL') || 'http://localhost:3006',
    };
    return urls[service];
  }
}
