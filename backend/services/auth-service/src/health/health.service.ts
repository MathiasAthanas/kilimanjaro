import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  check(): { status: string; service: string; timestamp: string } {
    return {
      status: 'ok',
      service: 'auth-service',
      timestamp: new Date().toISOString(),
    };
  }
}
