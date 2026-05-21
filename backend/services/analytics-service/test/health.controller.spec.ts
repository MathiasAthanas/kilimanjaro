import { HealthController } from '../src/health/health.controller';

describe('analytics-service health', () => {
  it('returns a public health payload', () => {
    const payload = new HealthController().health();

    expect(payload).toMatchObject({
      status: 'ok',
      service: 'analytics-service',
    });
    expect(Date.parse(payload.timestamp)).not.toBeNaN();
  });
});
