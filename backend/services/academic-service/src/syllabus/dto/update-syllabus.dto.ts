import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateSyllabusDto {
  @IsInt()
  @Min(0)
  coveredTopics!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
