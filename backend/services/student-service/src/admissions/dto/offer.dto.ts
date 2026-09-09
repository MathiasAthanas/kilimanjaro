import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class IssueOfferDto {
  @IsString()
  classId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  feeExpectation?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class OfferDecisionDto {
  @IsIn(['ACCEPTED', 'DECLINED'])
  decision!: 'ACCEPTED' | 'DECLINED';

  @IsOptional()
  @IsString()
  note?: string;
}
