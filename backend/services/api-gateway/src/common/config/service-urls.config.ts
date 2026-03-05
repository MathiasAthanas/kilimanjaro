import { ConfigService } from '@nestjs/config';

export interface ServiceUrls {
  auth: string;
  student: string;
  academic: string;
  finance: string;
  notification: string;
  analytics: string;
}

export function getServiceUrls(configService: ConfigService): ServiceUrls {
  return {
    auth: configService.get<string>('AUTH_SERVICE_URL') || 'http://localhost:3001',
    student: configService.get<string>('STUDENT_SERVICE_URL') || 'http://localhost:3002',
    academic: configService.get<string>('ACADEMIC_SERVICE_URL') || 'http://localhost:3003',
    finance: configService.get<string>('FINANCE_SERVICE_URL') || 'http://localhost:3004',
    notification: configService.get<string>('NOTIFICATION_SERVICE_URL') || 'http://localhost:3005',
    analytics: configService.get<string>('ANALYTICS_SERVICE_URL') || 'http://localhost:3006',
  };
}
