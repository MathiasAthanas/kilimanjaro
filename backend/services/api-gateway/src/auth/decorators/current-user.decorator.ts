import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  const user = req.user;
  const requestedSchoolId = req.headers['x-active-school'];
  const activeSchoolId = typeof requestedSchoolId === 'string' && user &&
    (user.scope === 'GROUP' || user.schoolIds?.includes(requestedSchoolId))
    ? requestedSchoolId
    : undefined;

  return user ? { ...user, activeSchoolId } : user;
});
