import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { ImportResultRow, ImportService } from './import.service';

@ApiTags('Academic - Import')
@Controller('academics/import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Get('reference')
  @Roles(
    ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMIN, ROLES.MANAGER,
    ROLES.PRINCIPAL, ROLES.HEAD_OF_SCHOOL,
    ROLES.ACADEMIC_QA,
  )
  reference(@CurrentUser() user?: RequestUser) {
    return this.importService.getReference(user!);
  }

  @Post('results')
  @Roles(
    ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMIN, ROLES.MANAGER,
    ROLES.PRINCIPAL, ROLES.HEAD_OF_SCHOOL,
    ROLES.ACADEMIC_QA,
  )
  importResults(
    @Body() body: { rows: ImportResultRow[] },
    @CurrentUser() user?: RequestUser,
  ) {
    return this.importService.importResults(body.rows ?? [], user!);
  }
}
