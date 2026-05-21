import { HttpException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { getServiceUrls } from '../common/config/service-urls.config';

export type UiServiceName = 'auth' | 'student' | 'academic' | 'finance' | 'notification' | 'analytics';

export interface GatewayUser {
  id: string;
  role: string;
  email?: string | null;
}

export interface UiEnvelope<T = unknown> {
  data: T;
  meta: {
    generatedAt: string;
    source: 'gateway-ui';
    partial: boolean;
    warnings: string[];
  };
}

interface DownstreamCall {
  service: UiServiceName;
  path: string;
  params?: Record<string, unknown>;
}

interface PartialResult<T> {
  data: T;
  warning?: string;
}

@Injectable()
export class UiApiService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  envelope<T>(data: T, warnings: string[] = []): UiEnvelope<T> {
    return {
      data,
      meta: {
        generatedAt: new Date().toISOString(),
        source: 'gateway-ui',
        partial: warnings.length > 0,
        warnings,
      },
    };
  }

  async get<T = unknown>(
    service: UiServiceName,
    path: string,
    user?: GatewayUser,
    params?: Record<string, unknown>,
  ): Promise<T> {
    const urls = getServiceUrls(this.configService);
    const internalApiKey = this.configService.get<string>('INTERNAL_API_KEY') || '';
    const timeoutMs = Number(this.configService.get<string>('PROXY_TIMEOUT_MS', '30000'));
    const outboundPath = service === 'student' ? path : `/api/v1${path}`;

    try {
      const response = await firstValueFrom(
        this.httpService.request({
          method: 'GET',
          url: `${urls[service]}${outboundPath}`,
          params,
          timeout: timeoutMs,
          headers: this.internalHeaders(internalApiKey, user),
          validateStatus: () => true,
        }),
      );

      if (response.status >= 400) {
        const message = response.data?.message || `${service} request failed`;
        throw new HttpException(message, response.status);
      }

      return this.unwrap<T>(response.data);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new ServiceUnavailableException(`${service} service temporarily unavailable`);
    }
  }

  async tryGet<T>(
    call: DownstreamCall,
    fallback: T,
    user?: GatewayUser,
  ): Promise<PartialResult<T>> {
    try {
      const data = await this.get<T>(call.service, call.path, user, call.params);
      return { data };
    } catch (error) {
      return {
        data: fallback,
        warning: `${call.service}${call.path}: ${this.errorMessage(error)}`,
      };
    }
  }

  async collect<T extends Record<string, unknown>>(
    calls: Record<keyof T, DownstreamCall & { fallback: unknown }>,
    user?: GatewayUser,
  ): Promise<{ data: T; warnings: string[] }> {
    const entries = await Promise.all(
      Object.entries(calls).map(async ([key, call]) => {
        const result = await this.tryGet(call, call.fallback, user);
        return [key, result.data, result.warning] as const;
      }),
    );

    const data = {} as T;
    const warnings: string[] = [];

    for (const [key, value, warning] of entries) {
      (data as Record<string, unknown>)[key] = value;
      if (warning) warnings.push(warning);
    }

    return { data, warnings };
  }

  summarizeList(value: unknown): { count: number; items: unknown[] } {
    const items = this.asArray(value);
    return { count: items.length, items };
  }

  asArray(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;
    if (Array.isArray((value as { items?: unknown[] })?.items)) return (value as { items: unknown[] }).items;
    if (Array.isArray((value as { data?: unknown[] })?.data)) return (value as { data: unknown[] }).data;
    if (Array.isArray((value as { records?: unknown[] })?.records)) return (value as { records: unknown[] }).records;
    if (Array.isArray((value as { results?: unknown[] })?.results)) return (value as { results: unknown[] }).results;
    return [];
  }

  private internalHeaders(internalApiKey: string, user?: GatewayUser): Record<string, string> {
    const headers: Record<string, string> = {
      'X-Internal-Api-Key': internalApiKey,
      'X-Internal-Request': 'true',
    };

    if (user) {
      headers['X-User-Id'] = user.id;
      headers['X-User-Role'] = user.role;
      headers['X-User-Email'] = user.email || '';
    }

    return headers;
  }

  private unwrap<T>(payload: unknown): T {
    if (
      payload &&
      typeof payload === 'object' &&
      'success' in payload &&
      'data' in payload
    ) {
      return (payload as { data: T }).data;
    }
    return payload as T;
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === 'string') return response;
      if (response && typeof response === 'object' && 'message' in response) {
        const message = (response as { message?: unknown }).message;
        return Array.isArray(message) ? message.join(', ') : String(message);
      }
    }
    if (error instanceof Error) return error.message;
    return 'unavailable';
  }
}
