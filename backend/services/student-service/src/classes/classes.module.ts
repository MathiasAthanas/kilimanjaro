import { Module } from '@nestjs/common';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';
import { AuthClientService } from '../admissions/auth-client.service';

@Module({
  controllers: [ClassesController],
  providers: [ClassesService, AuthClientService],
  exports: [ClassesService],
})
export class ClassesModule {}
