import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateInterventionDto {
  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  outcome?: string;

  @IsOptional()
  @IsDateString()
  followUpDate?: string;

  @IsOptional()
  @IsBoolean()
  isFollowedUp?: boolean;
}
