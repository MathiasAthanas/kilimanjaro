import { Test } from '@nestjs/testing';
import { HealthController } from '../src/health/health.controller';
import { PrismaService } from '../src/prisma/prisma.service';

describe('HealthController', () => {
  it('returns service health', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) } }],
    }).compile();

    const result = await moduleRef.get(HealthController).health();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('elearning-service');
  });
});
