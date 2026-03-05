import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  @Public()
  @ApiOperation({ summary: 'Gateway and downstream health status' })
  @ApiOkResponse({
    description: 'Gateway is running. Downstream service statuses may be reachable/unreachable.',
    schema: {
      example: {
        status: 'ok',
        gateway: 'api-gateway',
        timestamp: '2026-03-05T12:00:00.000Z',
        services: {
          auth: 'reachable',
          students: 'unreachable',
          academics: 'unreachable',
          finance: 'unreachable',
          notifications: 'unreachable',
          analytics: 'unreachable',
        },
      },
    },
  })
  async health() {
    return this.healthService.getStatus();
  }
}
