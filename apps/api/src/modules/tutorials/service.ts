import { Injectable } from '@nestjs/common';
import type { RepairGuide, TutorialSessionDto, TutorialAvailability, TutorialStartPreview, TutorialCreateInput, TutorialActionInput, TutorialRecordInput, TutorialMutationResult } from '@valora/contracts';
import type { Prisma, RepairTutorialSession } from '../../generated/prisma/client.js';
import { DatabaseService } from '../../infrastructure/database.service.js';
import { idempotent, json, serial, validId } from '../../shared/transactions.js';
import { AppException } from '../../shared/http.js';
import { cursorId, page } from '../../shared/pagination.js';
import { pauseListingsForItem } from '../listings/state.js';
import { compatible, digest, guideFor, guideWithdrawn, repairGuides } from './catalog.js';
import { RepairsService } from '../repairs/service.js';
import { TutorialPhotosService } from './photos.js';

export const tutorialsEnabled = () => process.env.REPAIR_TUTORIALS_ENABLED === 'true';
export const sessionGuide = (row: RepairTutorialSession) => row.guideSnapshot as unknown as RepairGuide;
export const stepIds = (value: Prisma.JsonValue) => value as string[];
export async function sessionFor(tx: Prisma.TransactionClient, actorId: string, id: string) {
  validId(id);
  const row = await tx.repairTutorialSession.findFirst({ where: { id, createdById: actorId }, include: { item: true, record: { select: { id: true } }, photos: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } } } });
  if (!row) throw new AppException(404, 'NOT_FOUND', 'Sesi panduan tidak ditemukan.');
  return row;
}
export async function sessionContextReason(tx: Prisma.TransactionClient, row: Awaited<ReturnType<typeof sessionFor>>) {
  if (row.item.currentOwnerId !== row.createdById || row.item.archivedAt) return 'OWNERSHIP_CHANGED';
  if (row.sourceItemRevision !== row.item.itemRevision) return 'ITEM_CHANGED';
  if (row.item.reservedByTransactionId) return 'ITEM_RESERVED';
  if (guideWithdrawn(row.guideId, row.guideVersion)) return 'GUIDE_WITHDRAWN';
  const latest = await tx.assessment.findFirst({ where: { itemId: row.itemId, createdById: row.createdById, valid: true, itemRevision: row.sourceItemRevision }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { safetyFlags: true } });
  if ((latest?.safetyFlags as string[] | undefined)?.some(flag => flag.startsWith('PROHIBITED:'))) return 'ASSESSMENT_BLOCKED';
  return null;
}
function conflict(message = 'Sesi berubah. Muat ulang sebelum melanjutkan.'): never { throw new AppException(409, 'STATE_CONFLICT', message); }
function prepared(row: RepairTutorialSession) { const answers = row.preflight as Record<string, string>; return sessionGuide(row).preparation.every(q => answers[q.id] === q.requiredAnswer); }

