import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { QueuesService } from '../queues/queues.service';

@ApiTags('Notifications - Health')
@Controller('notifications/health')
export class HealthController {
  constructor(private readonly queues: QueuesService) {}

  @Get()
  @Public()
  async health() {
    return {
      status: 'ok',
      service: 'notification-service',
      timestamp: new Date().toISOString(),
      queues: await this.queues.stats(),
    };
  }
}
