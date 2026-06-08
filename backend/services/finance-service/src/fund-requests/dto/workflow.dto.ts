import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

const PAYMENT_METHODS = ['MOBILE_MONEY', 'BANK_TRANSFER', 'CASH', 'OTHER'] as const;

export class ForwardFundRequestDto {
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsString() actorName?: string;
}

export class ApproveFundRequestDto {
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsString() actorName?: string;
}

export class RejectFundRequestDto {
  @IsString() @IsNotEmpty() reason!: string;
  @IsOptional() @IsString() actorName?: string;
}

export class DisburseFundRequestDto {
  @IsIn(PAYMENT_METHODS) method!: (typeof PAYMENT_METHODS)[number];
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsString() actorName?: string;
}

export class CancelFundRequestDto {
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsString() actorName?: string;
}
