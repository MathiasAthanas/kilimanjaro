import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ISmsProvider, SmsSendResult } from './sms-provider.interface';

@Injectable()
export class GenericHttpProvider implements ISmsProvider {
  constructor(private readonly config: ConfigService) {}

  async send(to: string[], message: string): Promise<SmsSendResult[]> {
    const method = (this.config.get<string>('SMS_GENERIC_METHOD', 'POST')).toUpperCase();
    const url = this.config.get<string>('SMS_GENERIC_URL', '');
    const phoneParam = this.config.get<string>('SMS_GENERIC_PHONE_PARAM', 'to');
    const messageParam = this.config.get<string>('SMS_GENERIC_MESSAGE_PARAM', 'message');
    const authHeader = this.config.get<string>('SMS_GENERIC_AUTH_HEADER', 'Authorization');
    const authValue = this.config.get<string>('SMS_GENERIC_AUTH_VALUE', '');

    const headers = authValue ? { [authHeader]: authValue } : {};

    const out: SmsSendResult[] = [];
    for (const phone of to) {
      try {
        if (method === 'GET') {
          await axios.get(url, { params: { [phoneParam]: phone, [messageParam]: message }, headers, timeout: 15000 });
        } else {
          await axios.post(url, { [phoneParam]: phone, [messageParam]: message }, { headers, timeout: 15000 });
        }
        out.push({ phone, success: true });
      } catch (error) {
        out.push({ phone, success: false, failureReason: (error as Error).message });
      }
    }

    return out;
  }
}
