import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsObject, IsOptional, IsUUID } from 'class-validator';
export class BulkStudentsDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() schoolId?: string;
  @ApiProperty() @IsUUID() batchId: string;
  @ApiProperty({ enum: ['VALIDATE_ONLY', 'COMMIT'] }) @IsIn(['VALIDATE_ONLY', 'COMMIT']) mode: 'VALIDATE_ONLY' | 'COMMIT';
  @ApiProperty({ type: [Object] }) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @IsObject({ each: true }) rows: Record<string, string>[];
}
