import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ApplyFeeRecalculationDto {
  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;

  @IsString()
  @MinLength(5)
  reason!: string;
}
