import { CallHandler, ExecutionContext, Injectable, NestInterceptor, StreamableFile } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, { success: boolean; data: T } | StreamableFile> {
  private serialize(v: unknown): unknown {
    if (v === null || v === undefined) return v;
    if (v instanceof Decimal) return v.toString();
    if (Array.isArray(v)) return v.map((x) => this.serialize(x));
    if (typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, this.serialize(val)]));
    return v;
  }

  intercept(_context: ExecutionContext, next: CallHandler): Observable<{ success: boolean; data: T } | StreamableFile> {
    return next.handle().pipe(
      map((data) => {
        // Pass StreamableFile through unchanged so NestJS can stream it directly
        if (data instanceof StreamableFile) return data;
        return { success: true, data: this.serialize(data) as T };
      }),
    );
  }
}
