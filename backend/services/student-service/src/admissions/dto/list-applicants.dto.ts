import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { AdmissionSourceChannel, AdmissionStage } from '../../../generated/prisma';

export class ListApplicantsDto {
  @IsOptional()
  @IsEnum(AdmissionStage)
  stage?: AdmissionStage;

  @IsOptional()
  @IsEnum(AdmissionSourceChannel)
  sourceChannel?: AdmissionSourceChannel;

  @IsOptional()
  @IsString()
  prospectiveClassId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
