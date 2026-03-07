import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestUser } from '../interfaces/request-user.interface';

export const CurrentUser = createParamDecorator((_: unknown, context: ExecutionContext): RequestUser | undefined => {
  const req = context.switchToHttp().getRequest();
  return req.user;
});
