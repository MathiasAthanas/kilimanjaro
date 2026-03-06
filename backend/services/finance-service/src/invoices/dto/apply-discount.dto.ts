import { IsNotEmpty, IsNumberString, IsString } from 'class-validator';

export class ApplyDiscountDto {
  @IsNumberString()
  discountAmount!: string;

  @IsString()
  @IsNotEmpty()
  discountReason!: string;
}
