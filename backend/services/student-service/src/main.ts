import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(helmet());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  app.enableCors({
    origin: (config.get<string>('ALLOWED_ORIGINS', 'http://localhost:3000') || '')
      .split(',')
      .map((item) => item.trim()),
    credentials: true,
  });

  if (config.get<string>('NODE_ENV') !== 'production') {
    const swagger = new DocumentBuilder()
      .setTitle('Kilimanjaro Student Service')
      .setDescription('Student lifecycle, attendance, discipline and performance tracking engine')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swagger);
    SwaggerModule.setup('students/docs', app, document);
  }

  const port = Number(config.get<string>('PORT', '3002'));
  await app.listen(port);
}

bootstrap();