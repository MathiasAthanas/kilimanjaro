import { PartialType } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { CreateFeeCategoryDto } from './create-fee-category.dto';

export class UpdateFeeCategoryDto extends PartialType(CreateFeeCategoryDto) {
  @IsOptional()
  isActive?: boolean;
}
