import {
  Controller, All, Req, Res, UseGuards, Param,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { GatewayService } from './gateway.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { Public } from '../common/decorators/public.decorator';

// ─── Auth Routes (public — no JWT required) ───────────────────────────────────

@ApiTags('Auth')
@Controller('auth')
export class AuthProxyController {
  constructor(private gateway: GatewayService) {}

  @All('login')
  @Public()
  async login(@Req() req: Request) {
    return this.gateway.proxy(
      this.gateway.getServiceUrl('auth'),
      '/api/v1/auth/login',
      req.method,
      req.body,
    );
  }

  @All('refresh')
  @Public()
  async refresh(@Req() req: Request) {
    return this.gateway.proxy(
      this.gateway.getServiceUrl('auth'),
      '/api/v1/auth/refresh',
      req.method,
      req.body,
    );
  }

  @All('*')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  async proxyAuth(@Req() req: Request) {
    const path = req.path;
    const token = req.headers['authorization'];
    return this.gateway.proxy(
      this.gateway.getServiceUrl('auth'),
      `/api/v1${path}`,
      req.method,
      req.body,
      token ? { Authorization: token } : {},
    );
  }
}

// ─── Student Routes ───────────────────────────────────────────────────────────

@ApiTags('Students')
@Controller('students')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class StudentProxyController {
  constructor(private gateway: GatewayService) {}

  @All('*')
  async proxy(@Req() req: Request) {
    const path = req.path;
    return this.gateway.proxy(
      this.gateway.getServiceUrl('student'),
      `/api/v1${path}`,
      req.method,
      req.body,
      { Authorization: req.headers['authorization'] as string },
    );
  }
}

// ─── Academic Routes ──────────────────────────────────────────────────────────

@ApiTags('Academics')
@Controller('academics')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class AcademicProxyController {
  constructor(private gateway: GatewayService) {}

  @All('*')
  async proxy(@Req() req: Request) {
    return this.gateway.proxy(
      this.gateway.getServiceUrl('academic'),
      `/api/v1${req.path}`,
      req.method,
      req.body,
      { Authorization: req.headers['authorization'] as string },
    );
  }
}

// ─── Finance Routes ───────────────────────────────────────────────────────────

@ApiTags('Finance')
@Controller('finance')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class FinanceProxyController {
  constructor(private gateway: GatewayService) {}

  @All('*')
  async proxy(@Req() req: Request) {
    return this.gateway.proxy(
      this.gateway.getServiceUrl('finance'),
      `/api/v1${req.path}`,
      req.method,
      req.body,
      { Authorization: req.headers['authorization'] as string },
    );
  }
}

// ─── Analytics Routes ─────────────────────────────────────────────────────────

@ApiTags('Analytics')
@Controller('analytics')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class AnalyticsProxyController {
  constructor(private gateway: GatewayService) {}

  @All('*')
  async proxy(@Req() req: Request) {
    return this.gateway.proxy(
      this.gateway.getServiceUrl('analytics'),
      `/api/v1${req.path}`,
      req.method,
      req.body,
      { Authorization: req.headers['authorization'] as string },
    );
  }
}

// ─── Notification Routes ──────────────────────────────────────────────────────

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class NotificationProxyController {
  constructor(private gateway: GatewayService) {}

  @All('*')
  async proxy(@Req() req: Request) {
    return this.gateway.proxy(
      this.gateway.getServiceUrl('notification'),
      `/api/v1${req.path}`,
      req.method,
      req.body,
      { Authorization: req.headers['authorization'] as string },
    );
  }
}
