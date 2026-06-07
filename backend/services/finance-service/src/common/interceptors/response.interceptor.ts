import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, { success: boolean; data: T }> {
  /** Robust Decimal check — `instanceof` is unreliable across multiple
   *  @prisma/client runtime copies, so fall back to duck-typing the
   *  decimal.js internal shape ({ s, e, d[] } + toFixed()). */
  private isDecimalLike(v: unknown): boolean {
    if (v instanceof Decimal) return true;
    if (!v || typeof v !== 'object') return false;
    const o = v as Record<string, unknown>;
    return (
      typeof o.s === 'number' &&
      typeof o.e === 'number' &&
      Array.isArray(o.d) &&
      typeof (o as { toFixed?: unknown }).toFixed === 'function'
    );
  }

  private serialize(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    // Dates must be turned into ISO strings; recursing into them yields {}
    if (value instanceof Date) {
      return value.toISOString();
    }

    if (this.isDecimalLike(value)) {
      return (value as { toString(): string }).toString();
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
