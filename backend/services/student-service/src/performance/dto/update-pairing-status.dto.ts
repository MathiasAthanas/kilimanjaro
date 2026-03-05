import { IsEnum } from 'class-validator';
import { PairingStatus } from '@prisma/client';

export class UpdatePairingStatusDto {
  @IsEnum(PairingStatus)
  status!: PairingStatus;
}