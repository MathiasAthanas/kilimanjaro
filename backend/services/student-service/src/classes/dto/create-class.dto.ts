import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateClassDto {
  @IsString()
  name!: string;

  @IsInt()
  @Min(1)
  level!: number;

  @IsOptional()
  @IsString()
  stream?: string;

  @IsString()
  academicYearId!: string;

  @IsOptional()
  @IsString()
  classTeacherId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;
}