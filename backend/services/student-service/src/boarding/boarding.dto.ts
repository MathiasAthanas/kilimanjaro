import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { BedStatus, HostelLeaveStatus, HostelRollCallStatus, LeaveType, RollCallSession } from '../../generated/prisma';

export class CreateDormitoryDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @IsNotEmpty() code!: string;
  @Type(() => Number) @IsInt() @Min(0) totalBeds!: number;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() eligibilityNotes?: string;
}

export class UpdateDormitoryDto {
  @IsOptional() @IsString() @IsNotEmpty() name?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) totalBeds?: number;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() eligibilityNotes?: string;
}

export class AssignDormitoryStaffDto {
  @IsString() staffUserId!: string;
  @IsIn(['MATRON', 'PATRON']) staffRole!: 'MATRON' | 'PATRON';
}

export class AssignDormitoryStudentDto {
  @IsString() studentId!: string;
  @IsOptional() @IsString() bedId?: string;
}

export class UpdateBedDto {
  @IsEnum(BedStatus) status!: BedStatus;
}

export class RollCallRecordDto {
  @IsString() studentId!: string;
  @IsEnum(HostelRollCallStatus) status!: HostelRollCallStatus;
  @IsOptional() @IsString() note?: string;
}

export class RecordRollCallDto {
  @IsDateString() date!: string;
  @IsEnum(RollCallSession) session!: RollCallSession;
  @IsArray() @ValidateNested({ each: true }) @Type(() => RollCallRecordDto) records!: RollCallRecordDto[];
}

export class CreateStudentLeaveDto {
  @IsString() dormitoryId!: string;
  @IsString() studentId!: string;
  @IsString() termId!: string;
  @IsEnum(LeaveType) leaveType!: LeaveType;
  @IsString() @IsNotEmpty() reason!: string;
  @IsDateString() departureAt!: string;
  @IsDateString() expectedReturnAt!: string;
}

export class TransitionStudentLeaveDto {
  @IsEnum(HostelLeaveStatus) status!: HostelLeaveStatus;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsDateString() actualReturnAt?: string;
}
