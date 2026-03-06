import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService {
  private readonly logger = new Logger(FirebaseService.name);
  private initialized = false;

  constructor(private readonly config: ConfigService) {
    this.init();
  }

  private init() {
    const raw = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON', '');
    if (!raw) return;

    try {
      const credentials = JSON.parse(raw);
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(credentials),
        });
      }
      this.initialized = true;
    } catch (error) {
      this.logger.warn(`Firebase init skipped: ${(error as Error).message}`);
    }
  }

  app(): admin.app.App | null {
    if (!this.initialized || !admin.apps.length) return null;
    return admin.app();
  }
}
