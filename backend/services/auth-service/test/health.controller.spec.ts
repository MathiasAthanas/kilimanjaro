import { HealthController } from '../src/health/health.controller';
import { HealthService } from '../src/health/health.service';

describe('auth-service health', () => {
  it('returns a public health payload', () => {
    const payload = new HealthController(new HealthService()).check();

    expect(payload).toMatchObject({
      status: 'ok',
      service: 'auth-service',
    });
    expect(Date.parse(payload.timestamp)).not.toBeNaN();
  });
});
