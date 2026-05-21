import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { UiController } from './ui.controller';
import { UiApiService } from './ui-api.service';

describe('UiController routing', () => {
  let app: INestApplication;

  const uiService = {
    envelope: jest.fn((data: unknown, warnings: string[] = []) => ({
      data,
      meta: {
        generatedAt: '2026-05-21T00:00:00.000Z',
        source: 'gateway-ui',
        partial: warnings.length > 0,
        warnings,
      },
    })),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UiController],
      providers: [{ provide: UiApiService, useValue: uiService }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves root-prefixed UI routes', async () => {
    await request(app.getHttpServer())
      .get('/reports/catalog')
      .expect(200)
      .expect((response) => {
        expect(response.body.data.reports).toEqual(expect.any(Array));
      });
  });

  it('serves api-v1-prefixed UI routes used by the web dashboard', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/reports/catalog')
      .expect(200)
      .expect((response) => {
        expect(response.body.data.reports).toEqual(expect.any(Array));
      });
  });
});
