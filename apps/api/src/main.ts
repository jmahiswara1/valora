import 'reflect-metadata';
import { requestContext } from './shared/request-context.js';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import type { NextFunction, Response } from 'express';
import { AppModule } from './app.module.js';
import { ApiExceptionFilter, AppException, type AppRequest, EnvelopeInterceptor } from './shared/http.js';
import { config } from './infrastructure/config.js';
import { completeOpenApi } from './openapi/index.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use((_request: AppRequest, _response: Response, next: NextFunction) => requestContext.run({}, next));
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cookieParser());
  app.use('/api/v1/media/uploads', express.raw({ type: '*/*', limit: '8mb' }));
  app.use('/api/v1/me/profile-photo', express.raw({ type: 'image/webp', limit: '1mb' }));
  app.use(express.json({ limit: '1mb' }));
  app.use((request: AppRequest, response: Response, next: NextFunction) => {
    request.requestId = randomUUID();
    response.setHeader('X-Request-Id', request.requestId);
    response.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use((request: AppRequest, _response: Response, next: NextFunction) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method) || !request.path.startsWith('/api/v1/')) return next();
    if (request.headers.origin && request.headers.origin !== config.webOrigin) return next(new AppException(403, 'FORBIDDEN', 'Origin permintaan tidak diizinkan.'));
    const cookie = (request.cookies as Record<string, string> | undefined)?.valora_csrf;
    const header = request.headers['x-csrf-token'];
    if (!cookie || typeof header !== 'string') return next(new AppException(403, 'FORBIDDEN', 'Token keamanan formulir tidak ada.'));
    const a = Buffer.from(cookie);
    const b = Buffer.from(header);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return next(new AppException(403, 'FORBIDDEN', 'Token keamanan formulir tidak valid.'));
    next();
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new EnvelopeInterceptor());

  if (config.appEnv === 'local') {
    const swaggerConfig = new DocumentBuilder().setTitle('Valora API').setDescription('Kontrak API Valora termasuk Favorit, pusat notifikasi, Passport QR, pencarian tersimpan, profil publik dan ulasan transaksi.').setVersion('1.12.0').build();
    const document = completeOpenApi(SwaggerModule.createDocument(app, swaggerConfig));
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(config.apiPort, '127.0.0.1');
  console.log('Valora API siap di http://127.0.0.1:' + config.apiPort);
}

void bootstrap();
