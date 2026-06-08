import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export const EXPENSE_CATEGORIES = [
  'SALARY',
  'UTILITIES',
  'MAINTENANCE',
  'SUPPLIES',
  'TRANSPORT',
  'FOOD',
  'ACADEMIC',
  'ADMINISTRATIVE',
  'EXAMINATION',
  'SPORTS',
  'FUND_DISBURSEMENT',
  'OTHER',
] as const;

const PAYMENT_METHODS = ['MOBILE_MONEY', 'BANK_TRANSFER', 'CASH', 'WAIVER', 'SCHOLARSHIP', 'OTHER'] as const;

export class CreateExpenseDto {
  @IsIn(EXPENSE_CATEGORIES) category!: (typeof EXPENSE_CATEGORIES)[number];
  @IsString() @IsNotEmpty() description!: string;
  @IsString() @IsNotEmpty() amount!: string;
  @IsString() @IsNotEmpty() incurredAt!: string;
  @IsOptional() @IsString() payee?: string;
  @IsOptional() @IsIn(PAYMENT_METHODS) paymentMethod?: (typeof PAYMENT_METHODS)[number];
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() receiptUrl?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() recordedByName?: string;
}
