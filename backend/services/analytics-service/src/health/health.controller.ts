import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Analytics - Health')
@Controller('analytics/health')
export class HealthController {
  @Get()
  @Public()
  health() {
    return { status: 'ok', service: 'analytics-service', timestamp: new Date().toISOString() };
  }
}
