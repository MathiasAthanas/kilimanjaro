import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BoardingController } from './boarding.controller';
import { BoardingService } from './boarding.service';
import { RollCallNotifierService } from './rollcall-notifier.service';
import { RollCallReportService } from './rollcall-report.service';

@Module({ imports: [PrismaModule], controllers: [BoardingController], providers: [BoardingService, RollCallReportService, RollCallNotifierService] })
export class BoardingModule {}
