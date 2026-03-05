import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const errorResponse = exception instanceof HttpException ? exception.getResponse() : 'Internal server error';
    const message =
      typeof errorResponse === 'string'
        ? errorResponse
        : ((errorResponse as Record<string, unknown>).message ?? 'Request failed');

    if (status >= 500) {
      this.logger.error(`${request.method} ${request.url}`, exception as Error);
    }

    response.status(status).json({
      success: false,
      message,
      error: status >= 500 ? 'Internal server error' : undefined,
    });
  }
}