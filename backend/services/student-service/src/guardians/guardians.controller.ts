import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GuardiansService } from './guardians.service';
import { CreateGuardianDto } from './dto/create-guardian.dto';
import { UpdateGuardianDto } from './dto/update-guardian.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { AccessControlService } from '../common/helpers/access-control.service';

@ApiTags('Guardians')
@Controller('students')
@UseGuards(RolesGuard)
@ApiBearerAuth()
export class GuardiansController {
  constructor(
    private readonly guardiansService: GuardiansService,
    private readonly accessControl: AccessControlService,
  ) {}

  @Post(':id/guardians')
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Add guardian to student' })
  async create(@Param('id') id: string, @Body() dto: CreateGuardianDto) {
    return this.guardiansService.addGuardian(id, dto);
  }

  @Get(':id/guardians')
  @Roles(
    'SYSTEM_ADMIN',
    'PRINCIPAL',
    'ACADEMIC_QA',
    'FINANCE',
    'HEAD_OF_DEPARTMENT',
    'TEACHER',
    'PARENT',
  )
  @ApiOperation({ summary: 'List guardians linked to student' })
  async list(@Param('id') id: string, @CurrentUser() user?: RequestUser) {
    if (user?.role === 'PARENT') {
      await this.accessControl.assertParentOwnsStudent(user.id, id);
    }
    return this.guardiansService.listByStudent(id);
  }

  @Patch(':id/guardians/:guardianId')
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Update guardian details / primary flag' })
  async update(
    @Param('id') id: string,
    @Param('guardianId') guardianId: string,
    @Body() dto: UpdateGuardianDto,
  ) {
    return this.guardiansService.update(id, guardianId, dto);
  }

  @Delete(':id/guardians/:guardianId')
  @Roles('SYSTEM_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Unlink guardian from student' })
  async remove(@Param('id') id: string, @Param('guardianId') guardianId: string) {
    return this.guardiansService.unlink(id, guardianId);
  }
}
