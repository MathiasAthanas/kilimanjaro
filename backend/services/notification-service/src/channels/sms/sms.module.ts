import { Module } from '@nestjs/common';
import { AfricasTalkingProvider } from './providers/africas-talking.provider';
import { BeemProvider } from './providers/beem.provider';
import { GenericHttpProvider } from './providers/generic-http.provider';
import { TwilioProvider } from './providers/twilio.provider';
import { SmsGatewayService } from './sms-gateway.service';

@Module({
  providers: [SmsGatewayService, AfricasTalkingProvider, BeemProvider, TwilioProvider, GenericHttpProvider],
  exports: [SmsGatewayService],
})
export class SmsModule {}
