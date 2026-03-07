import { Module } from '@nestjs/common';
import { EnrolmentController } from './enrolment.controller';
import { EnrolmentService } from './enrolment.service';

@Module({ controllers: [EnrolmentController], providers: [EnrolmentService], exports: [EnrolmentService] })
export class EnrolmentModule {}
