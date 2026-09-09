import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  const user = req.user as { scope?: 'GROUP' | 'SCHOOL'; schoolIds?: string[] } | undefined;
  const requestedSchoolId = req.header('x-active-school') || undefined;

  // The gateway forwards this header only after validating it against the JWT.
  // Keep the same check here so direct auth-service traffic cannot widen scope.
  const activeSchoolId = requestedSchoolId && user &&
    (user.scope === 'GROUP' || user.schoolIds?.includes(requestedSchoolId))
    ? requestedSchoolId
    : undefined;

  return user ? { ...user, activeSchoolId } : user;
});
