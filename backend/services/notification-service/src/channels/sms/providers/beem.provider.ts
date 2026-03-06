import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { ISmsProvider, SmsSendResult } from './sms-provider.interface';

@Injectable()
export class BeemProvider implements ISmsProvider {
  async send(to: string[], message: string, senderId?: string): Promise<SmsSendResult[]> {
    try {
      const response = await axios.post(
        'https://apisms.beem.africa/v1/send',
        {
          source_addr: senderId || process.env.BEEM_SOURCE_ADDR || process.env.SMS_SENDER_ID,
          schedule_time: '',
          encoding: 0,
          message,
          recipients: to.map((dest_addr, idx) => ({ recipient_id: idx + 1, dest_addr })),
        },
        {
          auth: {
            username: process.env.BEEM_API_KEY || '',
            password: process.env.BEEM_SECRET_KEY || '',
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
