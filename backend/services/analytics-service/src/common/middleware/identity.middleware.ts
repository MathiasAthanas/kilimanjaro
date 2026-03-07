import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

@Injectable()
export class IdentityMiddleware implements NestMiddleware {
  use(req: Request & { user?: any }, _res: Response, next: NextFunction) {
    const id = req.headers['x-user-id'];
    const role = req.headers['x-user-role'];
    const email = req.headers['x-user-email'];

    if (typeof id === 'string' && typeof role === 'string') {
      req.user = { id, role, email: typeof email === 'string' ? email : undefined };
    }

    next();
  }
}
