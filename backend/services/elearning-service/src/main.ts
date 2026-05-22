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

  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.enableCors({
    origin: (config.get<string>('ALLOWED_ORIGINS', 'http://localhost:5173') || '').split(',').map((item) => item.trim()),
    credentials: true,
  });

  if (config.get<string>('NODE_ENV') !== 'production') {
    const swagger = new DocumentBuilder()
      .setTitle('Kilimanjaro E-Learning Service')
      .setDescription('Courses, lessons, materials, assignments, quizzes, progress and e-learning analytics')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('elearning/docs', app, SwaggerModule.createDocument(app, swagger));
  }

  await app.listen(Number(config.get<string>('PORT', '3007')));
}

bootstrap();
