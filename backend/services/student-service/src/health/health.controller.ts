import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { HealthService } from './health.service';

@ApiTags('Health')
@Controller('students')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  @Public()
  check() {
    return this.healthService.check();
  }
}