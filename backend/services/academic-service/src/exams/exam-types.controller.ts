import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ROLES } from '../common/constants/roles';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateExamTypeDto, UpdateExamTypeDto } from './dto/exam-type.dto';
import { ExamTypesService } from './exam-types.service';

@ApiTags('Academic - Exam Types')
@Controller('academics')
export class ExamTypesController {
  constructor(private readonly examTypes: ExamTypesService) {}

  @Post('exam-types')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL, ROLES.SUPER_ADMIN, ROLES.ACADEMIC_QA)
  create(@Body() dto: CreateExamTypeDto, @CurrentUser() user?: RequestUser) {
    return this.examTypes.create(dto, user);
  }

  @Get('exam-types')
  @Roles(
    ROLES.SYSTEM_ADMIN,
    ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL, ROLES.SUPER_ADMIN,
    ROLES.ACADEMIC_QA,
    ROLES.HEAD_OF_DEPARTMENT,
    ROLES.TEACHER,
  )
  list(
    @Query('educationStage') educationStage?: string,
    @Query('isActive') isActive?: string,
    @CurrentUser() user?: RequestUser,
  ) {
    return this.examTypes.list(
      { educationStage, isActive: isActive === undefined ? undefined : isActive === 'true' },
      user,
    );
  }

  @Patch('exam-types/:id')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL, ROLES.SUPER_ADMIN, ROLES.ACADEMIC_QA)
  update(@Param('id') id: string, @Body() dto: UpdateExamTypeDto, @CurrentUser() user?: RequestUser) {
    return this.examTypes.update(id, dto, user);
  }

  @Delete('exam-types/:id')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL, ROLES.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user?: RequestUser) {
    return this.examTypes.remove(id, user);
  }

  @Post('exam-types/migrate-from-assessment-types')
  @Roles(ROLES.SYSTEM_ADMIN, ROLES.PRINCIPAL, ROLES.MANAGER, ROLES.HEAD_OF_SCHOOL, ROLES.SUPER_ADMIN)
  migrate(@CurrentUser() user?: RequestUser) {
    return this.examTypes.migrateFromAssessmentTypes(user);
  }
}
