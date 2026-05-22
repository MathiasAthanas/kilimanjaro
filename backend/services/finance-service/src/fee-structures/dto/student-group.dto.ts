import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateStudentGroupDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AssignStudentGroupDto {
  @IsString()
  studentId!: string;

  @IsString()
  groupId!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
