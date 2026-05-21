import { HealthController } from '../src/health/health.controller';
import { HealthService } from '../src/health/health.service';

describe('student-service health', () => {
  it('returns a public health payload', () => {
    const payload = new HealthController(new HealthService()).check();

    expect(payload).toMatchObject({
      status: 'ok',
      service: 'student-service',
    });
    expect(Date.parse(payload.timestamp)).not.toBeNaN();
  });
});
