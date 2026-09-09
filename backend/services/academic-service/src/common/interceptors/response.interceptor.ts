import { CallHandler, ExecutionContext, Injectable, NestInterceptor, StreamableFile } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, { success: boolean; data: T }> {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        // File/stream responses (e.g. CSV templates, PDFs) must stream byte-for-byte,
        // not be wrapped in the { success, data } envelope.
        if (data instanceof StreamableFile || Buffer.isBuffer(data)) {
          return data;
        }
        return { success: true, data };
      }),
    );
  }
}
