import { validId, idempotent, json } from '../../shared/transactions.js';
import { AppException } from '../../shared/http.js';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database.service.js';
import { PassportImpactService } from '../history/projection.service.js';
import { OperationsService } from "../operations/service.js";
import { period } from '../history/helpers.js';
import { rubricDto } from '../assessments/helpers.js';
import { z } from 'zod';
import { rubricDraftSchema, rubricDraftUpdateSchema, type RubricDto, versionReasonSchema, categoryAdminSchema, economicReferenceCreateSchema } from '@valora/contracts';
import { audit } from '../operations/helpers.js';
import { rubricFixtures } from './helpers.js';

function cursor(value?: string) {
  if (!value) return null;
  try { const parsed = JSON.parse(Buffer.from(value, 'base64url').toString()) as { at: string; id: string }; validId(parsed.id); const at = new Date(parsed.at); if (Number.isNaN(at.getTime())) throw new Error(); return { at, id: parsed.id }; }
  catch { throw new AppException(400, 'INVALID_INPUT', 'Cursor tidak valid.'); }
}

function page<T extends { id: string }>(rows: T[], at: (row: T) => Date) { const data = rows.slice(0, 30); const last = data.at(-1); return { data, meta: { nextCursor: rows.length > 30 && last ? Buffer.from(JSON.stringify({ at: at(last).toISOString(), id: last.id })).toString('base64url') : null } }; }

function before(value: ReturnType<typeof cursor>, field: 'createdAt' | 'acceptedAt') { return value ? { OR: [{ [field]: { lt: value.at } }, { [field]: value.at, id: { lt: value.id } }] } : {}; }

