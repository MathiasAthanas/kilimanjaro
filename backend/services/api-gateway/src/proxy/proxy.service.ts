import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ServiceRoute {
  prefix: string;
  target: string;
  requiresAuth: boolean;
}

@Injectable()
export class ProxyService {
  private routes: ServiceRoute[];

  constructor(private config: ConfigService) {
    this.routes = [
      {
        prefix: '/api/v1/auth',
        target: config.get('AUTH_SERVICE_URL', 'http://localhost:3001'),
        requiresAuth: false,
      },
      {
        prefix: '/api/v1/students',
        target: config.get('STUDENT_SERVICE_URL', 'http://localhost:3002'),
        requiresAuth: true,
      },
      {
        prefix: '/api/v1/academics',
        target: config.get('ACADEMIC_SERVICE_URL', 'http://localhost:3003'),
        requiresAuth: true,
      },
      {
        prefix: '/api/v1/finance',
        target: config.get('FINANCE_SERVICE_URL', 'http://localhost:3004'),
        requiresAuth: true,
      },
      {
        prefix: '/api/v1/notifications',
        target: config.get('NOTIFICATION_SERVICE_URL', 'http://localhost:3005'),
        requiresAuth: true,
      },
      {
        prefix: '/api/v1/analytics',
        target: config.get('ANALYTICS_SERVICE_URL', 'http://localhost:3006'),
        requiresAuth: true,
      },
    ];
  }

  getRoutes(): ServiceRoute[] {
    return this.routes;
  }

  resolveTarget(path: string): ServiceRoute | undefined {
    return this.routes.find((r) => path.startsWith(r.prefix));
  }
}
