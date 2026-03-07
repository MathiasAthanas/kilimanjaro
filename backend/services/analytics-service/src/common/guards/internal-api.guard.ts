import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InternalApiGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const key = req.headers['x-internal-api-key'];
    if (!key || key !== this.config.get<string>('INTERNAL_API_KEY', '')) {
      throw new UnauthorizedException('Invalid internal API key');
    }
    return true;
  }
}
