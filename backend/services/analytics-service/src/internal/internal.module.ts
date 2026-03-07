import { Module } from '@nestjs/common';
import { AppCommonModule } from '../common/common.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { InternalController } from './internal.controller';

@Module({
  imports: [PrismaModule, RedisModule, AppCommonModule],
  controllers: [InternalController],
})
export class InternalModule {}
