import { HttpService } from '@nestjs/axios';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class StudentClientService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private buildHeaders(extra?: Record<string, string>): Record<string, string> {
    return {
      'X-Internal-Api-Key': this.configService.get<string>('INTERNAL_API_KEY', ''),
      'X-Internal-Request': 'true',
      ...(extra || {}),
    };
  }

  private async doRequest<T>(
    method: 'get' | 'post' | 'patch',
    baseUrl: string,
    path: string,
    payload?: unknown,
    params?: Record<string, unknown>,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    try {
      const req = this.httpService.request<T>({
        method,
        url: `${baseUrl}${path}`,
        data: method === 'get' ? undefined : payload,
        params,
        headers: this.buildHeaders(extraHeaders),
        timeout: Number(this.configService.get<string>('STUDENT_SERVICE_TIMEOUT_MS', '20000')),
      });
      const response = await firstValueFrom(req);
      return response.data;
    } catch {
      throw new ServiceUnavailableException('downstream service unavailable');
    }
  }

  async get<T>(path: string, params?: Record<string, unknown>, extraHeaders?: Record<string, string>): Promise<T> {
    const baseUrl = this.configService.get<string>('STUDENT_SERVICE_URL', 'http://localhost:3002');
    return this.doRequest<T>('get', baseUrl, path, undefined, params, extraHeaders);
  }

  async getAcademic<T>(path: string, params?: Record<string, unknown>, extraHeaders?: Record<string, string>): Promise<T> {
    const baseUrl = this.configService.get<string>('ACADEMIC_SERVICE_URL', 'http://localhost:3013');
    return this.doRequest<T>('get', baseUrl, path, undefined, params, extraHeaders);
  }

  async post<T>(path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<T> {
    const baseUrl = this.configService.get<string>('STUDENT_SERVICE_URL', 'http://localhost:3002');
    return this.doRequest<T>('post', baseUrl, path, body, undefined, extraHeaders);
  }

  async patch<T>(path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<T> {
    const baseUrl = this.configService.get<string>('STUDENT_SERVICE_URL', 'http://localhost:3002');
    return this.doRequest<T>('patch', baseUrl, path, body, undefined, extraHeaders);
  }

  async postAcademic<T>(path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<T> {
    const baseUrl = this.configService.get<string>('ACADEMIC_SERVICE_URL', 'http://localhost:3013');
    return this.doRequest<T>('post', baseUrl, path, body, undefined, extraHeaders);
  }

  async patchAcademic<T>(path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<T> {
    const baseUrl = this.configService.get<string>('ACADEMIC_SERVICE_URL', 'http://localhost:3013');
    return this.doRequest<T>('patch', baseUrl, path, body, undefined, extraHeaders);
  }
}
