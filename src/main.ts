import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  // CORS 설정: 환경변수 기반 + 개발 환경 지원
  const corsOrigins: string[] = [];
  
  // 환경변수에서 프론트엔드 URL 읽기 (CORS_ORIGIN 또는 FRONTEND_URL)
  const frontendUrl = process.env.CORS_ORIGIN || process.env.FRONTEND_URL;
  
  if (frontendUrl) {
    // 여러 URL을 쉼표로 구분하여 설정 가능
    const urls = frontendUrl.split(',').map(url => url.trim()).filter(Boolean);
    corsOrigins.push(...urls);
  }
  
  // 개발 환경에서는 localhost 허용 (프로덕션에서는 필요시에만 추가)
  const isDevelopment = process.env.NODE_ENV !== 'production';
  if (isDevelopment) {
    corsOrigins.push('http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173', 'http://localhost:5174');
  }
  
  // 최소한 하나의 origin이 있어야 함 (없으면 모든 origin 허용)
  const allowedOrigins = corsOrigins.length > 0 ? corsOrigins : true;
  console.log('✅ CORS Allowed Origins:', allowedOrigins);

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Set-Cookie'],
    exposedHeaders: ['Authorization', 'Set-Cookie'],
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Server running on port ${port}`);
}
bootstrap();


