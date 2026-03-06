import { Global, Module } from '@nestjs/common';
import { EmailModule } from '../channels/email/email.module';
import { PushModule } from '../channels/push/push.module';
import { SmsModule } from '../channels/sms/sms.module';
import { QueuesModule } from '../queues/queues.module';
import { PreferencesModule } from '../preferences/preferences.module';
import { DispatchWorkersService } from './dispatch-workers.service';
import { DispatchService } from './dispatch.service';
import { RecipientResolverService } from './recipient-resolver.service';

@Global()
@Module({
  imports: [QueuesModule, PreferencesModule, SmsModule, EmailModule, PushModule],
  providers: [DispatchService, RecipientResolverService, DispatchWorkersService],
  exports: [DispatchService, RecipientResolverService],
})
export class DispatchModule {}
