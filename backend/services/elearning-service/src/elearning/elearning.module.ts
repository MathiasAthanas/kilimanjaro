import { Module } from '@nestjs/common';
import { InternalApiGuard } from '../common/guards/internal-api.guard';
import { ElearningController } from './elearning.controller';
import { ElearningService } from './elearning.service';

@Module({ controllers: [ElearningController], providers: [ElearningService, InternalApiGuard] })
export class ElearningModule {}
