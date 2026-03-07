import { HttpException, HttpStatus, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Request } from 'express';
import { getServiceUrls } from '../common/config/service-urls.config';

export interface ResolvedRoute {
  serviceName: 'auth' | 'student' | 'academic' | 'finance' | 'notification' | 'analytics';
  serviceUrl: string;
  incomingPath: string;
  outboundPath: string;
}

@Injectable()
export class ProxyService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  resolveRoute(path: string): ResolvedRoute {
    const normalized = this.normalizePath(path);
    const urls = getServiceUrls(this.configService);

    if (normalized.startsWith('/auth/')) {
      return this.route('auth', urls.auth, path, normalized);
    }
    if (normalized === '/auth') {
      return this.route('auth', urls.auth, path, '/auth');
    }
    if (normalized.startsWith('/students/') || normalized === '/students' || normalized.startsWith('/student/') || normalized === '/student') {
      const canonical = normalized.replace(/^\/student(\/|$)/, '/students$1');
      return this.route('student', urls.student, path, canonical);
    }
    if (normalized.startsWith('/academics/') || normalized === '/academics' || normalized.startsWith('/academic/') || normalized === '/academic') {
      const canonical = normalized.replace(/^\/academic(\/|$)/, '/academics$1');
      return this.route('academic', urls.academic, path, canonical);
    }
    if (normalized.startsWith('/finance/') || normalized === '/finance') {
      return this.route('finance', urls.finance, path, normalized);
    }
    if (normalized.startsWith('/notifications/') || normalized === '/notifications' || normalized.startsWith('/notification/') || normalized === '/notification') {
      const canonical = normalized.replace(/^\/notification(\/|$)/, '/notifications$1');
      return this.route('notification', urls.notification, path, canonical);
    }
    if (normalized.startsWith('/analytics/') || normalized === '/analytics') {
      return this.route('analytics', urls.analytics, path, normalized);
    }

    throw new HttpException('No matching route prefix found', HttpStatus.NOT_FOUND);
  }

  async forward(
    req: Request,
    route: ResolvedRoute,
    auth?: { id: string; role: string; email?: string | null },
  ): Promise<{ statusCode: number; data: unknown }> {
    const internalApiKey = this.configService.get<string>('INTERNAL_API_KEY') || '';
    const timeoutMs = Number(this.configService.get<string>('PROXY_TIMEOUT_MS', '30000'));

    const headers: Record<string, string> = {};

    const accept = req.headers['accept'];
    const contentType = req.headers['content-type'];
    const acceptLang = req.headers['accept-language'];

    if (typeof accept === 'string') headers.Accept = accept;
    if (typeof contentType === 'string') headers['Content-Type'] = contentType;
    if (typeof acceptLang === 'string') headers['Accept-Language'] = acceptLang;

    // strip potentially injected identity headers and set trusted ones
    headers['X-Internal-Api-Key'] = internalApiKey;
    headers['X-Internal-Request'] = 'true';

    // Auth service still expects bearer token on protected auth routes.
    if (route.serviceName === 'auth') {
      const authHeader = req.headers['authorization'];
      if (typeof authHeader === 'string') {
        headers.Authorization = authHeader;
      }
    }

    if (auth) {
      headers['X-User-Id'] = auth.id;
      headers['X-User-Role'] = auth.role;
      headers['X-User-Email'] = auth.email || '';
    }

    const targetUrl = `${route.serviceUrl}${route.outboundPath}`;

    try {
      const response = await firstValueFrom(
        this.httpService.request({
          method: req.method,
          url: targetUrl,
          params: req.query,
          data: ['GET', 'HEAD'].includes(req.method.toUpperCase()) ? undefined : req.body,
          headers,
          timeout: timeoutMs,
          validateStatus: () => true,
        }),
      );

      return { statusCode: response.status, data: response.data };
    } catch {
      throw new ServiceUnavailableException('Service temporarily unavailable');
    }
  }

  private normalizePath(path: string): string {
    const raw = path || '/';
    const noPrefix = raw.startsWith('/api/v1') ? raw.substring('/api/v1'.length) || '/' : raw;
    return noPrefix.startsWith('/') ? noPrefix : `/${noPrefix}`;
  }

  private route(
    serviceName: ResolvedRoute['serviceName'],
    serviceUrl: string,
    incomingPath: string,
    normalizedPath: string,
  ): ResolvedRoute {
    const needsVersionPrefix = serviceName !== 'student';
    const outboundPath = needsVersionPrefix ? `/api/v1${normalizedPath}` : normalizedPath;
    return {
      serviceName,
      serviceUrl,
      incomingPath,
      outboundPath,
    };
  }
}
