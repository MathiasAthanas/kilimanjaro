import { Module } from '@nestjs/common';
import { GuardiansController } from './guardians.controller';
import { GuardiansService } from './guardians.service';
import { AccessControlService } from '../common/helpers/access-control.service';

@Module({
  controllers: [GuardiansController],
  providers: [GuardiansService, AccessControlService],
  exports: [GuardiansService],
})
export class GuardiansModule {}