import { HttpModule } from '@nestjs/axios';
import { Global, Module } from '@nestjs/common';
import { StudentClientService } from './student-client.service';

@Global()
@Module({
  imports: [HttpModule],
  providers: [StudentClientService],
  exports: [StudentClientService],
})
export class StudentClientModule {}
