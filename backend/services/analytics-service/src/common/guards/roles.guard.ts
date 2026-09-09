import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true;

    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!required?.length) return true;

    const req = context.switchToHttp().getRequest();
    const role = req.user?.role || req.headers['x-user-role'];
    if (!role) throw new ForbiddenException('Insufficient role');
    // Group super-roles: SUPER_ADMIN passes all; MANAGER passes all but SUPER_ADMIN-only.
    if (role === 'SUPER_ADMIN') return true;
    if (role === 'MANAGER' && !required.every((r) => r === 'SUPER_ADMIN')) return true;
    if (!required.includes(role)) throw new ForbiddenException('Insufficient role');
    return true;
  }
}
