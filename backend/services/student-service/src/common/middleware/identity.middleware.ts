import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { RequestUser } from '../interfaces/request-user.interface';

type RequestWithUser = Request & { user?: RequestUser; isInternalRequest?: boolean };

@Injectable()
export class IdentityMiddleware implements NestMiddleware {
  use(req: RequestWithUser, _res: Response, next: NextFunction): void {
    const id = req.header('x-user-id');
    const role = req.header('x-user-role');
    const email = req.header('x-user-email') || undefined;
    const scopeHeader = req.header('x-user-scope');
    const schoolIdsHeader = req.header('x-user-school-ids');
    const activeSchoolId = req.header('x-active-school') || undefined;

    if (id && role) {
      // The gateway sets x-user-scope for every real user request. Its ABSENCE
      // means this is a trusted service-to-service call, which must see all
      // schools (GROUP) rather than being filtered to zero schools.
      const scope: 'GROUP' | 'SCHOOL' = scopeHeader === 'SCHOOL' ? 'SCHOOL' : 'GROUP';
      const schoolIds =
        schoolIdsHeader === '*' || (scope === 'GROUP' && !schoolIdsHeader)
          ? ['*']
          : (schoolIdsHeader || '')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
      req.user = { id, role, email, scope, schoolIds, activeSchoolId };
    }

    req.isInternalRequest = req.header('x-internal-request') === 'true';

    next();
  }
}
