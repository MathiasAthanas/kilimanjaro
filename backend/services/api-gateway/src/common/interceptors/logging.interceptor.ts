import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const now = Date.now();
    const req = context.switchToHttp().getRequest();
    const user = req.user as { id?: string; role?: string } | undefined;

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse();
          this.logger.log(
            JSON.stringify({
              timestamp: new Date().toISOString(),
              method: req.method,
              path: req.originalUrl,
              userId: user?.id || null,
              role: user?.role || null,
              statusCode: res.statusCode,
              durationMs: Date.now() - now,
            }),
          );
        },
        error: (error) => {
          const statusCode = error?.status || error?.response?.statusCode || 500;
          this.logger.warn(
            JSON.stringify({
              timestamp: new Date().toISOString(),
              method: req.method,
              path: req.originalUrl,
              userId: user?.id || null,
              role: user?.role || null,
              statusCode,
              durationMs: Date.now() - now,
              error: error?.message || 'Request failed',
            }),
          );
        },
      }),
    );
  }
}
