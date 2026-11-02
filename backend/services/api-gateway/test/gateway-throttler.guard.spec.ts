import { GatewayThrottlerGuard } from '../src/common/guards/gateway-throttler.guard';

describe('GatewayThrottlerGuard', () => {
  const guard = Object.create(GatewayThrottlerGuard.prototype) as GatewayThrottlerGuard;

  it('tracks protected requests by authenticated user', async () => {
    await expect((guard as any).getTracker({
      ip: '203.0.113.10',
      user: { id: 'user-123' },
    })).resolves.toBe('user:user-123');
  });

  it('tracks public requests by the real client IP', async () => {
    await expect((guard as any).getTracker({ ip: '203.0.113.10' }))
      .resolves.toBe('ip:203.0.113.10');
  });
});
