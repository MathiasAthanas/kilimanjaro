import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';

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

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: { role?: string } }>();
    const userRole = request.user?.role;

    if (!userRole) {
      throw new ForbiddenException('Missing role header');
    }

        // ── Group super-roles (multi-school expansion) ──────────────────────────
    // SUPER_ADMIN passes everything. MANAGER inherits every operational power
    // (administrator + head-of-school + finance + academic) and so passes any
    // guard EXCEPT structural actions reserved solely for SUPER_ADMIN
    // (e.g. defining schools). School-level isolation is still enforced
    // separately by school scope, so this only widens ROLE checks.
    if (userRole === 'SUPER_ADMIN') {
      return true;
    }
    if (userRole === 'MANAGER' && !requiredRoles.every((r) => r === 'SUPER_ADMIN')) {
      return true;
    }

    if (!requiredRoles.includes(userRole)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
