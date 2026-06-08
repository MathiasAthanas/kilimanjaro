import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { EXPENSE_CATEGORIES } from '../../expenses/dto/create-expense.dto';

export class CreateFundRequestDto {
  @IsString() @IsNotEmpty() title!: string;
  @IsString() @IsNotEmpty() description!: string;
  @IsIn(EXPENSE_CATEGORIES) category!: (typeof EXPENSE_CATEGORIES)[number];
  @IsString() @IsNotEmpty() amount!: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() neededBy?: string;
  @IsOptional() @IsString() requestedByName?: string;
}
