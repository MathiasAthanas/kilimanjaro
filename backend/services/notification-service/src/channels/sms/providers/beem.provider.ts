import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ISmsProvider, SmsSendResult } from './sms-provider.interface';

@Injectable()
export class BeemProvider implements ISmsProvider {
  constructor(private readonly config: ConfigService) {}

  async send(to: string[], message: string, senderId?: string): Promise<SmsSendResult[]> {
    try {
      const response = await axios.post(
        'https://apisms.beem.africa/v1/send',
        {
          source_addr: senderId || this.config.get<string>('BEEM_SOURCE_ADDR') || this.config.get<string>('SMS_SENDER_ID'),
          schedule_time: '',
          encoding: 0,
          message,
          recipients: to.map((dest_addr, idx) => ({ recipient_id: idx + 1, dest_addr })),
        },
        {
          auth: {
            username: this.config.get<string>('BEEM_API_KEY', ''),
            password: this.config.get<string>('BEEM_SECRET_KEY', ''),
          },
        },
      );

      return to.map((phone) => ({
        phone,
        success: Boolean(response.data?.successful),
        messageId: response.data?.request_id,
      }));
    } catch (error) {
      return to.map((phone) => ({ phone, success: false, failureReason: (error as Error).message }));
    }
  }
}
