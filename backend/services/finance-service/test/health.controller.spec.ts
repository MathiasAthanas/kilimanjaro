import { HealthController } from '../src/health/health.controller';
import { HealthService } from '../src/health/health.service';

describe('finance-service health', () => {
  it('returns a public health payload', () => {
    const payload = new HealthController(new HealthService()).getHealth();

    expect(payload).toMatchObject({
      status: 'ok',
      service: 'finance-service',
    });
    expect(Date.parse(payload.timestamp)).not.toBeNaN();
  });
});
