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

    if (id && role) {
      req.user = { id, role, email };
    }

    req.isInternalRequest = req.header('x-internal-request') === 'true';
    next();
  }
}
