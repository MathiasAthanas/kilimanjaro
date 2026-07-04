import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateSyllabusDto {
  @IsString()
  @IsNotEmpty()
  classSubjectId!: string;

  @IsString()
  @IsNotEmpty()
  termId!: string;

  @IsInt()
  @Min(1)
  totalTopics!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  coveredTopics?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
