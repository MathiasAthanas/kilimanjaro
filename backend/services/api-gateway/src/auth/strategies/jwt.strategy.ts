import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { RedisService } from '../../redis/redis.service';

interface AccessPayload {
  sub: string;
  tokenVersion?: number;
  role: string;
  email?: string | null;
  registrationNumber?: string | null;
  jti: string;
  iat?: number;
  exp?: number;
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

  async validate(payload: AccessPayload): Promise<any> {
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

    try {
      const userResponse = await firstValueFrom(
        this.httpService.get(`${authUrl}/api/v1/auth/internal/user/${payload.sub}`, {
          headers: internalHeaders,
          timeout: 5000,
        }),
      );

      const user = userResponse?.data?.data;
      const active = Boolean(user?.isActive);
      if (payload.tokenVersion === undefined || payload.tokenVersion !== user?.tokenVersion) throw new UnauthorizedException('Session expired; log in again');

      if (!active) {
        throw new UnauthorizedException('User account is inactive');
      }

      return {
        schoolId: user.schoolId,
        roles: user.roles,
        primaryRole: user.primaryRole,
        id: payload.sub,
        role: user?.role || payload.role,
        email: user.email ?? null,
        jti: payload.jti,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Unable to validate user account status');
    }
  }
}
