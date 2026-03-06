export interface SmsSendResult {
  phone: string;
  success: boolean;
  messageId?: string;
  cost?: string;
  failureReason?: string;
}

export interface ISmsProvider {
  send(to: string[], message: string, senderId?: string): Promise<SmsSendResult[]>;
}
