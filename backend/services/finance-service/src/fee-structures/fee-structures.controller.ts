import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateFeeStructureDto } from './dto/create-fee-structure.dto';
import { UpdateFeeStructureDto } from './dto/update-fee-structure.dto';
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
    @Query('classLevel') classLevel?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('termId') termId?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.feeStructuresService.list({
      feeCategoryId,
      classId,
      classLevel,
      academicYearId,
      termId,
      isActive,
    });
  }

  @Get('matrix')
  @Roles(ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN)
  matrix(@Query('academicYearId') academicYearId: string, @Query('termId') termId?: string) {
    return this.feeStructuresService.matrix({ academicYearId, termId });
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
}
