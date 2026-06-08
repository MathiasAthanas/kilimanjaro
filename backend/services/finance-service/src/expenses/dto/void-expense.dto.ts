import { IsNotEmpty, IsString } from 'class-validator';

export class VoidExpenseDto {
  @IsString() @IsNotEmpty() reason!: string;
}
