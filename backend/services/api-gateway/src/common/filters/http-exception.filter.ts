import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : 'Internal gateway error';

    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : String((exceptionResponse as Record<string, unknown>).message || 'Internal gateway error');

    const errorType =
      status === 401
        ? 'UNAUTHORIZED'
        : status === 403
          ? 'FORBIDDEN'
          : status === 404
            ? 'NOT_FOUND'
            : status === 429
              ? 'RATE_LIMITED'
              : status === 503
                ? 'SERVICE_UNAVAILABLE'
                : 'INTERNAL_ERROR';

    if (status >= 500) {
      this.logger.error(`Gateway error ${request.method} ${request.originalUrl}`, exception as Error);
    }

    response.status(status).json({
      success: false,
      error: errorType,
      message,
    });
  }
}
