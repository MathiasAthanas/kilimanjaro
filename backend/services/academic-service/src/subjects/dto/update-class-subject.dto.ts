import { PartialType } from '@nestjs/swagger';
import { CreateClassSubjectDto } from './create-class-subject.dto';

export class UpdateClassSubjectDto extends PartialType(CreateClassSubjectDto) {}
