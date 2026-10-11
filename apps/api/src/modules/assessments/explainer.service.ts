import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { type AssessmentDto, type ExplanationDto, explanationSchema } from '@valora/contracts';
import type { Prisma } from '../../generated/prisma/client.js';
import { AssessmentsService } from './service.js';
import { DatabaseService } from '../../infrastructure/database.service.js';
import { AppException } from '../../shared/http.js';
import { json, serial } from '../../shared/transactions.js';
import { templateExplanation, templateVersion } from './explanation.js';
import { explainerConfig, promptVersion } from './explainer/config.js';
import { reserveAiBudget } from '../../infrastructure/ai-budget.js';
import { explanationInput, generateExplanation, ProviderFailure } from './explainer/provider.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
type Config = ReturnType<typeof explainerConfig>;
type Reason = NonNullable<ExplanationDto['fallbackReason']>;
type Snapshot = Awaited<ReturnType<ExplainerService['snapshot']>>;
type Admission = { kind: 'result'; result: ExplanationDto } | { kind: 'limited' } |
  { kind: 'join'; snapshot: Snapshot } | { kind: 'generate'; snapshot: Snapshot; token: string };

@Injectable()
export class ExplainerService {
  constructor(private readonly assessments: AssessmentsService, private readonly db: DatabaseService) {}

