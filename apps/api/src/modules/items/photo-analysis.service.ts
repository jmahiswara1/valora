import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { photoAnalysisSchema, type PhotoAnalysisDto, type PhotoAnalysisInput, type PhotoAnalysisReason, type CategoryDto } from '@valora/contracts';
import type { Prisma } from '../../generated/prisma/client.js';
import { DatabaseService } from '../../infrastructure/database.service.js';
import { StorageService } from '../../infrastructure/storage.service.js';
import { reserveAiBudget } from '../../infrastructure/ai-budget.js';
import { AppException } from '../../shared/http.js';
import { json, serial } from '../../shared/transactions.js';
import { ProviderFailure } from '../assessments/explainer/provider.js';
import { analyzePhotos, photoConfig, photoPromptVersion } from './photo-provider.js';

const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
type Config = ReturnType<typeof photoConfig>;
type Snapshot = Awaited<ReturnType<PhotoAnalysisService['snapshot']>>;
const empty = { title: null, categoryCode: null, subcategoryCode: null, description: null, conditionSummary: null, issueSummary: null };
function unavailable(reason: PhotoAnalysisReason, retryAt: Date | null = null): PhotoAnalysisDto {
  return { status: 'UNAVAILABLE', summary: 'Analisis foto belum tersedia. Kamu tetap dapat mengisi informasi barang secara manual.', suggestions: empty,
    observations: [], requestedPhotos: [], cached: false, generatedAt: null, expiresAt: null, reason, retryAt: retryAt?.toISOString() ?? null };
}

