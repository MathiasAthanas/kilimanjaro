import { HttpModule } from '@nestjs/axios';
import { Global, Module } from '@nestjs/common';
import { AuthClientService } from './auth-client.service';

@Global()
@Module({
  imports: [HttpModule],
  providers: [AuthClientService],
  exports: [AuthClientService],
})
export class AuthClientModule {}
