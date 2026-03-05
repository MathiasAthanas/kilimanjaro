import {
  All, Controller, Req, Res, Next, UseGuards, HttpException, HttpStatus,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ProxyService } from './proxy.service';

// Public paths that do NOT require JWT
const PUBLIC_PATHS = [
  '/api/v1/auth/login/email',
  '/api/v1/auth/login/student',
  '/api/v1/auth/refresh',
];

@Controller()
export class ProxyController {
  private proxyCache = new Map<string, any>();

  constructor(
    private proxyService: ProxyService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  @All('*')
  async proxy(@Req() req: Request, @Res() res: Response, @Next() next: NextFunction) {
    const route = this.proxyService.resolveTarget(req.path);

    if (!route) {
      throw new HttpException('Service not found', HttpStatus.NOT_FOUND);
    }

    // ─── Auth check ───────────────────────────────────────────────────────
    const isPublic = PUBLIC_PATHS.some((p) => req.path.startsWith(p));

    if (route.requiresAuth || !isPublic) {
      const token = this.extractToken(req);

      if (!token) {
        throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
      }

      try {
        const payload = this.jwtService.verify(token, {
          secret: this.config.get('JWT_ACCESS_SECRET'),
        });

        // Forward user identity to downstream service via headers
        req.headers['x-user-id'] = payload.sub;
        req.headers['x-user-role'] = payload.role;
        req.headers['x-school-id'] = payload.schoolId;
      } catch {
        throw new HttpException('Invalid or expired token', HttpStatus.UNAUTHORIZED);
      }
    }

    // ─── Proxy to downstream ──────────────────────────────────────────────
    const proxy = this.getProxy(route.target);
    proxy(req, res, next);
  }

  private extractToken(req: Request): string | null {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }
    return null;
  }

  private getProxy(target: string) {
    if (!this.proxyCache.has(target)) {
      const proxy = createProxyMiddleware({
        target,
        changeOrigin: true,
        on: {
          error: (err, req, res: any) => {
            console.error(`Proxy error to ${target}:`, err.message);
            res.status(502).json({
              success: false,
              message: 'Service temporarily unavailable',
            });
          },
        },
      });
      this.proxyCache.set(target, proxy);
    }
    return this.proxyCache.get(target);
  }
}
