import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InternalApiGuard } from '../common/guards/internal-api.guard';
import { RedisService } from '../redis/redis.service';

@ApiTags('Analytics - Internal')
@Controller('analytics/internal')
@UseGuards(InternalApiGuard)
export class InternalController {
  constructor(private readonly redis: RedisService) {}

  @Post('cache/invalidate')
  invalidate(@Body() body: { pattern: string }) {
    return this.redis.delByPattern(body.pattern || 'analytics:*').then(() => ({ ok: true }));
  }
}
