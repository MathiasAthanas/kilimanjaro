import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';

const ANALYTICS_ALLOWED = new Set([
  'SYSTEM_ADMIN',
  'BOARD_DIRECTOR',
  'MANAGING_DIRECTOR',
  'PRINCIPAL',
  'ACADEMIC_QA',
  'FINANCE',
  'HEAD_OF_DEPARTMENT',
]);

const ANNOUNCEMENTS_ALLOWED = new Set([
  'SYSTEM_ADMIN',
  'PRINCIPAL',
  'MANAGING_DIRECTOR',
  'HEAD_OF_DEPARTMENT',
  'TEACHER',
]);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as { role?: string } | undefined;
    const role = user?.role;

    const explicitRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (explicitRoles?.length && (!role || !explicitRoles.includes(role))) {
      throw new ForbiddenException('Insufficient role permissions');
    }

    const normalized = this.normalizePath(request.path || request.originalUrl || '');
    const method = String(request.method || 'GET').toUpperCase();

    if (normalized.startsWith('/analytics/') || normalized === '/analytics') {
      if (!role || !ANALYTICS_ALLOWED.has(role)) {
        throw new ForbiddenException('Analytics routes require leadership role access');
      }
    }

    if (normalized === '/notifications/announcements' && method === 'POST') {
      if (!role || !ANNOUNCEMENTS_ALLOWED.has(role)) {
        throw new ForbiddenException('Insufficient role for announcements publishing');
      }
    }

    return true;
  }

  private normalizePath(path: string): string {
    const trimmed = path.startsWith('/api/v1') ? path.substring('/api/v1'.length) : path;
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }
}
