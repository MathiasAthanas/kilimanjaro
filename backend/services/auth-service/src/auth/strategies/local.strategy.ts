import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({ usernameField: 'email', passwordField: 'password', passReqToCallback: true });
  }

  async validate(req: Record<string, unknown>, _email: string, password: string) {
    const user = await this.authService.validateLocalCredentials({
      email: req.email as string | undefined,
      registrationNumber: req.registrationNumber as string | undefined,
      password,
      ip: (req.ip as string | undefined) ?? '',
      userAgent: (req.headers as Record<string, string> | undefined)?.['user-agent'] ?? '',
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }
}
