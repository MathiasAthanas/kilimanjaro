import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, { success: boolean; data: T }> {
  private serialize(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    if (value instanceof Decimal) {
      return value.toString();
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.serialize(item));
    }

    if (typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, this.serialize(item)]),
      );
    }

    return value;
  }

  intercept(_context: ExecutionContext, next: CallHandler): Observable<{ success: boolean; data: T }> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data: this.serialize(data) as T,
      })),
    );
  }
}
