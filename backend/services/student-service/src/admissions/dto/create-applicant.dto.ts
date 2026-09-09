import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  AdmissionSourceChannel,
  EducationStage,
  Gender,
  GuardianRelationship,
} from '../../../generated/prisma';

export class CreateApplicantDto {
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsString()
  nationality?: string;

  @IsOptional()
  @IsString()
  previousSchool?: string;

  @IsOptional()
  @IsString()
  prospectiveClassId?: string;

  @IsOptional()
  @IsEnum(EducationStage)
  educationStage?: EducationStage;

  @IsString()
  @IsNotEmpty()
  guardianFirstName!: string;

  @IsString()
  @IsNotEmpty()
  guardianLastName!: string;

  @IsString()
  @IsNotEmpty()
  guardianPhone!: string;

  @IsOptional()
  @IsEmail()
  guardianEmail?: string;

  @IsOptional()
  @IsEnum(GuardianRelationship)
  guardianRelationship?: GuardianRelationship;

  @IsOptional()
  @IsEnum(AdmissionSourceChannel)
  sourceChannel?: AdmissionSourceChannel;

  @IsOptional()
  @IsString()
  notes?: string;
}
