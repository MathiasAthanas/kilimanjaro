import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BoardingController } from './boarding.controller';
import { BoardingService } from './boarding.service';

@Module({ imports: [PrismaModule], controllers: [BoardingController], providers: [BoardingService] })
export class BoardingModule {}
