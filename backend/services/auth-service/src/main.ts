import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });
  const configService = app.get(ConfigService);

  app.use(helmet());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor(),);

  app.enableCors({
    origin: (configService.get<string>('ALLOWED_ORIGINS', 'http://localhost:3000') || '')
      .split(',')
      .map((item) => item.trim()),
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');

  if (configService.get<string>('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Kilimanjaro Auth Service')
      .setDescription('Authentication and authorization service')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('auth/docs', app, document);
  }

  const port = Number(configService.get<string>('PORT', '3001'));
  await app.listen(port);
}

bootstrap();
