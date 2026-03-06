import { IsNotEmpty, IsString } from 'class-validator';

export class RefundPaymentDto {
  @IsString()
  @IsNotEmpty()
  refundReason!: string;
}
