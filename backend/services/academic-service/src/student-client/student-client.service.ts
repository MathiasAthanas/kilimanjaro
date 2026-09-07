import { identityHeaders } from '@kilimanjaro/security';
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
    const identity = identityHeaders();
    const serviceRole = extra?.['X-User-Role'];
    return {
      'X-Internal-Api-Key': this.configService.get<string>('INTERNAL_API_KEY', ''),
      'X-Internal-Request': 'true',
      ...identity,
      ...(extra || {}),
      // Explicit server-side service operations retain their existing delegated
      // role, while the owning school always comes from verified context.
      ...(serviceRole && serviceRole !== identity['X-User-Role'] ? { 'X-User-Primary-Role': serviceRole, 'X-User-Roles': serviceRole } : {}),
      'X-School-Id': identity['X-School-Id'] || '',
    };
  }

  async get<T>(path: string, params?: Record<string, unknown>, extraHeaders?: Record<string, string>): Promise<T> {
    const baseUrl = this.configService.get<string>('STUDENT_SERVICE_URL', 'http://localhost:3002');
    try {
      const response = await firstValueFrom(
        this.httpService.get<T>(`${baseUrl}${path}`, {
          params,
          headers: this.buildHeaders(extraHeaders),
          timeout: Number(this.configService.get<string>('STUDENT_SERVICE_TIMEOUT_MS', '20000')),
        }),
      );
      return response.data;
    } catch {
      throw new ServiceUnavailableException('student-service unavailable');
    }
  }

  async post<T>(path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<T> {
    const baseUrl = this.configService.get<string>('STUDENT_SERVICE_URL', 'http://localhost:3002');
    try {
      const response = await firstValueFrom(
        this.httpService.post<T>(`${baseUrl}${path}`, body, {
          headers: this.buildHeaders(extraHeaders),
          timeout: Number(this.configService.get<string>('STUDENT_SERVICE_TIMEOUT_MS', '20000')),
        }),
      );
      return response.data;
    } catch {
      throw new ServiceUnavailableException('student-service unavailable');
    }
  }

  async patch<T>(path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<T> {
    const baseUrl = this.configService.get<string>('STUDENT_SERVICE_URL', 'http://localhost:3002');
    try {
      const response = await firstValueFrom(
        this.httpService.patch<T>(`${baseUrl}${path}`, body, {
          headers: this.buildHeaders(extraHeaders),
          timeout: Number(this.configService.get<string>('STUDENT_SERVICE_TIMEOUT_MS', '20000')),
        }),
      );
      return response.data;
    } catch {
      throw new ServiceUnavailableException('student-service unavailable');
    }
  }
}
