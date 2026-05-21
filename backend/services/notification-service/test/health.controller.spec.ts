import { HealthController } from '../src/health/health.controller';

describe('notification-service health', () => {
  it('returns queue stats in the public health payload', async () => {
    const queues = {
      stats: jest.fn().mockResolvedValue({ waiting: 0, active: 0, failed: 0 }),
    };
    const payload = await new HealthController(queues as any).health();

    expect(payload).toMatchObject({
      status: 'ok',
      service: 'notification-service',
      queues: { waiting: 0, active: 0, failed: 0 },
    });
    expect(Date.parse(payload.timestamp)).not.toBeNaN();
    expect(queues.stats).toHaveBeenCalledTimes(1);
  });
});
