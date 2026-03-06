import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateFeeCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsBoolean()
  isOptional!: boolean;

  @IsBoolean()
  isBillablePerTerm!: boolean;

  @IsOptional()
  displayOrder?: number;
}