@Injectable()
export class TutorialsService {
  constructor(private readonly db: DatabaseService, private readonly repairs: RepairsService, private readonly photos: TutorialPhotosService) {}
  catalog() { return { enabled: tutorialsEnabled(), guides: repairGuides.filter(g => !guideWithdrawn(g.id, g.version)) }; }
  guide(id: string) { const guide = guideFor(id); if (!guide || guideWithdrawn(guide.id, guide.version)) throw new AppException(404, 'NOT_FOUND', 'Panduan tidak tersedia.'); return guide; }
  async availability(actorId: string, itemId: string): Promise<TutorialAvailability> {
    validId(itemId);
    return serial(this.db, async tx => {
      const item = await tx.item.findFirst({ where: { id: itemId, currentOwnerId: actorId, archivedAt: null } });
      if (!item) throw new AppException(404, 'NOT_FOUND', 'Barang tidak ditemukan.');
      const existing = await tx.repairTutorialSession.findFirst({ where: { itemId, closedAt: null }, select: { id: true, createdById: true } });
      return { enabled: tutorialsEnabled() && !item.reservedByTransactionId, itemVersion: item.version, guides: repairGuides.filter(g => compatible(g, item) && !guideWithdrawn(g.id, g.version)), unclosedSessionId: existing?.createdById === actorId ? existing.id : null };
    });
  }
  async create(actorId: string, itemId: string, input: TutorialCreateInput, key?: string): Promise<TutorialMutationResult> {
    validId(itemId);
    return idempotent(this.db, actorId, 'tutorial-create:' + itemId, key, input, async tx => {
      if (!tutorialsEnabled()) throw new AppException(409, 'FEATURE_DISABLED', 'Panduan baru belum diaktifkan.');
      const item = await tx.item.findFirst({ where: { id: itemId, currentOwnerId: actorId, archivedAt: null } });
      if (!item) throw new AppException(404, 'NOT_FOUND', 'Barang tidak ditemukan.');
      if (item.version !== input.expectedItemVersion || item.reservedByTransactionId) conflict('Barang berubah atau sedang dalam kesepakatan.');
      const guide = this.guide(input.guideId);
      if (guide.version !== input.guideVersion || !compatible(guide, item)) conflict('Panduan tidak sesuai kategori atau versinya sudah berubah.');
      if (await tx.repairTutorialSession.findFirst({ where: { itemId, closedAt: null } })) conflict('Barang memiliki sesi yang belum ditutup. Lanjutkan sesi tersebut.');
      const assessment = await tx.assessment.findFirst({ where: { itemId, createdById: actorId, itemRevision: item.itemRevision, valid: true }, orderBy: { createdAt: 'desc' } });
      const row = await tx.repairTutorialSession.create({ data: { createdById: actorId, itemId, guideId: guide.id, guideVersion: guide.version, guideHash: guide.hash, guideSnapshot: json(guide), itemContext: json({ title: item.title, conditionSummary: item.conditionSummary, categoryCode: item.categoryCode, subcategoryCode: item.subcategoryCode }), sourceItemRevision: item.itemRevision, assessmentId: assessment?.id, problem: input.problem } });
      return { id: row.id, version: row.version };
    });
  }
  async mine(actorId: string, cursor?: string, state?: string) {
    const rows = await this.db.repairTutorialSession.findMany({ where: { createdById: actorId, ...(state === 'active' ? { closedAt: null } : state === 'closed' ? { closedAt: { not: null } } : {}) }, ...cursorId(cursor), take: 31, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], include: { record: { select: { id: true } } } });
    return page(rows.map(row => ({ id: row.id, itemId: row.itemId, itemTitle: (row.itemContext as { title?: string }).title ?? 'Barang', title: sessionGuide(row).title, activityKind: sessionGuide(row).activityKind, state: row.state, completedSteps: stepIds(row.progress).length, totalSteps: sessionGuide(row).steps.length, createdAt: row.createdAt.toISOString(), recordId: row.record?.id ?? null })));
  }
  async detail(actorId: string, id: string): Promise<TutorialSessionDto> {
    return serial(this.db, async tx => {
      let row = await sessionFor(tx, actorId, id);
      if (!row.closedAt) {
        const reason = await sessionContextReason(tx, row);
        if (reason && row.reason !== reason) {
          const invalid = ['OWNERSHIP_CHANGED', 'ITEM_CHANGED'].includes(reason);
          await tx.repairTutorialSession.update({ where: { id }, data: { state: invalid ? 'INVALIDATED' : row.state === 'REVIEW' ? 'REVIEW' : 'BLOCKED', reason, ...(invalid ? { closedAt: new Date() } : {}), version: { increment: 1 } } });
          row = await sessionFor(tx, actorId, id);
        } else if (!reason && row.state === 'BLOCKED' && ['ITEM_RESERVED', 'GUIDE_WITHDRAWN', 'ASSESSMENT_BLOCKED'].includes(row.reason ?? '')) {
          await tx.repairTutorialSession.update({ where: { id }, data: { state: row.startedAt ? 'PAUSED' : 'PREFLIGHT', reason: null, version: { increment: 1 } } });
          row = await sessionFor(tx, actorId, id);
        }
      }
      const owned = row.item.currentOwnerId === actorId && !row.item.archivedAt;
      const current = owned && row.sourceItemRevision === row.item.itemRevision && !row.item.reservedByTransactionId;
      const valid = current && !row.closedAt && !row.purgedAt && !await sessionContextReason(tx, row);
      const context = row.itemContext as { title: string; conditionSummary: string | null };
      return { draftPhotoIds: row.purgedAt ? [] : (row.draft as { photoIds?: string[] }).photoIds ?? [], draft: row.purgedAt || !Object.keys(row.draft as object).length ? null : row.draft as unknown as TutorialSessionDto['draft'], id: row.id, itemId: row.itemId, itemTitle: context.title, itemVersion: owned ? row.item.version : null, itemCondition: owned ? row.item.conditionSummary : context.conditionSummary, guide: sessionGuide(row), problem: row.problem, answers: row.preflight as TutorialSessionDto['answers'], completedSteps: stepIds(row.progress), performedActions: stepIds(row.performedActions), state: row.state, reason: row.reason, version: row.version, startedAt: row.startedAt?.toISOString() ?? null, closedAt: row.closedAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString(), purgedAt: row.purgedAt?.toISOString() ?? null, recordId: row.record?.id ?? null, photos: row.photos.map(p => ({ id: p.id, stepId: p.stepId, bytes: p.bytes, width: p.width, height: p.height, createdAt: p.createdAt.toISOString() })), capabilities: { canStart: Boolean(valid && row.state === 'PREFLIGHT' && prepared(row)), canContinue: Boolean(valid && ['IN_PROGRESS', 'PAUSED'].includes(row.state)), canAsk: Boolean(valid && ['PREFLIGHT', 'IN_PROGRESS', 'PAUSED'].includes(row.state)), canRecord: Boolean(current && !row.closedAt && row.state === 'REVIEW' && stepIds(row.performedActions).length), canClose: Boolean(current && !row.closedAt) } };
    });
  }
  private async preview(tx: Prisma.TransactionClient, actorId: string, id: string): Promise<TutorialStartPreview> {
    const row = await sessionFor(tx, actorId, id);
    if (row.closedAt || row.state !== 'PREFLIGHT' || !prepared(row) || await sessionContextReason(tx, row)) conflict('Persiapan belum sesuai atau kondisi barang berubah.');
    const listings = await tx.listing.findMany({ where: { itemId: row.itemId, ownerId: actorId, status: { in: ['ACTIVE', 'PENDING_REVIEW'] } }, orderBy: { id: 'asc' }, select: { id: true, status: true, version: true, currentRevision: { select: { title: true } } } });
    // Includes every member in advanced Exchange, including counter offers.
    const offers = await tx.offer.findMany({ where: { status: { in: ['PENDING', 'COUNTERED'] }, OR: [{ listingId: { in: listings.map(l => l.id) } }, { exchangeItemId: row.itemId }, { currentRevision: { items: { some: { itemId: row.itemId } } } }] }, orderBy: { id: 'asc' }, select: { id: true, version: true, currentRevisionId: true } });
    return { sessionId: id, expectedVersion: row.version, expectedItemVersion: row.item.version, listings: listings.map(l => ({ id: l.id, title: l.currentRevision?.title ?? 'Listing barang', status: l.status, version: l.version })), relatedOfferCount: offers.length, impactHash: digest({ session: id, version: row.version, itemVersion: row.item.version, listings, offers }) };
  }
  startPreview(actorId: string, id: string) { return serial(this.db, tx => this.preview(tx, actorId, id)); }
  async action(actorId: string, id: string, input: TutorialActionInput, key?: string): Promise<TutorialMutationResult> {
    validId(id);
    return idempotent(this.db, actorId, 'tutorial-action:' + id, key, input, async tx => {
      const row = await sessionFor(tx, actorId, id);
      if (row.closedAt || row.version !== input.expectedVersion || row.purgedAt) conflict();
      if (row.reason === 'STEP_STOP_CONDITION' && !['STOP', 'CLOSE', 'SAVE_DRAFT'].includes(input.action)) conflict('Ada kondisi berhenti. Hentikan dan tinjau tindakan yang sudah dilakukan.');
      const reason = await sessionContextReason(tx, row);
      if (['OWNERSHIP_CHANGED', 'ITEM_CHANGED', 'ITEM_RESERVED'].includes(reason ?? '')) conflict('Kondisi atau kepemilikan barang berubah.');
      const closing = ['STOP', 'CLOSE', 'REVIEW', 'SAVE_DRAFT'].includes(input.action);
      if (reason && !closing) conflict('Panduan dihentikan karena kondisi di luar cakupan. Tinjau tindakan atau tutup sesi.');
      const guide = sessionGuide(row);
      const progress = stepIds(row.progress), performed = stepIds(row.performedActions);
      const data: Prisma.RepairTutorialSessionUpdateInput = { version: { increment: 1 } };
      switch (input.action) {
        case 'PREPARE':
          if (row.state !== 'PREFLIGHT') conflict();
          if (Object.keys(input.answers).some(id => !guide.preparation.some(q => q.id === id))) throw new AppException(400, 'INVALID_INPUT', 'Pertanyaan persiapan tidak dikenal.');
          data.preflight = json(input.answers); break;
        case 'START': {
          const preview = await this.preview(tx, actorId, id);
          if (preview.expectedItemVersion !== input.expectedItemVersion || preview.impactHash !== input.impactHash) conflict('Dampak ke Market berubah. Buka kembali konfirmasi untuk melihat perubahan terkini.');
          await pauseListingsForItem(tx, row.itemId, 'REPAIR_STARTED');
          data.state = 'IN_PROGRESS'; data.startedAt = new Date(); break;
        }
        case 'STEP_DONE': {
          if (row.state !== 'IN_PROGRESS' || guide.steps[progress.length]?.id !== input.stepId) conflict('Selesaikan langkah aktif secara berurutan.');
          data.progress = json([...progress, input.stepId]); data.performedActions = json([...new Set([...performed, input.stepId])]); break;
        }
        case 'UNDO': {
          if (!['IN_PROGRESS', 'PAUSED'].includes(row.state)) conflict();
          const at = progress.indexOf(input.stepId); if (at < 0) conflict(); data.progress = json(progress.slice(0, at)); break;
        }
        case 'PAUSE': if (row.state !== 'IN_PROGRESS') conflict(); data.state = 'PAUSED'; break;
        case 'RESUME': if (row.state !== 'PAUSED') conflict(); data.state = 'IN_PROGRESS'; data.reason = null; break;
        case 'REVIEW': if (!row.startedAt || progress.length !== guide.steps.length) conflict('Selesaikan langkah atau gunakan Hentikan untuk meninjau hasil sebagian.'); data.state = 'REVIEW'; break;
        case 'STOP': {
          const acted = performed.length > 0 || (Boolean(row.startedAt) && input.performedActions);
          data.state = acted ? 'REVIEW' : 'STOPPED'; data.closedAt = acted ? null : new Date();
          if (acted && !performed.length) data.performedActions = ['reported-action']; break;
        }
        case 'SAVE_DRAFT': {
          if (row.state !== 'REVIEW') conflict();
          if (new Set(input.photoIds).size !== input.photoIds.length || input.photoIds.some(id => !row.photos.some(p => p.id === id))) throw new AppException(400, 'MEDIA_INVALID', 'Pilih foto dari sesi ini.');
          data.draft = json({ ...input.record, activityKind: guide.activityKind, photoIds: input.photoIds }); break;
        }
        case 'CLOSE': {
          if (row.state !== 'REVIEW') conflict('Tinjau hasil terlebih dahulu.');
          if (row.item.conditionSummary !== input.afterCondition) {
            await tx.item.update({ where: { id: row.itemId }, data: { conditionSummary: input.afterCondition, version: { increment: 1 }, itemRevision: { increment: 1 } } });
            await pauseListingsForItem(tx, row.itemId);
          }
          data.state = 'STOPPED'; data.closedAt = new Date(); data.draft = {}; break;
        }
      }
      const next = await tx.repairTutorialSession.update({ where: { id }, data });
      return { id: next.id, version: next.version };
    });
  }
  async record(actorId: string, id: string, input: TutorialRecordInput, key?: string): Promise<TutorialMutationResult> {
    // Evidence copies happen before the transaction; failure queues only the new copies.
    const before = await this.detail(actorId, id);
    if (before.recordId) return idempotent(this.db, actorId, 'tutorial-record:' + id, key, input, async tx => { const row = await sessionFor(tx, actorId, id); return { id, version: row.version, recordId: row.record!.id }; });
    if (!before.capabilities.canRecord || before.version !== input.expectedVersion) conflict();
    const copies = await this.photos.copyEvidence(actorId, id, input.photoIds);
    try {
      const result = await idempotent(this.db, actorId, 'tutorial-record:' + id, key, input, async tx => {
        const row = await sessionFor(tx, actorId, id);
        if (row.record) return { id, version: row.version, recordId: row.record.id };
        if (row.version !== input.expectedVersion || row.closedAt || row.state !== 'REVIEW' || row.item.currentOwnerId !== actorId || row.item.archivedAt || row.item.reservedByTransactionId || row.item.itemRevision !== row.sourceItemRevision || !stepIds(row.performedActions).length) conflict();
        await this.photos.validateCopies(tx, actorId, id, input.photoIds, copies);
        const record = await this.repairs.createInTransaction(tx, actorId, row.itemId, { ...input.record, activityKind: sessionGuide(row).activityKind, evidenceTicketIds: copies.map(c => c.ticketId) }, id);
        const next = await tx.repairTutorialSession.update({ where: { id }, data: { state: 'RECORDED', closedAt: new Date(), draft: {}, version: { increment: 1 } } });
        return { id, version: next.version, recordId: record.id };
      });
      await this.photos.discardUnused(copies);
      return result;
    } catch (error) { await this.photos.discardUnused(copies); throw error; }
  }
}
