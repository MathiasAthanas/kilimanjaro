import { All, Controller, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { GatewayService } from './gateway.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { Public } from '../common/decorators/public.decorator';

function buildHeaders(req: Request): Record<string, string> {
  const auth = req.headers['authorization'];
  const user = (req as any).user as { id?: string; role?: string } | undefined;
  const payload = (req as any).jwtPayload as { sub?: string; role?: string; schoolId?: string } | undefined;

  const headers: Record<string, string> = {};

  if (typeof auth === 'string') {
    headers.Authorization = auth;
  }
  if (user?.id || payload?.sub) {
    headers['x-user-id'] = String(user?.id || payload?.sub);
  }
  if (user?.role || payload?.role) {
    headers['x-user-role'] = String(user?.role || payload?.role);
  }
  if (payload?.schoolId) {
    headers['x-school-id'] = String(payload.schoolId);
  }

  return headers;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthProxyController {
  constructor(private readonly gateway: GatewayService) {}

  @All('login')
  @Public()
  async login(@Req() req: Request) {
    return this.gateway.proxy(this.gateway.getServiceUrl('auth'), req.originalUrl, req.method, req.body);
  }

  @All('refresh')
  @Public()
  async refresh(@Req() req: Request) {
    return this.gateway.proxy(this.gateway.getServiceUrl('auth'), req.originalUrl, req.method, req.body);
  }

  @All('password-reset/request')
  @Public()
  async resetRequest(@Req() req: Request) {
    return this.gateway.proxy(this.gateway.getServiceUrl('auth'), req.originalUrl, req.method, req.body);
  }

  @All('password-reset/complete')
  @Public()
  async resetComplete(@Req() req: Request) {
    return this.gateway.proxy(this.gateway.getServiceUrl('auth'), req.originalUrl, req.method, req.body);
  }

  @All('internal/*')
  @Public()
  async internal(@Req() req: Request) {
    return this.gateway.proxy(
      this.gateway.getServiceUrl('auth'),
      req.originalUrl,
      req.method,
      req.body,
      {
        'x-internal-api-key': String(req.headers['x-internal-api-key'] || ''),
      },
    );
  }

  @All('*')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  async proxyAuth(@Req() req: Request) {
    return this.gateway.proxy(
      this.gateway.getServiceUrl('auth'),
      req.originalUrl,
      req.method,
      req.body,
      buildHeaders(req),
    );
  }
}

@ApiTags('Students')
@Controller('students')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class StudentProxyController {
  constructor(private readonly gateway: GatewayService) {}

  @All('*')
  async proxy(@Req() req: Request) {
    return this.gateway.proxy(
      this.gateway.getServiceUrl('student'),
      req.originalUrl,
      req.method,
      req.body,
      buildHeaders(req),
    );
  }
}

@ApiTags('Academics')
@Controller('academics')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class AcademicProxyController {
  constructor(private readonly gateway: GatewayService) {}

  @All('*')
  async proxy(@Req() req: Request) {
    return this.gateway.proxy(
      this.gateway.getServiceUrl('academic'),
      req.originalUrl,
      req.method,
      req.body,
      buildHeaders(req),
    );
  }
}

@ApiTags('Finance')
@Controller('finance')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class FinanceProxyController {
  constructor(private readonly gateway: GatewayService) {}

  @All('*')
  async proxy(@Req() req: Request) {
    return this.gateway.proxy(
      this.gateway.getServiceUrl('finance'),
      req.originalUrl,
      req.method,
      req.body,
      buildHeaders(req),
    );
  }
}

@ApiTags('Analytics')
@Controller('analytics')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class AnalyticsProxyController {
  constructor(private readonly gateway: GatewayService) {}

  @All('*')
  async proxy(@Req() req: Request) {
    return this.gateway.proxy(
      this.gateway.getServiceUrl('analytics'),
      req.originalUrl,
      req.method,
      req.body,
      buildHeaders(req),
    );
  }
}

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class NotificationProxyController {
  constructor(private readonly gateway: GatewayService) {}

  @All('*')
  async proxy(@Req() req: Request) {
    return this.gateway.proxy(
      this.gateway.getServiceUrl('notification'),
      req.originalUrl,
      req.method,
      req.body,
      buildHeaders(req),
    );
  }
}
