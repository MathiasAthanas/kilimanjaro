import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as express from 'express';
import helmet from 'helmet';
import * as morgan from 'morgan';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  // Nginx is the single trusted reverse proxy in production. This makes
  // Express use its X-Forwarded-For value instead of grouping everyone under
  // the loopback address for public rate limiting and audit metadata.
  app.set('trust proxy', 1);

  // The dashboard and API intentionally use separate HTTPS subdomains. CORS
  // still restricts callers, while CORP must permit the browser to finish
  // authenticated binary downloads such as report-card ZIP archives.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(morgan(configService.get<string>('NODE_ENV') === 'production' ? 'combined' : 'dev'));

  const requestLimit = configService.get<string>('REQUEST_BODY_LIMIT', '100mb');
  app.use(express.json({ limit: requestLimit }));
  app.use(express.urlencoded({ extended: true, limit: requestLimit }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const allowedOrigins = (
    configService.get<string>(
      'ALLOWED_ORIGINS',
      'http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173',
    ) || ''
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Accept-Language',
      'X-Active-School',
      'x-active-school',
      'x-internal-api-key',
      'x-correlation-id',
    ],
    credentials: true,
  });

  if (configService.get<string>('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Kilimanjaro Schools - API Gateway')
      .setDescription(
        'Single public gateway for all Kilimanjaro services. Public routes: /health, /auth/login, /auth/refresh, /auth/password-reset/*; all other routes are proxied to downstream services.',
      )
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  const port = Number(configService.get<string>('PORT', '3000'));
  await app.listen(port);
}

bootstrap();
