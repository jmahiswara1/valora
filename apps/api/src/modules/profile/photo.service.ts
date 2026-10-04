import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import type { ProfilePhoto as ProfilePhotoRecord, Prisma } from '../../generated/prisma/client.js';
import type { UserDto } from '@valora/contracts';
import { uuidSchema } from '@valora/contracts';
import { AppException } from '../../shared/http.js';
import { config } from '../../infrastructure/config.js';
import { DatabaseService } from '../../infrastructure/database.service.js';
import { StorageService } from '../../infrastructure/storage.service.js';
import { lockRows, serial } from '../../shared/transactions.js';

const localDeletion = 'PHOTO_LOCAL';
const cloudDeletion = 'PHOTO_CLOUD';
const maxBytes = 1024 * 1024;
const imageSize = 512;

@Injectable()
export class ProfilePhotoService {
  constructor(private readonly db: DatabaseService, private readonly storage: StorageService) {
    if (config.cloudinary.configured) {
      cloudinary.config({ cloud_name: config.cloudinary.cloudName, api_key: config.cloudinary.apiKey, api_secret: config.cloudinary.apiSecret, secure: true });
    }
  }

  private cloudinaryAvailable(): boolean { return config.cloudinary.configured; }

  private async photoUrl(photo: ProfilePhotoRecord): Promise<string | null> {
    if (photo.provider === 'LOCAL') return `/api/v1/users/${photo.userId}/profile-photo`;
    if (!this.cloudinaryAvailable()) return null;
    return cloudinary.url(photo.storageKey, { resource_type: 'image', type: 'authenticated', sign_url: true, secure: true, format: 'webp' });
  }

  async fields(userId: string): Promise<Pick<UserDto, 'profilePhotoProvider' | 'profilePhotoUrl' | 'profilePhotoMigrationAvailable'>> {
    const photo = await this.db.profilePhoto.findUnique({ where: { userId } });
    return {
      profilePhotoProvider: photo?.provider ?? null,
      profilePhotoUrl: photo ? await this.photoUrl(photo) : null,
      profilePhotoMigrationAvailable: Boolean(photo?.provider === 'LOCAL' && this.cloudinaryAvailable()),
    };
  }

  async urlFor(userId: string): Promise<string | null> {
    const photo = await this.db.profilePhoto.findUnique({ where: { userId } });
    return photo ? this.photoUrl(photo) : null;
  }

