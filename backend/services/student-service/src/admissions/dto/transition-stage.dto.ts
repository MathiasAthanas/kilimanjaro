import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AdmissionStage } from '../../../generated/prisma';

export class TransitionStageDto {
  @IsEnum(AdmissionStage)
  toStage!: AdmissionStage;

  @IsOptional()
  @IsString()
  note?: string;
}
