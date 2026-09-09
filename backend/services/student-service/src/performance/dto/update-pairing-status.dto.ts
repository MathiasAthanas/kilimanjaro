import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PairingStatus } from '../../../generated/prisma';

export class UpdatePairingStatusDto {
  @IsEnum(PairingStatus)
  status!: PairingStatus;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}