import { IsEnum } from 'class-validator';
import { PairingStatus } from '../../../generated/prisma';

export class UpdatePairingStatusDto {
  @IsEnum(PairingStatus)
  status!: PairingStatus;
}