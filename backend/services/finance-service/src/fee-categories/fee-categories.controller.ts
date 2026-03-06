import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateFeeCategoryDto } from './dto/create-fee-category.dto';
import { ReorderCategoriesDto } from './dto/reorder-categories.dto';
import { UpdateFeeCategoryDto } from './dto/update-fee-category.dto';
import { FeeCategoriesService } from './fee-categories.service';

@ApiTags('Finance - Fee Categories')
@Controller('finance/fee-categories')
export class FeeCategoriesController {
  constructor(private readonly feeCategoriesService: FeeCategoriesService) {}

  @Post()
  @Roles(ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN)
  create(@Body() dto: CreateFeeCategoryDto, @CurrentUser() user?: RequestUser) {
    return this.feeCategoriesService.create(dto, user!);
  }

  @Get()
  @Roles(
    ROLES.FINANCE,
    ROLES.PRINCIPAL,
    ROLES.SYSTEM_ADMIN,
    ROLES.MANAGING_DIRECTOR,
    ROLES.BOARD_DIRECTOR,
    ROLES.ACADEMIC_QA,
    ROLES.TEACHER,
  )
  list(
    @Query('isActive') isActive?: string,
    @Query('isOptional') isOptional?: string,
    @Query('isBillablePerTerm') isBillablePerTerm?: string,
  ) {
    return this.feeCategoriesService.list({ isActive, isOptional, isBillablePerTerm });
  }

  @Get(':id')
  @Roles(
    ROLES.FINANCE,
    ROLES.PRINCIPAL,
    ROLES.SYSTEM_ADMIN,
    ROLES.MANAGING_DIRECTOR,
    ROLES.BOARD_DIRECTOR,
    ROLES.ACADEMIC_QA,
    ROLES.TEACHER,
  )
  byId(@Param('id') id: string) {
    return this.feeCategoriesService.byId(id);
  }

  @Patch(':id')
  @Roles(ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateFeeCategoryDto, @CurrentUser() user?: RequestUser) {
    return this.feeCategoriesService.update(id, dto, user!);
  }

  @Delete(':id')
  @Roles(ROLES.SYSTEM_ADMIN)
  remove(@Param('id') id: string) {
    return this.feeCategoriesService.delete(id);
  }

  @Patch('reorder')
  @Roles(ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN)
  reorder(@Body() dto: ReorderCategoriesDto) {
    return this.feeCategoriesService.reorder(dto);
  }
}
