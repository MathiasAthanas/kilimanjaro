import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { runWithIdentity, hasRole } from '@kilimanjaro/security';

@Injectable()
export class SchoolContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) return next.handle();
    // A global administrator must explicitly select a school for domain operations.
    // This is selection, never actor identity; school-owned actors cannot override it.
    const selected = !user.schoolId && hasRole(user, 'SYSTEM_ADMIN') ? req.query?.schoolId || req.body?.schoolId : undefined;
    const identity = { ...user, schoolId: user.schoolId || selected || null };
    return new Observable(subscriber => runWithIdentity(identity, () => {
      const subscription = next.handle().subscribe(subscriber);
      return () => subscription.unsubscribe();
    }));
  }
}
