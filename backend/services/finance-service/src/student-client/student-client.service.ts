import type { SchoolProfile } from '../common/pdf/pdf-layout';
import { HttpService } from '@nestjs/axios';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface StudentBrief {
  id: string;
  name: string;
  registrationNumber: string;
  classId: string | null;
  className: string | null;
  schoolId: string | null;
}

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

  /** Ids of students matching a name or registration number. Never throws (an outage just finds nothing). */
  async searchStudents(q: string): Promise<string[]> {
    try {
      const payload = await this.get<any>('/students/internal/search', { q, limit: 300 });
      const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
      return rows.map(String);
    } catch {
      return [];
    }
  }

  private termCache: { at: number; terms: Map<string, { name: string; academicYearName: string | null }> } | null = null;

  /** Term and academic-year names for term ids, cached for ten minutes. Unknown ids simply have no entry. */
  async termLabels(): Promise<Map<string, { name: string; academicYearName: string | null }>> {
    if (this.termCache && Date.now() - this.termCache.at < 10 * 60 * 1000) return this.termCache.terms;
    try {
      const payload = await this.get<any>('/students/internal/terms');
      const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
      this.termCache = {
        at: Date.now(),
        terms: new Map(rows.filter((r: any) => r?.id).map((r: any) => [String(r.id), { name: String(r.name ?? ''), academicYearName: r.academicYearName ?? null }])),
      };
    } catch {
      return this.termCache?.terms ?? new Map();
    }
    return this.termCache.terms;
  }

  /** Adds termName / academicYearName to rows that carry a termId. */
  async withTermNames<T extends { termId?: string | null }>(rows: T[]): Promise<Array<T & { termName: string | null; academicYearName: string | null }>> {
    const labels = await this.termLabels();
    return rows.map((r) => ({
      ...r,
      termName: (r.termId && labels.get(r.termId)?.name) || null,
      academicYearName: (r.termId && labels.get(r.termId)?.academicYearName) || null,
    }));
  }

  private schoolCache: { at: number; codes: Map<string, string>; names: Map<string, string>; profiles: Map<string, SchoolProfile> } | null = null;

  private async loadSchools() {
    const fresh = this.schoolCache && Date.now() - this.schoolCache.at < 10 * 60 * 1000;
    if (fresh) return this.schoolCache!;
    try {
      const payload = await this.get<any>('/students/internal/schools');
      const rows = (Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : []).filter((r: any) => r?.id);
      this.schoolCache = {
        at: Date.now(),
        codes: new Map(rows.filter((r: any) => r.code).map((r: any) => [String(r.id), String(r.code)])),
        names: new Map(rows.filter((r: any) => r.name).map((r: any) => [String(r.id), String(r.name)])),
        profiles: new Map(
          rows
            .filter((r: any) => r.name)
            .map((r: any) => [String(r.id), { name: String(r.name), motto: r.motto ?? null, address: r.address ?? null, phone: r.phone ?? null, email: r.email ?? null }]),
        ),
      };
    } catch {
      // keep serving the last good copy
    }
    return this.schoolCache ?? { at: 0, codes: new Map<string, string>(), names: new Map<string, string>(), profiles: new Map<string, SchoolProfile>() };
  }

  /** Short code (e.g. KS-PRI) of a school, used in document numbers. Null if unknown. Cached for ten minutes. */
  async schoolCode(schoolId: string): Promise<string | null> {
    const cache = await this.loadSchools();
    if (!cache.codes.has(schoolId) && cache.at && Date.now() - cache.at > 30 * 1000) {
      this.schoolCache = null;
      return (await this.loadSchools()).codes.get(schoolId) ?? null;
    }
    return cache.codes.get(schoolId) ?? null;
  }

  /** What a school prints on its documents (name, motto, address, phone, email). */
  async schoolProfile(schoolId?: string | null): Promise<SchoolProfile | null> {
    if (!schoolId) return null;
    return (await this.loadSchools()).profiles.get(schoolId) ?? null;
  }

  async schoolName(schoolId?: string | null): Promise<string | null> {
    if (!schoolId) return null;
    return (await this.loadSchools()).names.get(schoolId) ?? null;
  }

  /** Display details (name, registration number, class, school) for student ids. Never throws. */
  async lookupStudents(ids: string[]): Promise<Map<string, StudentBrief>> {
    const unique = [...new Set(ids.filter(Boolean))];
    const map = new Map<string, StudentBrief>();
    for (let i = 0; i < unique.length; i += 200) {
      try {
        const payload = await this.get<any>('/students/internal/by-ids', { ids: unique.slice(i, i + 200).join(',') });
        const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
        for (const r of rows) {
          map.set(String(r.id), {
            id: String(r.id),
            name: String(r.name ?? ''),
            registrationNumber: String(r.registrationNumber ?? ''),
            classId: r.classId ?? null,
            className: r.className ?? null,
            schoolId: r.schoolId ?? null,
          });
        }
      } catch {
        // names are a nicety; the figures must still load
      }
    }
    return map;
  }

  async getAcademic<T>(path: string, params?: Record<string, unknown>, extraHeaders?: Record<string, string>): Promise<T> {
    const baseUrl = this.configService.get<string>('ACADEMIC_SERVICE_URL', 'http://localhost:3003');
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
    const baseUrl = this.configService.get<string>('ACADEMIC_SERVICE_URL', 'http://localhost:3003');
    return this.doRequest<T>('post', baseUrl, path, body, undefined, extraHeaders);
  }

  async patchAcademic<T>(path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<T> {
    const baseUrl = this.configService.get<string>('ACADEMIC_SERVICE_URL', 'http://localhost:3003');
    return this.doRequest<T>('patch', baseUrl, path, body, undefined, extraHeaders);
  }
}