@Injectable()
export class AdminStage5Service {
  constructor(private readonly db: DatabaseService, private readonly impact: PassportImpactService, private readonly operations: OperationsService) {}
  async overview() {
    const [moderation, reports, disputes, corrections, overdue, impact] = await Promise.all([this.db.listing.count({ where: { status: 'PENDING_REVIEW' } }), this.db.report.count({ where: { status: { in: ['OPEN', 'IN_REVIEW'] } } }), this.db.disputeCase.count({ where: { status: { in: ['OPEN', 'IN_REVIEW'] } } }), this.db.correctionCase.count({ where: { status: { in: ['OPEN', 'IN_REVIEW'] } } }), this.db.transaction.count({ where: { status: { in: ['AWAITING_HANDOVER', 'ONE_SIDE_CONFIRMED', 'DISPUTED'] }, targetHandoverAt: { lt: new Date() } } }), this.impact.impact()]);
    return { stage: 5, queues: { moderation, reports, disputes, corrections, overdue }, impact };
  }
  async users(q?: string, status?: string, after?: string) {
    if (status && !['ACTIVE', 'SUSPENDED', 'CLOSED'].includes(status)) throw new AppException(400, 'INVALID_INPUT', 'Status akun tidak dikenal.');
    const rows = await this.db.user.findMany({ where: { AND: [before(cursor(after), 'createdAt'), ...(q ? [{ OR: [{ displayName: { contains: q.slice(0, 120), mode: 'insensitive' as const } }, { email: { contains: q.slice(0, 120), mode: 'insensitive' as const } }] }] : [])], ...(status ? { status: status as 'ACTIVE' } : {}) }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 31, select: { id: true, displayName: true, email: true, role: true, status: true, version: true, createdAt: true, emailVerifiedAt: true } });
    return page(rows, (r) => r.createdAt);
  }
  async user(id: string) { validId(id); const row = await this.db.user.findUnique({ where: { id }, select: { id: true, displayName: true, email: true, role: true, status: true, version: true, city: { select: { name: true } }, createdAt: true, closedAt: true } }); if (!row) throw new AppException(404, 'NOT_FOUND', 'Akun tidak ditemukan.'); return row; }
  async transactions(q?: string, status?: string, after?: string) {
    if (status && !['AWAITING_HANDOVER', 'ONE_SIDE_CONFIRMED', 'DISPUTED', 'CANCELLED', 'COMPLETED'].includes(status)) throw new AppException(400, 'INVALID_INPUT', 'Status transaksi tidak dikenal.');
    const rows = await this.db.transaction.findMany({ where: { AND: [before(cursor(after), 'acceptedAt')], ...(q ? { listing: { revisions: { some: { title: { contains: q.slice(0, 120), mode: 'insensitive' }, reviews: { some: { decision: 'APPROVE' } } } } } } : {}), ...(status ? { status: status as 'COMPLETED' } : {}) }, orderBy: [{ acceptedAt: 'desc' }, { id: 'desc' }], take: 31, select: { id: true, itemId: true, offeredItemId: true, type: true, status: true, version: true, acceptedAt: true, targetHandoverAt: true, completedAt: true, correctedAt: true, _count: { select: { confirmations: true, disputes: true } } } });
    return page(rows, (r) => r.acceptedAt);
  }
  async transaction(adminId: string, id: string) {
    validId(id); const row = await this.db.transaction.findUnique({ where: { id }, select: { id: true, itemId: true, offeredItemId: true, type: true, status: true, version: true, acceptedAt: true, completedAt: true, correctedAt: true, targetHandoverAt: true } });
    // Detailed coordination is exposed by the existing participant/case routes.
    if (!row) throw new AppException(404, 'NOT_FOUND', 'Transaksi tidak ditemukan.'); return { ...row, adminId };
  }
  async analytics(from?: string, to?: string) {
    const range = period(from, to);
    const cohort = await this.db.transaction.findMany({ where: { acceptedAt: range.filter }, select: { status: true, correctedAt: true, type: true } });
    const completed = cohort.filter((r) => r.status === 'COMPLETED' && !r.correctedAt).length;
    const reviews = await this.db.moderationReview.findMany({ where: { createdAt: range.filter }, select: { decision: true } });
    return { from: range.start?.toISOString() ?? null, to: range.end?.toISOString() ?? null, transactionCompletion: { numerator: completed, denominator: cohort.length, value: cohort.length ? completed / cohort.length : null, definition: 'Transaksi diterima pada periode [from,to); selesai tanpa pembalikan dibagi seluruh transaksi dalam kohor. Status dibaca saat laporan dibuat.' }, moderationApproval: { numerator: reviews.filter((r) => r.decision === 'APPROVE').length, denominator: reviews.length, value: reviews.length ? reviews.filter((r) => r.decision === 'APPROVE').length / reviews.length : null, definition: 'Putusan APPROVE dibagi semua putusan moderasi yang dibuat dalam periode.' }, impact: await this.impact.impact(undefined, from, to) };
  }
  async auditList(after?: string, targetType?: string) { const rows = await this.db.adminAction.findMany({ where: { ...before(cursor(after), 'createdAt'), ...(targetType ? { targetType: targetType.slice(0, 40) } : {}) }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 31, select: { id: true, adminId: true, targetType: true, targetId: true, action: true, createdAt: true } }); return page(rows, (r) => r.createdAt); }
  async auditDetail(adminId: string, id: string, scopeType: 'REPORT' | 'CORRECTION' | 'DISPUTE', scopeId: string) { validId(id); await this.operations.requireGrant(this.db, adminId, scopeType, scopeId); const row = await this.db.adminAction.findUnique({ where: { id } }); if (!row || !((row.targetType === scopeType && row.targetId === scopeId) || (scopeType === 'REPORT' && row.reportId === scopeId))) throw new AppException(404, 'NOT_FOUND', 'Audit tidak terkait kasus.'); return row; }
  async rubrics() { return { published: (await this.db.rubricVersion.findMany({ orderBy: { publishedAt: 'desc' } })).map(rubricDto), drafts: await this.db.rubricDraft.findMany({ orderBy: { updatedAt: 'desc' } }), categories: await this.db.category.findMany({ orderBy: { sortOrder: 'asc' } }), references: (await this.db.economicReference.findMany({ orderBy: { createdAt: 'desc' } })).map((r) => ({ ...r, amountIdr: r.amountIdr.toString() })) }; }
  async draft(adminId: string, input: z.infer<typeof rubricDraftSchema>, key?: string) { return idempotent(this.db, adminId, 'rubric-draft', key, input, async (tx) => { const base = await tx.rubricVersion.findUnique({ where: { id: input.baseVersionId } }); if (!base) throw new AppException(404, 'NOT_FOUND', 'Rubrik tidak ditemukan.'); const row = await tx.rubricDraft.create({ data: { baseVersionId: base.id, rubricKey: base.rubricKey, questionConfig: json(base.questionConfig), safetyConfig: json(base.safetyConfig), createdById: adminId } }); await audit(tx, adminId, 'RUBRIC_DRAFT', row.id, 'CREATE_DRAFT', input.reason); return row; }); }
  async editDraft(adminId: string, id: string, input: z.infer<typeof rubricDraftUpdateSchema>, key?: string) { validId(id); return idempotent(this.db, adminId, 'rubric-edit:' + id, key, input, async (tx) => { const row = await tx.rubricDraft.findUnique({ where: { id } }); if (!row || row.version !== input.expectedVersion || row.publishedVersionId) throw new AppException(409, 'STATE_CONFLICT', 'Draft rubrik sudah berubah.'); const base = await tx.rubricVersion.findUniqueOrThrow({ where: { id: row.baseVersionId } }); const candidate = { ...rubricDto(base), questions: input.questions, safetyQuestions: input.safetyQuestions, contextPrompt: input.contextPrompt }; if (!rubricFixtures(candidate).passed) throw new AppException(422, 'RUBRIC_FIXTURE_FAILED', 'Struktur score-v1 dan fixtures harus lulus.'); const updated = await tx.rubricDraft.update({ where: { id }, data: { questionConfig: json({ questions: input.questions, contextPrompt: input.contextPrompt }), safetyConfig: json({ safetyQuestions: input.safetyQuestions }), version: { increment: 1 } } }); await audit(tx, adminId, 'RUBRIC_DRAFT', id, 'EDIT_DRAFT', input.reason); return updated; }); }
  async fixtures(id: string) { validId(id); const row = await this.db.rubricDraft.findUnique({ where: { id } }); if (!row) throw new AppException(404, 'NOT_FOUND', 'Draft tidak ditemukan.'); const base = await this.db.rubricVersion.findUniqueOrThrow({ where: { id: row.baseVersionId } }); return rubricFixtures({ ...rubricDto(base), ...(row.questionConfig as unknown as Pick<RubricDto, 'questions' | 'contextPrompt'>), ...(row.safetyConfig as unknown as Pick<RubricDto, 'safetyQuestions'>) }); }
  async publish(adminId: string, id: string, input: z.infer<typeof versionReasonSchema>, key?: string) { validId(id); return idempotent(this.db, adminId, 'rubric-publish:' + id, key, input, async (tx) => {
    const row = await tx.rubricDraft.findUnique({ where: { id } }); if (!row || row.version !== input.expectedVersion || row.publishedVersionId) throw new AppException(409, 'STATE_CONFLICT', 'Draft rubrik sudah berubah.');
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${row.rubricKey}, 0))::text`;
    const base = await tx.rubricVersion.findUniqueOrThrow({ where: { id: row.baseVersionId } }); const candidate = { ...rubricDto(base), ...(row.questionConfig as unknown as Pick<RubricDto, 'questions' | 'contextPrompt'>), ...(row.safetyConfig as unknown as Pick<RubricDto, 'safetyQuestions'>) }; const fixtures = rubricFixtures(candidate);
    if (!fixtures.passed) throw new AppException(422, 'RUBRIC_FIXTURE_FAILED', 'Publikasi diblokir karena fixture gagal.', fixtures.tests);
    const now = new Date(); const number = await tx.rubricVersion.count({ where: { rubricKey: row.rubricKey } });
    const published = await tx.rubricVersion.create({ data: { rubricKey: row.rubricKey, categoryCode: base.categoryCode, subcategoryCode: base.subcategoryCode, ruleVersion: 'score-v1', policyVersion: 'policy-v' + (number + 1), recommendationVersion: base.recommendationVersion, questionConfig: json(row.questionConfig), safetyConfig: json(row.safetyConfig), effectiveAt: now, publishedAt: now, publishedById: adminId, publicationReason: input.reason } });
    await tx.rubricDraft.update({ where: { id }, data: { publishedVersionId: published.id, version: { increment: 1 } } });
    const items = await tx.item.findMany({ where: { categoryCode: base.categoryCode, subcategoryCode: base.subcategoryCode, reservedByTransactionId: null }, select: { id: true } });
    const ids = items.map((i) => i.id); const listings = await tx.listing.findMany({ where: { itemId: { in: ids }, status: { in: ['ACTIVE', 'PENDING_REVIEW'] } }, select: { id: true } });
    await tx.listing.updateMany({ where: { id: { in: listings.map((l) => l.id) } }, data: { status: 'PAUSED', publishedAt: null, version: { increment: 1 } } });
    await tx.offer.updateMany({ where: { status: { in: ['PENDING', 'COUNTERED'] }, OR: [{ listingId: { in: listings.map((l) => l.id) } }, { exchangeItemId: { in: ids } }] }, data: { status: 'EXPIRED', endReason: 'RUBRIC_PUBLISHED', version: { increment: 1 } } });
    await audit(tx, adminId, 'RUBRIC_DRAFT', id, 'PUBLISH_RUBRIC', input.reason, undefined, { versionId: published.id, fixtures }); return rubricDto(published);
  }); }
  async category(adminId: string, code: string, input: z.infer<typeof categoryAdminSchema>, key?: string) { return idempotent(this.db, adminId, 'category:' + code, key, input, async (tx) => { const row = await tx.category.findUnique({ where: { code } }); if (!row || row.updatedAt.toISOString() !== input.expectedUpdatedAt) throw new AppException(409, 'STATE_CONFLICT', 'Kategori sudah berubah.'); const updated = await tx.category.update({ where: { code }, data: { name: input.name, active: input.active } }); await audit(tx, adminId, 'CATEGORY', adminId, 'UPDATE_CATEGORY', input.reason, { code, active: row.active }, { active: input.active, name: input.name }); return updated; }); }
  async referenceStatus(adminId: string, id: string, active: boolean, input: z.infer<typeof versionReasonSchema>, key?: string) {
    validId(id); return idempotent(this.db, adminId, 'reference-status:' + id + ':' + active, key, input, async (tx) => {
      const row = await tx.economicReference.findUnique({ where: { id } });
      if (!row || row.version !== input.expectedVersion || row.active === active) throw new AppException(409, 'STATE_CONFLICT', 'Acuan ekonomi sudah berubah.');
      const updated = await tx.economicReference.update({ where: { id }, data: { active, version: { increment: 1 } } });
      await audit(tx, adminId, 'ECONOMIC_REFERENCE', id, active ? 'ACTIVATE_REFERENCE' : 'DEACTIVATE_REFERENCE', input.reason, { active: row.active }, { active });
      return { ...updated, amountIdr: updated.amountIdr.toString() };
    });
  }
  async reference(adminId: string, input: z.infer<typeof economicReferenceCreateSchema>, key?: string) { return idempotent(this.db, adminId, 'economic-reference', key, input, async (tx) => { if (!await tx.category.findFirst({ where: { code: input.categoryCode, active: true } }) || new Date(input.referenceDate) > new Date() || (input.field === 'comparableReplacementPrice' && input.amountIdr === 0)) throw new AppException(400, 'INVALID_INPUT', 'Kategori, tanggal, atau nominal acuan tidak valid.'); const { reason, ...data } = input; const row = await tx.economicReference.create({ data: { ...data, amountIdr: BigInt(input.amountIdr), referenceDate: new Date(input.referenceDate), createdById: adminId } }); await audit(tx, adminId, 'ECONOMIC_REFERENCE', row.id, 'CREATE_REFERENCE', reason); return { ...row, amountIdr: row.amountIdr.toString() }; }); }
}
