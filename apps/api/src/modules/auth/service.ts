import { AppException } from '../../shared/http.js';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database.service.js';
import { MailService } from '../../infrastructure/mail.service.js';
import { ProfilePhotoService } from '../profile/photo.service.js';
import { verify, hash, Algorithm } from '@node-rs/argon2';
import { serial, lockRows, closeForAccount } from '../../shared/transactions.js';
import { requireRecentAuthentication } from '../../shared/actions.js';
import type { Prisma, VerificationPurpose } from '../../generated/prisma/client.js';
import { config, cookieSecure } from '../../infrastructure/config.js';
import type { RegisterInput, LoginInput, UserDto } from '@valora/contracts';
import type { Response } from 'express';
import { sha256, randomToken, sevenDays, sessionCookie } from './shared.js';
import { resolveSession } from './helpers.js';

const thirtyMinutes = 30 * 60 * 1000;

function rethrowEmailConflict(error: unknown): never {
  if (error instanceof Error && 'code' in error && error.code === 'P2002') throw new AppException(409, 'EMAIL_IN_USE', 'Email sudah digunakan.');
  throw error;
}

@Injectable()
export class AuthService {
  constructor(private readonly db: DatabaseService, private readonly mail: MailService, private readonly photos: ProfilePhotoService) {}


