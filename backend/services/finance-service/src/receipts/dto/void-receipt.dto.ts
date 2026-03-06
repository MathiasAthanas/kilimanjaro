import { IsNotEmpty, IsString } from 'class-validator';

export class VoidReceiptDto {
  @IsString()
  @IsNotEmpty()
  voidReason!: string;
}
