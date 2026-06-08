import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { VoidExpenseDto } from './dto/void-expense.dto';
import { ExpensesService } from './expenses.service';

@ApiTags('Finance - Expenses')
@Controller('finance/expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @Roles(ROLES.FINANCE, ROLES.SYSTEM_ADMIN)
  create(@Body() dto: CreateExpenseDto, @CurrentUser() user?: RequestUser) {
    return this.expensesService.create(dto, user!);
  }

  @Get()
  @Roles(ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN, ROLES.MANAGING_DIRECTOR, ROLES.BOARD_DIRECTOR)
  list(@Query() query: any) {
    return this.expensesService.list(query);
  }

  @Get('summary')
  @Roles(ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN, ROLES.MANAGING_DIRECTOR, ROLES.BOARD_DIRECTOR)
  summary(@Query() query: any) {
    return this.expensesService.summary(query);
  }

  @Get(':id')
  @Roles(ROLES.FINANCE, ROLES.PRINCIPAL, ROLES.SYSTEM_ADMIN, ROLES.MANAGING_DIRECTOR)
  byId(@Param('id') id: string) {
    return this.expensesService.byId(id);
  }

  @Patch(':id/void')
  @Roles(ROLES.FINANCE, ROLES.SYSTEM_ADMIN)
  void(@Param('id') id: string, @Body() dto: VoidExpenseDto, @CurrentUser() user?: RequestUser) {
    return this.expensesService.void(id, dto, user!);
  }
}