  async rateLimit(key: string, maximum: number, windowMs: number): Promise<void> {
    const bucket = await this.db.$queryRaw<{ count: number }[]>`
      INSERT INTO "AuthRateBucket" ("key", "count", "resetAt") VALUES (${sha256(key)}, 1, (NOW() AT TIME ZONE 'UTC') + ${windowMs} * INTERVAL '1 millisecond')
      ON CONFLICT ("key") DO UPDATE SET "count" = CASE WHEN "AuthRateBucket"."resetAt" <= (NOW() AT TIME ZONE 'UTC') THEN 1 ELSE "AuthRateBucket"."count" + 1 END,
      "resetAt" = CASE WHEN "AuthRateBucket"."resetAt" <= (NOW() AT TIME ZONE 'UTC') THEN EXCLUDED."resetAt" ELSE "AuthRateBucket"."resetAt" END RETURNING "count"`;
    if (bucket[0].count > maximum) throw new AppException(429, 'RATE_LIMITED', 'Terlalu banyak percobaan. Tunggu sebentar.');
  }
  async session(rawToken?: string) {
    const now = new Date();
    const base = { serverTime: now.toISOString(), user: null, sessionId: null, expiresAt: null, reauthenticatedUntil: null };
    const row = await resolveSession(this.db, rawToken);
    if (!row || row.revokedAt || row.expiresAt <= now) return { ...base, state: 'GUEST', reason: rawToken ? 'SESSION_ENDED' : null };
    if (row.user.status !== 'ACTIVE') return { ...base, state: 'RESTRICTED', reason: row.user.status };
    return { ...base, state: 'AUTHENTICATED', reason: null, user: await this.publicUser(row.userId), sessionId: row.id, expiresAt: row.expiresAt.toISOString(), reauthenticatedUntil: new Date(row.reauthenticatedAt.getTime() + 900000).toISOString() };
  }
  async reauthenticate(id: string, sessionId: string, password: string) {
    await this.rateLimit('reauth:' + sessionId, 7, 900000);
    const user = await this.db.user.findUniqueOrThrow({ where: { id } });
    if (!await verify(user.passwordHash, password)) throw new AppException(401, 'INVALID_CREDENTIALS', 'Kata sandi salah.');
    return serial(this.db, async (tx) => {
      const fresh = await tx.user.findUniqueOrThrow({ where: { id } });
      if (fresh.passwordHash !== user.passwordHash) throw new AppException(409, 'STATE_CONFLICT', 'Kata sandi sudah berubah.');
      const now = new Date(); await tx.session.update({ where: { id: sessionId }, data: { reauthenticatedAt: now } });
      return { reauthenticatedUntil: new Date(now.getTime() + 900000).toISOString() };
    });
  }
  async sessions(id: string, currentId: string, cursor?: string) {
    if (cursor && !/^[0-9a-f-]{36}$/i.test(cursor)) throw new AppException(400, 'INVALID_INPUT', 'Cursor tidak valid.');
    const rows = await this.db.session.findMany({ where: { userId: id, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { id: 'asc' }, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), take: 31 });
    return { data: rows.slice(0, 30).map((r) => ({ id: r.id, createdAt: r.createdAt.toISOString(), lastSeenAt: r.lastSeenAt.toISOString(), expiresAt: r.expiresAt.toISOString(), current: r.id === currentId })), meta: { nextCursor: rows.length > 30 ? rows[29].id : null } };
  }
  async revoke(id: string, currentId: string, target?: string) {
    if (target && !/^[0-9a-f-]{36}$/i.test(target)) throw new AppException(404, 'NOT_FOUND', 'Sesi tidak ditemukan.');
    return serial(this.db, async (tx) => {
      if (target) { const found = await tx.session.findFirst({ where: { id: target, userId: id } }); if (!found) throw new AppException(404, 'NOT_FOUND', 'Sesi tidak ditemukan.'); }
      if (target !== currentId) await requireRecentAuthentication(tx);
      const result = await tx.session.updateMany({ where: { userId: id, revokedAt: null, ...(target ? { id: target } : { id: { not: currentId } }) }, data: { revokedAt: new Date() } });
      return { revoked: result.count };
    });
  }
  async actionStatus(actorId: string, operation: string, key: string) {
    const row = await this.db.idempotencyRequest.findUnique({ where: { actorId_key_operation: { actorId, key, operation } } });
    if (row) return { status: row.purgedAt ? 'PURGED' : 'COMMITTED', completedAt: row.completedAt.toISOString() };
    const [name, id] = operation.split(':');
    if (name === 'repair-correct' || name === 'repair-void') {
      const repair = await this.db.repairCorrection.findUnique({ where: { createdById_idempotencyKey: { createdById: actorId, idempotencyKey: key } } });
      if (repair && repair.repairId === id && repair.kind === (name === 'repair-void' ? 'VOID' : 'CORRECTION')) return { status: repair.responseSnapshot ? 'COMMITTED' : 'PURGED', completedAt: repair.createdAt.toISOString() };
    }
    if (name === 'moderation') {
      const review = await this.db.moderationReview.findUnique({ where: { reviewerId_idempotencyKey: { reviewerId: actorId, idempotencyKey: key } } });
      if (review && review.listingRevisionId === id) return { status: 'COMMITTED', completedAt: review.createdAt.toISOString() };
    }
    return { status: 'NOT_FOUND', completedAt: null };
  }
  private async createMailToken(tx: Prisma.TransactionClient, userId: string, purpose: VerificationPurpose, email: string): Promise<void> {
    const now = new Date();
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.status !== 'ACTIVE') return;
    await tx.verificationToken.updateMany({ where: { userId, purpose, usedAt: null }, data: { usedAt: now } });
    const raw = randomToken();
    const expiresAt = new Date(Date.now() + thirtyMinutes);
    await tx.verificationToken.create({ data: { userId, purpose, tokenHash: sha256(raw), expiresAt } });
    const path = purpose === 'PASSWORD_RESET' ? '/reset-password?token=' : '/verifikasi-email?token=';
    const action = purpose === 'PASSWORD_RESET' ? 'Atur ulang kata sandi' : 'Verifikasi email';
    await this.mail.queue(tx, email, action + ' Valora', action + ' melalui tautan berikut. Tautan berlaku 30 menit dan hanya dapat digunakan sekali.\n\n' + config.appBaseUrl + path + encodeURIComponent(raw), expiresAt);
  }

  async register(input: RegisterInput): Promise<{ id: string; email: string; emailVerifiedAt: null }> {
    const city = await this.db.city.findFirst({ where: { id: input.cityId, active: true } });
    if (!city) throw new AppException(400, 'INVALID_INPUT', 'Pilih kota yang tersedia.');
    if (await this.db.user.findUnique({ where: { email: input.email } })) throw new AppException(409, 'EMAIL_IN_USE', 'Email sudah digunakan.');
    const passwordHash = await hash(input.password, { algorithm: Algorithm.Argon2id });
    const user = await serial(this.db, async (tx) => {
      const created = await tx.user.create({ data: { email: input.email, displayName: input.displayName, cityId: input.cityId, passwordHash } });
      await this.createMailToken(tx, created.id, 'EMAIL_VERIFY', created.email);
      return created;
    }).catch(rethrowEmailConflict);
    await this.mail.flushDue();
    return { id: user.id, email: user.email, emailVerifiedAt: null };
  }

  async verifyEmail(raw: string): Promise<{ emailVerifiedAt: string }> {
    const now = new Date();
    const token = await this.db.verificationToken.findUnique({ where: { tokenHash: sha256(raw) }, include: { user: true } });
    if (!token || token.usedAt || token.expiresAt <= now || token.purpose === 'PASSWORD_RESET') throw new AppException(400, 'INVALID_TOKEN', 'Tautan verifikasi tidak berlaku.');
    await serial(this.db, async (tx) => {
      await lockRows(tx, 'User', [token.userId]);
      const user = await tx.user.findUniqueOrThrow({ where: { id: token.userId } });
      if (user.status !== 'ACTIVE') throw new AppException(400, 'INVALID_TOKEN', 'Tautan tidak berlaku untuk akun ini.');
      const claimed = await tx.verificationToken.updateMany({ where: { id: token.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
      if (claimed.count !== 1) throw new AppException(400, 'INVALID_TOKEN', 'Tautan verifikasi sudah digunakan.');
      if (token.purpose === 'EMAIL_CHANGE') {
        if (!token.user.pendingEmail) throw new AppException(400, 'INVALID_TOKEN', 'Permintaan perubahan email tidak berlaku.');
        const existing = await tx.user.findUnique({ where: { email: token.user.pendingEmail } });
        if (existing && existing.id !== token.userId) throw new AppException(409, 'EMAIL_IN_USE', 'Email sudah digunakan.');
        await tx.user.update({ where: { id: token.userId }, data: { email: token.user.pendingEmail, pendingEmail: null, emailVerifiedAt: now, version: { increment: 1 } } });
      } else {
        await tx.user.update({ where: { id: token.userId }, data: { emailVerifiedAt: now, version: { increment: 1 } } });
      }
    }).catch(rethrowEmailConflict);
    return { emailVerifiedAt: now.toISOString() };
  }

  async resendVerification(email: string): Promise<{ message: string }> {
    const user = await this.db.user.findFirst({ where: { OR: [{ email }, { pendingEmail: email }], status: 'ACTIVE' } });
    if (user && (!user.emailVerifiedAt || user.pendingEmail)) {
      const purpose: VerificationPurpose = user.pendingEmail ? 'EMAIL_CHANGE' : 'EMAIL_VERIFY';
      await serial(this.db, async (tx) => this.createMailToken(tx, user.id, purpose, user.pendingEmail ?? user.email));
      await this.mail.flushDue();
    }
    return { message: 'Jika email dapat diverifikasi, tautan baru telah dikirim.' };
  }

  async login(input: LoginInput, response: Response, oldToken?: string): Promise<UserDto> {
    const user = await this.db.user.findUnique({ where: { email: input.email } });
    if (!user || !(await verify(user.passwordHash, input.password))) throw new AppException(401, 'INVALID_CREDENTIALS', 'Email atau kata sandi salah.');
    if (user.status !== 'ACTIVE') throw new AppException(403, 'ACCOUNT_SUSPENDED', 'Akun ini tidak dapat digunakan.');
    const token = randomToken();
    await serial(this.db, async (tx) => {
      await lockRows(tx, 'User', [user.id]);
      const fresh = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
      if (fresh.status !== 'ACTIVE' || fresh.passwordHash !== user.passwordHash) throw new AppException(401, 'INVALID_CREDENTIALS', 'Akun berubah. Masuk kembali.');
      if (oldToken) await tx.session.updateMany({ where: { tokenHash: sha256(oldToken), revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.session.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + sevenDays), reauthenticatedAt: new Date() } });
    });
    response.cookie(sessionCookie, token, { httpOnly: true, secure: cookieSecure, sameSite: 'lax', path: '/', maxAge: sevenDays });
    return this.publicUser(user.id);
  }

  async logout(rawToken: string | undefined, response: Response): Promise<{ loggedOut: true }> {
    if (rawToken) await serial(this.db, async (tx) => {
      const session = await tx.session.findUnique({ where: { tokenHash: sha256(rawToken) } });
      if (session) { await lockRows(tx, 'User', [session.userId]); await tx.session.updateMany({ where: { id: session.id, revokedAt: null }, data: { revokedAt: new Date() } }); }
    });
    response.clearCookie(sessionCookie, { httpOnly: true, secure: cookieSecure, sameSite: 'lax', path: '/' });
    return { loggedOut: true };
  }

  async requestReset(email: string): Promise<{ message: string }> {
    const user = await this.db.user.findUnique({ where: { email } });
    if (user?.status === 'ACTIVE') {
      await serial(this.db, async (tx) => this.createMailToken(tx, user.id, 'PASSWORD_RESET', user.email));
      await this.mail.flushDue();
    }
    return { message: 'Jika akun tersedia, tautan pemulihan telah dikirim.' };
  }

  async confirmReset(raw: string, password: string): Promise<{ passwordChanged: true }> {
    const now = new Date();
    const token = await this.db.verificationToken.findUnique({ where: { tokenHash: sha256(raw) } });
    if (!token || token.purpose !== 'PASSWORD_RESET' || token.usedAt || token.expiresAt <= now) throw new AppException(400, 'INVALID_TOKEN', 'Tautan pemulihan tidak berlaku.');
    const passwordHash = await hash(password, { algorithm: Algorithm.Argon2id });
    await serial(this.db, async (tx) => {
      await lockRows(tx, 'User', [token.userId]);
      const user = await tx.user.findUniqueOrThrow({ where: { id: token.userId } });
      if (user.status !== 'ACTIVE') throw new AppException(400, 'INVALID_TOKEN', 'Tautan tidak berlaku untuk akun ini.');
      const claimed = await tx.verificationToken.updateMany({ where: { id: token.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
      if (claimed.count !== 1) throw new AppException(400, 'INVALID_TOKEN', 'Tautan pemulihan sudah digunakan.');
      await tx.user.update({ where: { id: token.userId }, data: { passwordHash, version: { increment: 1 } } });
      await tx.session.updateMany({ where: { userId: token.userId, revokedAt: null }, data: { revokedAt: now } });
    });
    return { passwordChanged: true };
  }

  async publicUser(id: string): Promise<UserDto> {
    const user = await this.db.user.findUniqueOrThrow({ where: { id }, include: { city: true } });
    if (!user.city) throw new AppException(409, 'STATE_CONFLICT', 'Kota profil belum tersedia.');
    return {
      id: user.id, email: user.email, displayName: user.displayName, profilePhotoPublic: user.profilePhotoPublic,
      city: { id: user.city.id, code: user.city.code, name: user.city.name, provinceName: user.city.provinceName },
      role: user.role, status: user.status, emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      ...await this.photos.fields(id),
    };
  }

  async patchProfile(id: string, input: { displayName?: string; cityId?: string; email?: string; profilePhotoPublic?: boolean }): Promise<UserDto> {
    const current = await this.db.user.findUniqueOrThrow({ where: { id } });
    if (input.cityId && !(await this.db.city.findFirst({ where: { id: input.cityId, active: true } }))) throw new AppException(400, 'INVALID_INPUT', 'Pilih kota yang tersedia.');
    if (input.email && input.email !== current.email) {
      const existing = await this.db.user.findUnique({ where: { email: input.email } });
      if (existing) throw new AppException(409, 'EMAIL_IN_USE', 'Email sudah digunakan.');
    }
    await serial(this.db, async (tx) => {
      await lockRows(tx, 'User', [id]);
      if (input.email && input.email !== current.email) await requireRecentAuthentication(tx);
      await tx.user.update({ where: { id }, data: {
        ...(input.displayName ? { displayName: input.displayName } : {}),
        ...(input.profilePhotoPublic !== undefined ? { profilePhotoPublic: input.profilePhotoPublic } : {}),
        ...(input.cityId ? { cityId: input.cityId } : {}),
        ...(input.email && input.email !== current.email ? { pendingEmail: input.email } : {}),
        version: { increment: 1 },
      } });
      if (input.email && input.email !== current.email) await this.createMailToken(tx, id, 'EMAIL_CHANGE', input.email);
    });
    if (input.email && input.email !== current.email) await this.mail.flushDue();
    return this.publicUser(id);
  }

  async changePassword(id: string, sessionId: string, currentPassword: string, newPassword: string): Promise<{ passwordChanged: true }> {
    const user = await this.db.user.findUniqueOrThrow({ where: { id } });
    if (!(await verify(user.passwordHash, currentPassword))) throw new AppException(400, 'INVALID_CREDENTIALS', 'Kata sandi saat ini salah.');
    const passwordHash = await hash(newPassword, { algorithm: Algorithm.Argon2id });
    await serial(this.db, async (tx) => {
      await lockRows(tx, 'User', [id]);
      const fresh = await tx.user.findUniqueOrThrow({ where: { id } });
      if (fresh.passwordHash !== user.passwordHash) throw new AppException(409, 'STATE_CONFLICT', 'Kata sandi sudah berubah.');
      await tx.session.update({ where: { id: sessionId }, data: { reauthenticatedAt: new Date() } });
      await tx.user.update({ where: { id }, data: { passwordHash, version: { increment: 1 } } });
      await tx.session.updateMany({ where: { userId: id, id: { not: sessionId }, revokedAt: null }, data: { revokedAt: new Date() } });
    });
    return { passwordChanged: true };
  }

  async closeAccount(id: string, reason?: string): Promise<{ closedAt: string; pendingTransactionIds: string[] }> {
    const now = new Date();
    const pendingTransactionIds = await serial(this.db, async (tx) => {
      const active = await tx.transaction.findMany({ where: { status: { in: ['AWAITING_HANDOVER', 'ONE_SIDE_CONFIRMED', 'DISPUTED'] }, OR: [{ sellerOrDonorId: id }, { buyerOrRecipientId: id }] } });
      await lockRows(tx, 'User', [id, ...active.flatMap((t) => [t.sellerOrDonorId, t.buyerOrRecipientId])]);
      await requireRecentAuthentication(tx);
      const ids = await closeForAccount(tx, id);
      await this.photos.closeForAccount(tx, id, now);
      await tx.favorite.deleteMany({ where: { userId: id } });
      await tx.savedSearch.deleteMany({ where: { userId: id } });
      await tx.inAppNotification.deleteMany({ where: { userId: id } });
      await tx.user.update({ where: { id }, data: { status: 'CLOSED', closedAt: now, closureReason: reason ?? null, version: { increment: 1 } } });
      await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: now } });
      return ids;
    });
    return { closedAt: now.toISOString(), pendingTransactionIds };
  }
}
