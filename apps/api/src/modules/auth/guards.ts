import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database.service.js';
import { type AppRequest, AppException } from '../../shared/http.js';
import { requestContext } from '../../shared/request-context.js';
import { sessionCookie } from './shared.js';
import { resolveSession } from './helpers.js';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly db: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AppRequest>();
    const rawToken = (request.cookies as Record<string, string> | undefined)?.[sessionCookie];
    if (!rawToken) throw new AppException(401, 'UNAUTHENTICATED', 'Silakan masuk untuk melanjutkan.');
    const session = await resolveSession(this.db, rawToken);
    if (!session || session.revokedAt || session.expiresAt <= new Date()) throw new AppException(401, 'UNAUTHENTICATED', 'Sesi berakhir. Silakan masuk lagi.');
    if (session.user.status !== 'ACTIVE') throw new AppException(403, 'ACCOUNT_SUSPENDED', 'Akun ini tidak dapat digunakan.');
    request.actor = { id: session.userId, role: session.user.role, sessionId: session.id, emailVerifiedAt: session.user.emailVerifiedAt };
    const store = requestContext.getStore(); if (store) store.actor = request.actor;
    return true;
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AppRequest>();
    if (request.actor?.role !== 'ADMIN') throw new AppException(403, 'FORBIDDEN', 'Halaman ini hanya untuk admin.');
    return true;
  }
}
