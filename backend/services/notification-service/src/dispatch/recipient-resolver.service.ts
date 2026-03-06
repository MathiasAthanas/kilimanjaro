import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { DownstreamService } from '../downstream/downstream.service';

@Injectable()
export class RecipientResolverService {
  constructor(
    private readonly redis: RedisService,
    private readonly downstream: DownstreamService,
  ) {}

  private unwrap(payload: any) {
    if (payload && typeof payload === 'object' && 'success' in payload && 'data' in payload) {
      return payload.data;
    }
    return payload;
  }

  async resolveGuardian(studentId: string): Promise<any | null> {
    const key = `notif:guardian:${studentId}`;
    const cached = await this.redis.get<any>(key);
    if (cached) return cached;

    const payload = await this.downstream.guardianForStudent(studentId);
    const data = this.unwrap(payload);
    if (!data) return null;

    await this.redis.set(key, data, 300);
    return data;
  }

  async resolveUser(authUserId: string): Promise<any | null> {
    const key = `notif:user:${authUserId}`;
    const cached = await this.redis.get<any>(key);
    if (cached) return cached;

    const payload = await this.downstream.authUser(authUserId);
    const data = this.unwrap(payload);
    if (!data) return null;

    await this.redis.set(key, data, 300);
    return data;
  }

  async resolveStaffByRole(roles: string[]): Promise<any[]> {
    const joined = roles.join(',');
    const key = `notif:role-users:${joined}`;
    const cached = await this.redis.get<any[]>(key);
    if (cached) return cached;

    const users = (await this.downstream.authUsersByRole(roles)) || [];
    await this.redis.set(key, users, 600);
    return users;
  }

  async resolveClassTeachers(classId: string): Promise<any[]> {
    const key = `notif:class-teachers:${classId}`;
    const cached = await this.redis.get<any[]>(key);
    if (cached) return cached;

    const users = (await this.downstream.classTeachers(classId)) || [];
    await this.redis.set(key, users, 900);
    return users;
  }
}
