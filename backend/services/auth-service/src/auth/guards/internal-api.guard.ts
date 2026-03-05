import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InternalApiGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const header = req.header('x-internal-api-key');
    const expected = this.configService.get<string>('INTERNAL_API_KEY');

    if (!expected || header !== expected) {
      throw new UnauthorizedException('Invalid internal API key');
    }

    return true;
  }
}
