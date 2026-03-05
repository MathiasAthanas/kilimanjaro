import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { AttendanceStatus } from '@prisma/client';

export class AttendanceItemDto {
  @IsString()
  studentId!: string;

  @IsEnum(AttendanceStatus)
  status!: AttendanceStatus;

  @IsOptional()
  @IsString()
  note?: string;
}

export class MarkAttendanceDto {
  @IsString()
  classId!: string;

  @IsDateString()
  date!: string;

  @IsString()
  termId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceItemDto)
  records!: AttendanceItemDto[];
}