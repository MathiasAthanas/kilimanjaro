import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { RedisService } from '../../redis/redis.service';

interface AccessPayload {
  sub: string;
  role: string;
  email?: string | null;
  registrationNumber?: string | null;
  jti: string;
  scope?: 'GROUP' | 'SCHOOL';
  schoolIds?: string[];
  iat?: number;
  exp?: number;
}

interface GatewayUserContext {
  id: string;
  role: string;
  isActive: boolean;
  scope: 'GROUP' | 'SCHOOL';
  schoolIds: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly redisService: RedisService,
  ) {
    const publicKey = (configService.get<string>('JWT_PUBLIC_KEY') || '').replace(/\\n/g, '\n');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: publicKey,
      algorithms: ['RS256'],
    });
  }

  async validate(payload: AccessPayload): Promise<{ id: string; role: string; email?: string | null; jti: string; scope: 'GROUP' | 'SCHOOL'; schoolIds: string[] }> {
    const authUrl = this.configService.get<string>('AUTH_SERVICE_URL') || 'http://localhost:3001';
    const internalApiKey = this.configService.get<string>('INTERNAL_API_KEY');

    if (!internalApiKey) {
      throw new UnauthorizedException('Internal API key missing');
    }

    const internalHeaders = { 'x-internal-api-key': internalApiKey };

    try {
      const jtiResponse = await firstValueFrom(
        this.httpService.get(`${authUrl}/api/v1/auth/internal/validate-jti/${payload.jti}`, {
          headers: internalHeaders,
          timeout: 5000,
        }),
      );

      const blacklisted = Boolean(jtiResponse?.data?.data?.blacklisted);
      if (blacklisted) {
        throw new UnauthorizedException('Token has been revoked');
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Unable to validate token revocation state');
    }

    // Scope is live authorization data, not a permanent JWT claim. Cache the
    // fresh identity briefly so membership changes take effect quickly and an
    // old group-scoped token cannot retain broader school access.
    const cacheKey = `gateway:user_context:${payload.sub}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      try {
        const user = JSON.parse(cached) as GatewayUserContext;
        if (!user.isActive) throw new UnauthorizedException('User account is inactive');
        return {
          id: user.id,
          role: user.role,
          email: payload.email ?? null,
          jti: payload.jti,
          scope: user.scope,
          schoolIds: user.schoolIds,
        };
      } catch (error) {
        if (error instanceof UnauthorizedException) throw error;
        await this.redisService.del(cacheKey);
      }
    }

    try {
      const userResponse = await firstValueFrom(
        this.httpService.get(`${authUrl}/api/v1/auth/internal/user/${payload.sub}`, {
          headers: internalHeaders,
          timeout: 5000,
        }),
      );

      const user = userResponse?.data?.data as GatewayUserContext | undefined;
      const active = Boolean(user?.isActive);
      if (user) await this.redisService.set(cacheKey, JSON.stringify(user), 60);

      if (!active) {
        throw new UnauthorizedException('User account is inactive');
      }

      return {
        id: user?.id || payload.sub,
        role: user?.role || payload.role,
        email: payload.email ?? null,
        jti: payload.jti,
        scope: user?.scope ?? 'SCHOOL',
        schoolIds: user?.schoolIds ?? [],
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Unable to validate user account status');
    }
  }
}