  async snapshot(tx: Prisma.TransactionClient, actorId: string, id: string, cfg: Config) {
    const assessment = await this.assessments.get(actorId, id, tx);
    const row = await tx.assessment.findUniqueOrThrow({ where: { id }, include: { item: true } });
    const input = explanationInput(assessment, row.item.categoryCode);
    const key = 'exp2:' + hash(JSON.stringify({ id, version: row.version, projection: assessment.answers ? 'CREATOR' : 'OWNER',
      owner: row.item.currentOwnerId, revision: row.item.itemRevision, archived: !!row.item.archivedAt,
      input, model: cfg.model, base: cfg.baseUrl, promptVersion, templateVersion }));
    return { assessment, input, key };
  }
  private fallback(a: AssessmentDto, reason: Reason, retryAt: Date | null = null): ExplanationDto {
    return { ...templateExplanation(a), fallbackReason: reason, retryAt: retryAt?.toISOString() ?? null, cached: false };
  }
  private async cached(tx: Prisma.TransactionClient, key: string, now: Date) {
    const cache = await tx.explanationCache.findUnique({ where: { key } });
    if (!cache?.expiresAt || cache.expiresAt <= now) return null;
    const result = explanationSchema.safeParse(cache.output);
    return result.success ? { ...result.data, cached: true } : null;
  }
  private async increment(tx: Prisma.TransactionClient, key: string, count: number, resetAt: Date) {
    await tx.authRateBucket.upsert({ where: { key }, update: { count: count + 1, resetAt }, create: { key, count: count + 1, resetAt } });
  }
  async get(actorId: string, id: string): Promise<ExplanationDto> {
    const cfg = explainerConfig();
    const admission = await serial(this.db, async (tx): Promise<Admission> => {
      const snapshot = await this.snapshot(tx, actorId, id, cfg); const now = new Date();
      const requestKey = hash('explanation:minute:' + actorId);
      const requestBucket = await tx.authRateBucket.findUnique({ where: { key: requestKey } });
      const count = requestBucket && requestBucket.resetAt > now ? requestBucket.count : 0;
      const reset = requestBucket && requestBucket.resetAt > now ? requestBucket.resetAt : new Date(now.getTime() + 60000);
      await this.increment(tx, requestKey, count, reset);
      if (count >= 10) return { kind: 'limited' };
      const result = (reason: Reason, retryAt: Date | null = null): Admission => ({ kind: 'result', result: this.fallback(snapshot.assessment, reason, retryAt) });
      if (!cfg.enabled) return result('DISABLED');
      if (!cfg.configured) return result('NOT_CONFIGURED');
      const cached = await this.cached(tx, snapshot.key, now);
      if (cached) return { kind: 'result', result: cached };
      await tx.explanationLease.deleteMany({ where: { expiresAt: { lte: now } } });
      if (await tx.explanationLease.findUnique({ where: { key: snapshot.key } })) return { kind: 'join', snapshot };
      const budget = await reserveAiBudget(tx, actorId, cfg, now);
      if (budget) return result(budget.reason, budget.retryAt);
      const token = randomUUID();
      await tx.explanationLease.create({ data: { key: snapshot.key, token, actorId, assessmentId: id, expiresAt: new Date(now.getTime() + 90000) } });
      return { kind: 'generate', snapshot, token };
    });
    if (admission.kind === 'limited') throw new AppException(429, 'RATE_LIMITED', 'Maksimal sepuluh permintaan penjelasan per menit. Coba lagi sebentar.');
    if (admission.kind === 'result') return admission.result;
    const { snapshot } = admission;
    if (admission.kind === 'join') return this.join(actorId, id, snapshot, cfg);
    try {
      let result: ExplanationDto;
      try { result = await generateExplanation(snapshot.assessment, snapshot.input, cfg); }
      catch (error) { if (!(error instanceof ProviderFailure)) throw error; result = this.fallback(snapshot.assessment, error.reason, new Date(Date.now() + 30000)); }
      return await serial(this.db, async tx => {
        const current = await this.snapshot(tx, actorId, id, cfg);
        if (current.key !== snapshot.key) throw new AppException(409, 'STATE_CONFLICT', 'Penilaian berubah selama penjelasan dibuat. Muat ulang hasil penilaian.');
        const lease = await tx.explanationLease.findUnique({ where: { key: snapshot.key } });
        if (lease?.token !== admission.token || lease.expiresAt <= new Date()) return this.fallback(current.assessment, 'BUSY', new Date(Date.now() + 30000));
        const generatedAt = new Date(), expiresAt = new Date(generatedAt.getTime() + (result.source === 'AI' ? 86400000 : 30000));
        const output = explanationSchema.parse({ ...result, generatedAt: generatedAt.toISOString(), expiresAt: expiresAt.toISOString(), cached: false });
        const data = { assessmentId: id, templateVersion, output: json(output), source: output.source, model: cfg.model, promptVersion, expiresAt };
        await tx.explanationCache.upsert({ where: { key: snapshot.key }, create: { key: snapshot.key, ...data }, update: data });
        await tx.explanationLease.deleteMany({ where: { key: snapshot.key, token: admission.token } });
        return output;
      });
    } finally {
      // Release even after revocation; never delete another worker's replacement lease.
      await this.db.explanationLease.deleteMany({ where: { key: snapshot.key, token: admission.token } });
    }
  }
  private async join(actorId: string, id: string, snapshot: Snapshot, cfg: Config): Promise<ExplanationDto> {
    const until = Date.now() + 70000;
    while (Date.now() < until) {
      const result = await serial(this.db, async tx => {
        const current = await this.snapshot(tx, actorId, id, cfg);
        if (current.key !== snapshot.key) throw new AppException(409, 'STATE_CONFLICT', 'Penilaian berubah. Muat ulang hasil penilaian.');
        const cached = await this.cached(tx, snapshot.key, new Date());
        if (cached) return cached;
        const lease = await tx.explanationLease.findUnique({ where: { key: snapshot.key } });
        if (!lease || lease.expiresAt <= new Date()) return this.fallback(current.assessment, 'BUSY', new Date(Date.now() + 30000));
        return null;
      });
      if (result) return result;
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    return serial(this.db, async tx => {
      const current = await this.snapshot(tx, actorId, id, cfg);
      if (current.key !== snapshot.key) throw new AppException(409, 'STATE_CONFLICT', 'Penilaian berubah. Muat ulang hasil penilaian.');
      return this.fallback(current.assessment, 'BUSY', new Date(Date.now() + 30000));
    });
  }
}
