import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../../redis/redis.service';

interface JwtPayload {
  sub: string;
  role: string;
  email: string | null;
  registrationNumber: string | null;
  jti: string;
  exp?: number;
  iat?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
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

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const blacklisted = await this.redisService.get(`auth:blacklist:jti:${payload.jti}`);
    if (blacklisted) {
      throw new UnauthorizedException('Token has been revoked');
    }

    return payload;
  }
}
