import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID, Length, ValidateIf } from 'class-validator';

export const LIFECYCLE_ACTIONS = [
  'UNENROL_STUDENTS',
  'DELETE_STUDENTS',
  'DELETE_CLASS_AND_STUDENTS',
  'DELETE_EMPTY_CLASS',
] as const;

export type StudentLifecycleAction = (typeof LIFECYCLE_ACTIONS)[number];

export class StudentLifecyclePreviewDto {
  @IsUUID()
  classId!: string;

  @IsIn(LIFECYCLE_ACTIONS)
  action!: StudentLifecycleAction;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  studentIds?: string[];

  @IsOptional()
  @IsBoolean()
  allClassStudents?: boolean;
}

export class ExecuteStudentLifecycleDto extends StudentLifecyclePreviewDto {
  @IsString()
  @Length(1, 500)
  reason!: string;

  @IsString()
  @Length(1, 160)
  confirmation!: string;

  @IsString()
  @Length(64, 64)
  fingerprint!: string;

  @ValidateIf((dto) => dto.action === 'DELETE_STUDENTS' || dto.action === 'DELETE_CLASS_AND_STUDENTS')
  @IsOptional()
  @IsBoolean()
  deleteLinkedAccounts?: boolean = true;
}