@Injectable()
export class PhotoAnalysisService {
  constructor(private readonly db: DatabaseService, private readonly storage: StorageService) {}
  async snapshot(tx: Prisma.TransactionClient, actorId: string, input: PhotoAnalysisInput, cfg: Config) {
    const user = await tx.user.findUnique({ where: { id: actorId }, select: { status: true } });
    if (user?.status !== 'ACTIVE') throw new AppException(403, 'ACCOUNT_SUSPENDED', 'Akun ini tidak dapat menggunakan analisis foto.');
    if (input.itemId) {
      const item = await tx.item.findFirst({ where: { id: input.itemId, currentOwnerId: actorId, archivedAt: null } });
      if (!item) throw new AppException(404, 'NOT_FOUND', 'Barang tidak ditemukan.');
      if (item.reservedByTransactionId) throw new AppException(409, 'ITEM_RESERVED', 'Barang sedang dalam kesepakatan dan tidak dapat dianalisis untuk perubahan.');
      if (item.version !== input.expectedVersion) throw new AppException(409, 'STATE_CONFLICT', 'Barang sudah berubah. Muat ulang formulir.');
    }
    const photos: { storageKey: string; identity: string }[] = [];
    for (const id of input.mediaIds) {
      const media = await tx.mediaAsset.findFirst({ where: { id, itemId: input.itemId!, deletedAt: null, caseId: null, repairRecordId: null, evidenceId: null,
        OR: [{ uploadedById: actorId }, { shareWithFutureOwner: true }] } });
      if (!media) throw new AppException(404, 'NOT_FOUND', 'Foto barang tidak ditemukan.');
      photos.push({ storageKey: media.storageKey, identity: `media:${media.id}:${media.version}` });
    }
    for (const id of input.uploadTicketIds) {
      const ticket = await tx.uploadTicket.findFirst({ where: { id, userId: actorId, itemId: input.itemId ?? null, purpose: 'ITEM', status: 'UPLOADED', expiresAt: { gt: new Date() } } });
      if (!ticket?.storageKey || ticket.actualMime !== 'image/webp' || !ticket.actualBytes) throw new AppException(409, 'MEDIA_INVALID', 'Foto belum diunggah atau tiket foto sudah kedaluwarsa. Pilih dan unggah kembali.');
      photos.push({ storageKey: ticket.storageKey, identity: `ticket:${ticket.id}:${ticket.storageKey}` });
    }
    const entries = await tx.category.findMany({ where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] });
    const categories: CategoryDto[] = entries.filter(c => !c.parentCode).map(c => ({ code: c.code, name: c.name, subcategories: entries.filter(sub => sub.parentCode === c.code).map(sub => ({ code: sub.code, name: sub.name })) }));
    const context = { actorId, itemId: input.itemId ?? null, version: input.expectedVersion ?? null, categories, base: cfg.baseUrl, model: cfg.model, prompt: photoPromptVersion };
    return { photos, categories, context, identity: hash(JSON.stringify({ ...context, photos })) };
  }
  private async prepare(snapshot: Snapshot) {
    const images: string[] = [], hashes: string[] = []; let bytes = 0;
    for (const photo of snapshot.photos) {
      let original: Buffer, processed: Buffer;
      try {
        original = await this.storage.read(photo.storageKey);
        processed = await sharp(original, { failOn: 'error', limitInputPixels: 20_000_000 }).rotate().resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
      } catch { throw new AppException(409, 'MEDIA_INVALID', 'Foto tidak dapat dibaca. Pilih dan unggah kembali.'); }
      bytes += processed.length;
      if (bytes > 3 * 1024 * 1024) throw new AppException(400, 'MEDIA_INVALID', 'Foto terlalu besar untuk dianalisis bersama. Pilih lebih sedikit foto.');
      images.push('data:image/webp;base64,' + processed.toString('base64')); hashes.push(hash(original));
    }
    return { images, key: 'photo:' + hash(JSON.stringify({ ...snapshot.context, hashes })) };
  }
  private async cached(tx: Prisma.TransactionClient, actorId: string, key: string) {
    const row = await tx.photoAnalysisCache.findUnique({ where: { key } });
    if (!row || row.actorId !== actorId || row.expiresAt <= new Date()) return null;
    const parsed = photoAnalysisSchema.safeParse(row.output);
    return parsed.success ? { ...parsed.data, cached: true } : null;
  }
  private async current(tx: Prisma.TransactionClient, actorId: string, input: PhotoAnalysisInput, cfg: Config, snapshot: Snapshot) {
    const current = await this.snapshot(tx, actorId, input, cfg);
    if (current.identity !== snapshot.identity) throw new AppException(409, 'STATE_CONFLICT', 'Foto atau kategori sudah berubah. Analisis kembali dengan data terkini.');
  }
  async analyze(actorId: string, input: PhotoAnalysisInput): Promise<PhotoAnalysisDto> {
    const cfg = photoConfig();
    const snapshot = await serial(this.db, async tx => {
      const snapshot = await this.snapshot(tx, actorId, input, cfg);
      const now = new Date(), key = hash('photo:minute:' + actorId);
      const row = await tx.authRateBucket.findUnique({ where: { key } });
      const count = row && row.resetAt > now ? row.count : 0, resetAt = row && row.resetAt > now ? row.resetAt : new Date(now.getTime() + 60000);
      if (count >= 10) throw new AppException(429, 'RATE_LIMITED', 'Maksimal sepuluh permintaan analisis per menit. Coba lagi sebentar.');
      await tx.authRateBucket.upsert({ where: { key }, update: { count: count + 1, resetAt }, create: { key, count: count + 1, resetAt } });
      return snapshot;
    });
    if (!cfg.enabled || !cfg.configured) return unavailable(cfg.enabled ? 'NOT_CONFIGURED' : 'DISABLED');
    const prepared = await this.prepare(snapshot);
    const admission = await serial(this.db, async tx => {
      await this.current(tx, actorId, input, cfg, snapshot);
      const cached = await this.cached(tx, actorId, prepared.key);
      if (cached) return { kind: 'result' as const, result: cached };
      const now = new Date();
      await tx.photoAnalysisLease.deleteMany({ where: { expiresAt: { lte: now } } });
      if (await tx.photoAnalysisLease.findUnique({ where: { key: prepared.key } })) return { kind: 'join' as const };
      const budget = await reserveAiBudget(tx, actorId, cfg, now);
      if (budget) return { kind: 'result' as const, result: unavailable(budget.reason, budget.retryAt) };
      const token = randomUUID();
      await tx.photoAnalysisLease.create({ data: { key: prepared.key, token, actorId, expiresAt: new Date(now.getTime() + 90000) } });
      return { kind: 'generate' as const, token };
    });
    if (admission.kind === 'result') return admission.result;
    if (admission.kind === 'join') {
      const until = Date.now() + 70000;
      while (Date.now() < until) {
        const result = await serial(this.db, async tx => {
          await this.current(tx, actorId, input, cfg, snapshot);
          const cached = await this.cached(tx, actorId, prepared.key);
          if (cached) return cached;
          const lease = await tx.photoAnalysisLease.findUnique({ where: { key: prepared.key } });
          return !lease || lease.expiresAt <= new Date() ? unavailable('BUSY', new Date(Date.now() + 30000)) : null;
        });
        if (result) return result;
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      return serial(this.db, async tx => { await this.current(tx, actorId, input, cfg, snapshot); return unavailable('BUSY', new Date(Date.now() + 30000)); });
    }
    try {
      let result: PhotoAnalysisDto;
      try { result = { ...await analyzePhotos(prepared.images, snapshot.categories, cfg), cached: false, generatedAt: null, expiresAt: null, reason: null, retryAt: null }; }
      catch (error) { if (!(error instanceof ProviderFailure)) throw error; result = unavailable(error.reason, new Date(Date.now() + 30000)); }
      return await serial(this.db, async tx => {
        await this.current(tx, actorId, input, cfg, snapshot);
        const lease = await tx.photoAnalysisLease.findUnique({ where: { key: prepared.key } });
        if (lease?.token !== admission.token || lease.expiresAt <= new Date()) return unavailable('BUSY', new Date(Date.now() + 30000));
        const now = new Date(), expiresAt = new Date(now.getTime() + (result.status === 'UNAVAILABLE' ? 30000 : 86400000));
        const output = photoAnalysisSchema.parse({ ...result, generatedAt: now.toISOString(), expiresAt: expiresAt.toISOString() });
        const data = { actorId, output: json(output), expiresAt };
        await tx.photoAnalysisCache.upsert({ where: { key: prepared.key }, update: data, create: { key: prepared.key, ...data } });
        await tx.photoAnalysisLease.deleteMany({ where: { key: prepared.key, token: admission.token } });
        return output;
      });
    } finally { await this.db.photoAnalysisLease.deleteMany({ where: { key: prepared.key, token: admission.token } }); }
  }
}