  private async normalize(bytes: Buffer): Promise<Buffer> {
    if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > maxBytes) {
      throw new AppException(400, 'INVALID_INPUT', 'Foto hasil crop tidak valid atau terlalu besar.');
    }
    try {
      const source = sharp(bytes, { limitInputPixels: imageSize * imageSize, failOn: 'error' });
      const metadata = await source.metadata();
      if (metadata.format !== 'webp' || metadata.width !== imageSize || metadata.height !== imageSize || (metadata.pages ?? 1) !== 1) {
        throw new Error('Invalid photo dimensions or format');
      }
      return await sharp(bytes, { limitInputPixels: imageSize * imageSize, failOn: 'error' })
        .rotate().resize(imageSize, imageSize, { fit: 'cover' }).webp({ quality: 88 }).toBuffer();
    } catch {
      throw new AppException(400, 'INVALID_INPUT', 'Gunakan foto WebP persegi 512 × 512 hasil crop.');
    }
  }

  private async uploadCloudinary(bytes: Buffer): Promise<string> {
    if (!this.cloudinaryAvailable()) {
      throw new AppException(503, 'DEPENDENCY_UNAVAILABLE', config.cloudinary.partial ? 'Konfigurasi Cloudinary belum lengkap.' : 'Cloudinary belum dikonfigurasi.');
    }
    const publicId = `profile-photos/${randomUUID()}`;
    try {
      await new Promise<void>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({
          public_id: publicId,
          resource_type: 'image',
          type: 'authenticated',
          format: 'webp',
          overwrite: false,
          unique_filename: false,
        }, (error, result) => {
          if (error || !result?.public_id) reject(error ?? new Error('Cloudinary upload failed'));
          else resolve();
        });
        stream.end(bytes);
      });
      return publicId;
    } catch {
      throw new AppException(503, 'DEPENDENCY_UNAVAILABLE', 'Foto belum dapat disimpan ke Cloudinary. Coba lagi.');
    }
  }

  private async deleteCloudinary(publicId: string): Promise<void> {
    if (!this.cloudinaryAvailable()) throw new Error('Cloudinary credentials are not configured');
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image', type: 'authenticated', invalidate: true });
    if (result.result !== 'ok' && result.result !== 'not found') throw new Error('Cloudinary did not confirm photo deletion');
  }

  private async deleteAsset(provider: 'LOCAL' | 'CLOUDINARY', storageKey: string): Promise<void> {
    if (provider === 'LOCAL') await this.storage.remove(storageKey);
    else await this.deleteCloudinary(storageKey);
  }

  private async cleanupOrQueue(provider: 'LOCAL' | 'CLOUDINARY', storageKey: string): Promise<void> {
    try { await this.deleteAsset(provider, storageKey); }
    catch {
      const kind = provider === 'LOCAL' ? localDeletion : cloudDeletion;
      await this.db.storageDeletion.upsert({
        where: { storageKey },
        update: { kind, completedAt: null, attempts: 0, nextAttemptAt: new Date(), lastError: null },
        create: { kind, storageKey, nextAttemptAt: new Date() },
      }).catch(() => undefined);
    }
  }

  private async enqueue(tx: Prisma.TransactionClient, photo: Pick<ProfilePhotoRecord, 'provider' | 'storageKey'>, at: Date): Promise<void> {
    const kind = photo.provider === 'LOCAL' ? localDeletion : cloudDeletion;
    await tx.storageDeletion.upsert({
      where: { storageKey: photo.storageKey },
      update: { kind, completedAt: null, attempts: 0, nextAttemptAt: at, lastError: null },
      create: { kind, storageKey: photo.storageKey, nextAttemptAt: at },
    });
  }

  async replace(userId: string, input: Buffer): Promise<void> {
    const bytes = await this.normalize(input);
    let provider: 'LOCAL' | 'CLOUDINARY';
    let storageKey: string;
    if (this.cloudinaryAvailable()) {
      provider = 'CLOUDINARY';
      storageKey = await this.uploadCloudinary(bytes);
    } else if (config.cloudinary.partial) {
      throw new AppException(503, 'DEPENDENCY_UNAVAILABLE', 'Konfigurasi Cloudinary belum lengkap. Lengkapi semua key atau kosongkan semuanya untuk penyimpanan lokal.');
    } else if (config.appEnv !== 'local') {
      throw new AppException(503, 'DEPENDENCY_UNAVAILABLE', 'Cloudinary wajib dikonfigurasi di luar lingkungan lokal.');
    } else {
      provider = 'LOCAL';
      storageKey = `profile-photos/${randomUUID()}.webp`;
      try { await this.storage.write(storageKey, bytes); }
      catch (error) { await this.cleanupOrQueue(provider, storageKey); throw error; }
    }

    try {
      await serial(this.db, async (tx) => {
        await lockRows(tx, 'User', [userId]);
        const previous = await tx.profilePhoto.findUnique({ where: { userId } });
        await tx.profilePhoto.upsert({
          where: { userId },
          create: { userId, provider, storageKey, mime: 'image/webp', bytes: bytes.length },
          update: { provider, storageKey, mime: 'image/webp', bytes: bytes.length },
        });
        if (previous) await this.enqueue(tx, previous, new Date());
      });
    } catch (error) {
      await this.cleanupOrQueue(provider, storageKey);
      throw error;
    }
  }

  async remove(userId: string): Promise<void> {
    await serial(this.db, async (tx) => {
      await lockRows(tx, 'User', [userId]);
      const photo = await tx.profilePhoto.findUnique({ where: { userId } });
      if (!photo) return;
      await tx.profilePhoto.delete({ where: { userId } });
      await this.enqueue(tx, photo, new Date());
    });
  }

  async migrateLocalPhoto(userId: string): Promise<void> {
    const current = await this.db.profilePhoto.findUnique({ where: { userId } });
    if (!current || current.provider !== 'LOCAL') return;
    if (!this.cloudinaryAvailable()) {
      throw new AppException(503, 'DEPENDENCY_UNAVAILABLE', config.cloudinary.partial ? 'Konfigurasi Cloudinary belum lengkap.' : 'Cloudinary belum dikonfigurasi.');
    }
    const bytes = await this.storage.read(current.storageKey);
    const publicId = await this.uploadCloudinary(bytes);
    try {
      await serial(this.db, async (tx) => {
        await lockRows(tx, 'User', [userId]);
        const fresh = await tx.profilePhoto.findUnique({ where: { userId } });
        if (!fresh || fresh.provider !== 'LOCAL' || fresh.storageKey !== current.storageKey) {
          throw new AppException(409, 'STATE_CONFLICT', 'Foto profil berubah. Muat ulang profil dan coba lagi.');
        }
        await tx.profilePhoto.update({ where: { userId }, data: { provider: 'CLOUDINARY', storageKey: publicId } });
        await this.enqueue(tx, fresh, new Date());
      });
    } catch (error) {
      await this.cleanupOrQueue('CLOUDINARY', publicId);
      throw error;
    }
  }

  async closeForAccount(tx: Prisma.TransactionClient, userId: string, at: Date): Promise<void> {
    const photo = await tx.profilePhoto.findUnique({ where: { userId } });
    if (!photo) return;
    await tx.profilePhoto.delete({ where: { userId } });
    await this.enqueue(tx, photo, at);
  }

  async localImageForViewer(viewerId: string, targetId: string): Promise<Buffer> {
    if (!uuidSchema.safeParse(targetId).success) throw new AppException(404, 'NOT_FOUND', 'Foto tidak ditemukan.');
    if (viewerId !== targetId) {
      const sharedConversation = await this.db.conversation.findFirst({
        where: { OR: [
          { participantAId: viewerId, participantBId: targetId },
          { participantAId: targetId, participantBId: viewerId },
        ] },
        select: { id: true },
      });
      if (!sharedConversation) throw new AppException(404, 'NOT_FOUND', 'Foto tidak ditemukan.');
    }
    const photo = await this.db.profilePhoto.findUnique({ where: { userId: targetId } });
    if (!photo || photo.provider !== 'LOCAL') throw new AppException(404, 'NOT_FOUND', 'Foto tidak ditemukan.');
    try { return await this.storage.read(photo.storageKey); }
    catch { throw new AppException(404, 'NOT_FOUND', 'Foto tidak ditemukan.'); }
  }

  async deleteQueued(kind: string, storageKey: string): Promise<void> {
    if (kind === localDeletion) {
      if (!/^profile-photos\/[0-9a-f-]{36}\.webp$/i.test(storageKey)) throw new Error('Invalid local profile photo key');
      await this.storage.remove(storageKey);
      return;
    }
    if (kind === cloudDeletion) {
      if (!/^profile-photos\/[0-9a-f-]{36}$/i.test(storageKey)) throw new Error('Invalid Cloudinary profile photo key');
      await this.deleteCloudinary(storageKey);
      return;
    }
    throw new Error('Unknown profile photo deletion kind');
  }
}
