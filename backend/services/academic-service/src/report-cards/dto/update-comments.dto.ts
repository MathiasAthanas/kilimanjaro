import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCommentsDto {
  @IsOptional()
  @IsString()
  @MaxLength(600)
  teacherComment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  principalComment?: string;
}
