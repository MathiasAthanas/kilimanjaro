import { Module } from '@nestjs/common';
import { StudentClientModule } from '../student-client/student-client.module';
import { DefaulterContactsController } from './defaulter-contacts.controller';
import { DefaulterContactsService } from './defaulter-contacts.service';

@Module({
  imports: [StudentClientModule],
  controllers: [DefaulterContactsController],
  providers: [DefaulterContactsService],
})
export class DefaulterContactsModule {}
