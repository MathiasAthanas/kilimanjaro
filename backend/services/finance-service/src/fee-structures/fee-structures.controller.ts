import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateFeeStructureDto } from './dto/create-fee-structure.dto';
import { UpdateFeeStructureDto } from './dto/update-fee-structure.dto';
import { AssignStudentGroupDto, CreateStudentGroupDto } from './dto/student-group.dto';
import { FeeStructuresService } from './fee-structures.service';

@ApiTags('Finance - Fee Structures')
@Controller('finance/fee-structures')
export class FeeStructuresController {
  constructor(private readonly feeStructuresService: FeeStructuresService) {}

  @Post()
  @Roles(ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN)
  create(@Body() dto: CreateFeeStructureDto, @CurrentUser() user?: RequestUser) {
    return this.feeStructuresService.create(dto, user!);
  }

  @Get()
  @Roles(ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN, ROLES.ACADEMIC_QA, ROLES.MANAGING_DIRECTOR)
  list(
    @Query('feeCategoryId') feeCategoryId?: string,
    @Query('classId') classId?: string,
    @Query('educationStage') educationStage?: string,
    @Query('classLevel') classLevel?: string,
    @Query('studentGroup') studentGroup?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('termId') termId?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.feeStructuresService.list({
      feeCategoryId,
      classId,
      educationStage,
      classLevel,
      studentGroup,
      academicYearId,
      termId,
      isActive,
    });
  }

  @Get('matrix')
  @Roles(ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN)
  matrix(
    @Query('academicYearId') academicYearId: string,
    @Query('termId') termId?: string,
    @Query('educationStage') educationStage?: string,
  ) {
    return this.feeStructuresService.matrix({ academicYearId, termId, educationStage });
  }

  @Patch(':id')
  @Roles(ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateFeeStructureDto, @CurrentUser() user?: RequestUser) {
    return this.feeStructuresService.update(id, dto, user!);
  }

  @Patch(':id/deactivate')
  @Roles(ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN)
  deactivate(@Param('id') id: string, @CurrentUser() user?: RequestUser) {
    return this.feeStructuresService.deactivate(id, user!);
  }

  @Post('student-groups')
  @Roles(ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN)
  createStudentGroup(@Body() dto: CreateStudentGroupDto, @CurrentUser() user?: RequestUser) {
    return this.feeStructuresService.createStudentGroup(dto, user!);
  }

  @Get('student-groups')
  @Roles(ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN, ROLES.ACADEMIC_QA, ROLES.MANAGING_DIRECTOR)
  listStudentGroups(@Query('isActive') isActive?: string) {
    return this.feeStructuresService.listStudentGroups({ isActive });
  }

  @Post('student-groups/memberships')
  @Roles(ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN)
  assignStudentGroup(@Body() dto: AssignStudentGroupDto, @CurrentUser() user?: RequestUser) {
    return this.feeStructuresService.assignStudentGroup(dto, user!);
  }

  @Patch('student-groups/memberships/:id/remove')
  @Roles(ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN)
  removeStudentGroupMembership(@Param('id') id: string) {
    return this.feeStructuresService.removeStudentGroupMembership(id);
  }
}
