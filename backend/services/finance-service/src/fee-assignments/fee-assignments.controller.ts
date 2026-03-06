import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { AssignFeeDto } from './dto/assign-fee.dto';
import { BulkAssignFeeDto } from './dto/bulk-assign-fee.dto';
import { FeeAssignmentsService } from './fee-assignments.service';

@ApiTags('Finance - Fee Assignments')
@Controller('finance/fee-assignments')
export class FeeAssignmentsController {
  constructor(private readonly feeAssignmentsService: FeeAssignmentsService) {}

  @Post('bulk')
  @Roles(ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN)
  bulk(@Body() dto: BulkAssignFeeDto, @CurrentUser() user?: RequestUser) {
    return this.feeAssignmentsService.bulk(dto, user!);
  }

  @Post(':studentId')
  @Roles(ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN)
  assign(@Param('studentId') studentId: string, @Body() dto: AssignFeeDto, @CurrentUser() user?: RequestUser) {
    return this.feeAssignmentsService.assign(studentId, dto, user!);
  }

  @Get()
  @Roles(ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN)
  list(
    @Query('studentId') studentId?: string,
    @Query('feeCategoryId') feeCategoryId?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('termId') termId?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.feeAssignmentsService.list({ studentId, feeCategoryId, academicYearId, termId, isActive });
  }

  @Delete(':id')
  @Roles(ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user?: RequestUser) {
    return this.feeAssignmentsService.remove(id, user!);
  }
}
