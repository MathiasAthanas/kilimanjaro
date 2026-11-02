import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

type TrackedRequest = {
  ip?: string;
  user?: { id?: string };
};

@Injectable()
export class GatewayThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: TrackedRequest): Promise<string> {
    const userId = req.user?.id;
    if (userId) return `user:${userId}`;
    return `ip:${req.ip || 'unknown'}`;
  }
}
