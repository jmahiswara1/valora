import { requestContext } from './request-context.js';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Injectable, NestInterceptor, PipeTransform, CallHandler, ExecutionContext } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { z } from 'zod';

export type AppRequest = Request & { requestId?: string; actor?: { id: string; role: 'USER' | 'ADMIN'; sessionId: string; emailVerifiedAt: Date | null } };

export class AppException extends HttpException {
  constructor(status: number, public readonly code: string, message: string, public readonly details?: unknown) {
    super(message, status);
  }
}

export function assert(condition: unknown, status: number, code: string, message: string): asserts condition {
  if (!condition) throw new AppException(status, code, message);
}

@Injectable()
export class ZodPipe implements PipeTransform {
  constructor(private readonly schema: z.ZodType) {}
  transform(value: unknown): unknown {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }));
      throw new AppException(HttpStatus.BAD_REQUEST, 'INVALID_INPUT', 'Periksa kembali data yang diisi.', details);
    }
    return parsed.data;
  }
}

@Injectable()
export class EnvelopeInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((value: unknown) => {
      const accessExpiresAt = requestContext.getStore()?.accessExpiresAt;
      const envelope = value && typeof value === 'object' && 'data' in value ? value as { data: unknown; meta?: Record<string, unknown> } : { data: value ?? null };
      return accessExpiresAt ? { ...envelope, meta: { ...('meta' in envelope ? envelope.meta : {}), accessExpiresAt } } : envelope;
    }));
  }
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<AppRequest>();
    const response = context.getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const code = exception instanceof AppException ? exception.code : status === 404 ? 'NOT_FOUND' : status === 401 ? 'UNAUTHENTICATED' : 'INTERNAL_ERROR';
    const message = exception instanceof AppException ? exception.message : status === 404 ? 'Halaman atau data tidak ditemukan.' : status === 401 ? 'Silakan masuk untuk melanjutkan.' : 'Terjadi kesalahan. Coba lagi.';
    const details = exception instanceof AppException ? exception.details : undefined;
    if (status >= 500) console.error(JSON.stringify({ event: 'request_failed', requestId: request.requestId, status, type: exception instanceof Error ? exception.name : 'Unknown' }));
    response.status(status).json({ error: { code, message, ...(details ? { details } : {}), requestId: request.requestId ?? randomUUID() } });
  }
}
