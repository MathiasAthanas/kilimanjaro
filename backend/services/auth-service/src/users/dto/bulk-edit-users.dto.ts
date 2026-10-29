import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class BulkEditUserRowDto {
  @IsString()
  userId!: string;

  @IsString()
  updatedAt!: string;

  @IsString()
  schoolIds!: string;

  @IsString()
  role!: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsOptional()
  @IsString()
  email?: string | null;

  @IsOptional()
  @IsString()
  registrationNumber?: string | null;

  @IsOptional()
  @IsString()
  phoneNumber?: string | null;

  @IsOptional()
  @IsString()
  department?: string | null;

  @IsString()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status!: 'ACTIVE' | 'INACTIVE';
}

export class PreviewBulkEditUsersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => BulkEditUserRowDto)
  rows!: BulkEditUserRowDto[];
}

export class CommitBulkEditUsersDto extends PreviewBulkEditUsersDto {
  @IsArray()
  @ArrayMaxSize(2000)
  @IsString({ each: true })
  resetUserIds: string[] = [];

  @IsBoolean()
  confirmed!: boolean;
}
