import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { runWithIdentity } from '@kilimanjaro/security';

@Injectable()
export class IdentityMiddleware implements NestMiddleware {
  use(req: Request & { user?: any; isInternalRequest?: boolean }, _res: Response, next: NextFunction): void {
    if (/\/health(?:\/|$)/.test(req.path)) { next(); return; }
    const expected = process.env.INTERNAL_API_KEY;
    if (!expected || req.header('x-internal-api-key') !== expected) throw new UnauthorizedException('Invalid internal API key');
    const role = req.header('x-user-primary-role') || req.header('x-user-role') || 'SYSTEM_ADMIN';
    const roles = (req.header('x-user-roles') || role).split(',').map(r => r.trim()).filter(Boolean);
    const identity = { id: req.header('x-user-id') || 'internal-service', role, primaryRole: role, roles,
      schoolId: req.header('x-school-id') || null, email: req.header('x-user-email') || undefined };
    req.user = identity;
    req.isInternalRequest = true;
    runWithIdentity(identity, next);
  }
}
