import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload: any = exception.getResponse();
      response.status(status).json({ success: false, error: payload?.error || exception.name, message: payload?.message || exception.message });
      return;
    }

    // Unexpected failures must be traceable in the service logs
    this.logger.error(
      `${request?.method || 'REQ'} ${request?.url || ''} failed`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, error: 'InternalServerError', message: 'Internal server error' });
  }
}
