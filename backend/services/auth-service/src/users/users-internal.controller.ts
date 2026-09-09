import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Role } from '../../generated/prisma';
import { InternalApiGuard } from '../auth/guards/internal-api.guard';
import { UsersService } from './users.service';

export class EnsureParentAccountDto {
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  actorId?: string;

  @IsString()
  @IsNotEmpty()
  schoolId!: string;
}

export class CreateStudentAccountDto {
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsOptional()
  @IsString()
  actorId?: string;

  @IsString()
  @IsNotEmpty()
  schoolId!: string;
}

export class SetRegistrationNumberDto {
  @IsString()
  @IsNotEmpty()
  registrationNumber!: string;

  @IsOptional()
  @IsString()
  actorId?: string;
}

/**
 * Internal (service-to-service) user endpoints, guarded by the shared
 * INTERNAL_API_KEY. Used by student-service admissions enrolment to
 * find-or-create parent accounts with phone deduplication and to create
 * student auth accounts server-side.
 */
@ApiTags('Users Internal')
@Controller('auth/internal')
@UseGuards(InternalApiGuard)
export class UsersInternalController {
  constructor(private readonly usersService: UsersService) {}

  @Post('parent-account')
  async ensureParentAccount(@Body() dto: EnsureParentAccountDto) {
    return this.usersService.ensureParentAccount(
      {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phoneNumber: dto.phoneNumber,
        email: dto.email,
        schoolId: dto.schoolId,
      },
      dto.actorId || 'system',
    );
  }

  /**
   * Creates a STUDENT auth account. Password follows the bulk-import
   * convention: the student's last name, alphanumerics only, uppercased.
   */
  @Post('student-account')
  async createStudentAccount(@Body() dto: CreateStudentAccountDto) {
    const password = dto.lastName.replace(/[^a-z0-9]/gi, '').toUpperCase();
    return this.usersService.createUser(
      {
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: Role.STUDENT,
        password,
        schoolId: dto.schoolId,
        isActive: true,
      },
      dto.actorId || 'system',
    );
  }

  @Get('users-stats')
  async usersStats() {
    return this.usersService.stats();
  }

  @Patch('users/:userId/registration-number')
  async setRegistrationNumber(
    @Param('userId') userId: string,
    @Body() dto: SetRegistrationNumberDto,
  ) {
    return this.usersService.updateUser(
      userId,
      { registrationNumber: dto.registrationNumber },
      dto.actorId || 'system',
    );
  }
}
