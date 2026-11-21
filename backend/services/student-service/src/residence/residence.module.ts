import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ResidenceController } from './residence.controller';
import { ResidenceService } from './residence.service';

@Module({ imports: [PrismaModule], controllers: [ResidenceController], providers: [ResidenceService], exports: [ResidenceService] })
export class ResidenceModule {}
