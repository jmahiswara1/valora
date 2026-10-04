import type { Prisma } from '../../generated/prisma/client.js';
import { uuidSchema, type RubricDto, type AssessmentDto, type AssessmentCreateInput } from '@valora/contracts';
import { AppException } from '../../shared/http.js';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database.service.js';
import { serial, lockRows } from '../../shared/transactions.js';
import { evaluateAssessment } from './engine.js';
import { assessmentEvents } from '../history/ledger.js';
import type { RubricRow } from './shared.js';
import { rubricDto } from './helpers.js';

type AssessmentRow = Prisma.AssessmentGetPayload<{ include: { rubricVersion: true } }>;

const rubricKey = (category: string, subcategory: string | null) => subcategory ? `${category}/${subcategory}` : category;

const cursorEncode = (at: Date, id: string) => Buffer.from(JSON.stringify({ at: at.toISOString(), id })).toString('base64url');

function cursorDecode(value: string): { at: Date; id: string } {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as { at: string; id: string };
    if (!uuidSchema.safeParse(parsed.id).success || Number.isNaN(Date.parse(parsed.at))) throw new Error('invalid');
    return { at: new Date(parsed.at), id: parsed.id };
  } catch { throw new AppException(400, 'INVALID_INPUT', 'Cursor daftar tidak valid.'); }
}

function pageLimit(value?: string): number {
  const limit = value === undefined ? 20 : Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new AppException(400, 'INVALID_INPUT', 'Limit harus antara 1 dan 50.');
  return limit;
}

@Injectable()
export class AssessmentsService {
  constructor(private readonly db: DatabaseService) {}

  async activeRubric(categoryCode: string, subcategoryCode: string | null, tx: Prisma.TransactionClient = this.db): Promise<RubricRow | null> {
    return tx.rubricVersion.findFirst({ where: { rubricKey: rubricKey(categoryCode, subcategoryCode), effectiveAt: { lte: new Date() } }, orderBy: [{ effectiveAt: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }] });
  }

  async rubric(categoryCode: string, subcategoryCode?: string): Promise<RubricDto> {
    const row = await this.activeRubric(categoryCode, subcategoryCode || null);
    if (!row) throw new AppException(404, 'NOT_FOUND', 'Rubrik belum tersedia untuk kategori ini.');
    return rubricDto(row);
  }

  private dto(row: AssessmentRow, currentAssessmentId: string | null, detailed: boolean): AssessmentDto {
    const answers = row.answersSnapshot as unknown as AssessmentCreateInput;
    return {
      id: row.id, itemId: row.itemId, itemRevision: row.itemRevision, rubricVersionId: row.rubricVersionId,
      ruleVersion: row.rubricVersion.ruleVersion, policyVersion: row.rubricVersion.policyVersion,
      recommendationVersion: row.rubricVersion.recommendationVersion, rubric: rubricDto(row.rubricVersion),
      status: row.status, condition: row.condition, repairability: row.repairability, repairabilityReason: row.repairabilityReason as 'NOT_NEEDED' | null, economicValue: row.economicValue,
      reusePotential: row.reusePotential, score: row.valid ? row.score : null, label: row.valid ? row.label : null,
      missingFields: row.missingFields as string[], safetyFlags: row.safetyFlags as string[],
      recommendations: row.recommendationSnapshot as unknown as AssessmentDto['recommendations'],
      answers: detailed ? answers : null, economicSources: detailed ? row.sourceSnapshot as AssessmentDto['economicSources'] : null,
      createdAt: row.createdAt.toISOString(),
      isCurrent: row.id === currentAssessmentId,
      origin: 'USER_REPORTED',
    };
  }

  private async latestCurrentId(item: { id: string; itemRevision: number; currentOwnerId: string }, activeRubricId: string | null): Promise<string | null> {
    if (!activeRubricId) return null;
    const latest = await this.db.assessment.findFirst({ where: { valid: true, itemId: item.id, itemRevision: item.itemRevision, rubricVersionId: activeRubricId, createdById: item.currentOwnerId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true } });
    return latest?.id ?? null;
  }

  async create(userId: string, itemId: string, input: AssessmentCreateInput): Promise<AssessmentDto> {
    if (!uuidSchema.safeParse(itemId).success) throw new AppException(404, 'NOT_FOUND', 'Item tidak ditemukan.');
    return serial(this.db, async (tx) => {
      await lockRows(tx, 'User', [userId]);
      await tx.$queryRaw`SELECT id FROM "Item" WHERE id = ${itemId}::uuid FOR UPDATE`;
      const item = await tx.item.findFirst({ where: { id: itemId, currentOwnerId: userId, archivedAt: null } });
      if (!item) throw new AppException(404, 'NOT_FOUND', 'Item tidak ditemukan.');
      if (item.reservedByTransactionId) throw new AppException(409, 'ITEM_RESERVED', 'Item sedang dalam kesepakatan.');
      if (item.itemRevision !== input.expectedItemRevision) throw new AppException(409, 'STATE_CONFLICT', 'Item berubah. Muat ulang formulir penilaian.');
      const rubric = await this.activeRubric(item.categoryCode, item.subcategoryCode, tx);
      if (!rubric) throw new AppException(422, 'ASSESSMENT_INCOMPLETE', 'Rubrik kategori belum tersedia.');
      if (rubric.id !== input.rubricVersionId) throw new AppException(409, 'STATE_CONFLICT', 'Rubrik berubah. Muat ulang formulir penilaian.');
      const config = rubricDto(rubric);
      const validSafety = new Set(config.safetyQuestions.map((question) => question.code));
      if (Object.keys(input.safetyAnswers).some((key) => !validSafety.has(key))) throw new AppException(400, 'INVALID_INPUT', 'Pertanyaan keselamatan tidak sesuai rubrik.');
      if (input.economic.comparableReplacementPrice?.amountIdr === 0) throw new AppException(400, 'INVALID_INPUT', 'Harga pembanding harus lebih dari nol.');
      const normalized: AssessmentCreateInput = structuredClone(input);
      const category = await tx.category.findUnique({ where: { code: item.categoryCode } });
      const subcategory = item.subcategoryCode ? await tx.category.findUnique({ where: { code: item.subcategoryCode } }) : null;
      if (!category?.active || (item.subcategoryCode && !subcategory?.active)) throw new AppException(422, 'ACTION_INELIGIBLE', 'Kategori dinonaktifkan.');
      for (const field of ['estimatedResaleValue', 'estimatedRepairCost', 'comparableReplacementPrice'] as const) {
        const source = normalized.economic[field];
        if (source?.sourceType === 'ADMIN_CATEGORY_REFERENCE') {
          const ref = source.referenceId && await tx.economicReference.findFirst({ where: { id: source.referenceId, active: true, categoryCode: item.categoryCode, field } });
          if (!ref) throw new AppException(400, 'INVALID_INPUT', 'Pilih acuan admin yang aktif dan sesuai kategori.');
          normalized.economic[field] = { referenceId: ref.id, amountIdr: Number(ref.amountIdr), sourceType: 'ADMIN_CATEGORY_REFERENCE', sourceNote: ref.sourceNote + ' · ' + ref.region, referenceDate: ref.referenceDate.toISOString().slice(0, 10) };
        } else if (source?.referenceId) throw new AppException(400, 'INVALID_INPUT', 'Acuan harus dipilih sebagai acuan admin.');
      }
      if (normalized.repairNeeded === false) { delete normalized.answers.repairMethod; delete normalized.answers.repairSupport; }
      if (input.repairNeeded === false && !normalized.economic.estimatedRepairCost) {
        normalized.economic.estimatedRepairCost = { amountIdr: 0, sourceType: 'USER_ESTIMATE', sourceNote: 'NOT_NEEDED: tidak perlu perbaikan', referenceDate: new Date().toISOString().slice(0, 10) };
      }
      if (input.repairNeeded === false && normalized.economic.estimatedRepairCost?.amountIdr !== 0) throw new AppException(400, 'INVALID_INPUT', 'Biaya perbaikan harus nol bila tidak perlu perbaikan.');
      if (normalized.economic.estimatedRepairCost?.amountIdr === 0 && input.repairNeeded === true && normalized.economic.estimatedRepairCost.sourceNote.trim().length < 8) throw new AppException(400, 'INVALID_INPUT', 'Jelaskan alasan biaya perbaikan nol.');
      const sources = Object.fromEntries(Object.entries(normalized.economic).filter(([, value]) => value).map(([key, value]) => [key, { ...value, reportedBy: userId }]));
      const result = evaluateAssessment(normalized, config);
      const created = await tx.assessment.create({ data: {
        itemId, createdById: userId, itemRevision: item.itemRevision, rubricVersionId: rubric.id, status: result.status,
        answersSnapshot: normalized as unknown as Prisma.InputJsonValue,
        safetySnapshot: { answers: normalized.safetyAnswers, flags: result.safetyFlags } as Prisma.InputJsonValue,
        sourceSnapshot: sources as Prisma.InputJsonValue,
        condition: result.condition, repairability: result.repairability, repairabilityReason: result.repairabilityReason, economicValue: result.economicValue,
        reusePotential: result.reusePotential, score: result.score, label: result.label,
        missingFields: result.missingFields as Prisma.InputJsonValue, safetyFlags: result.safetyFlags as Prisma.InputJsonValue,
        recommendationSnapshot: result.recommendations as unknown as Prisma.InputJsonValue,
      }, include: { rubricVersion: true } });
      await assessmentEvents(tx, created);
      return this.dto(created, created.id, true);
    });
  }

  async list(userId: string, itemId: string, limitText?: string, cursorText?: string): Promise<{ data: AssessmentDto[]; meta: { nextCursor: string | null } }> {
    if (!uuidSchema.safeParse(itemId).success) throw new AppException(404, 'NOT_FOUND', 'Item tidak ditemukan.');
    const item = await this.db.item.findFirst({ where: { id: itemId, currentOwnerId: userId, archivedAt: null } });
    if (!item) throw new AppException(404, 'NOT_FOUND', 'Item tidak ditemukan.');
    const limit = pageLimit(limitText);
    const cursor = cursorText ? cursorDecode(cursorText) : null;
    const active = await this.activeRubric(item.categoryCode, item.subcategoryCode);
    const currentId = await this.latestCurrentId(item, active?.id ?? null);
    const rows = await this.db.assessment.findMany({ where: { itemId, ...(cursor ? { OR: [{ createdAt: { lt: cursor.at } }, { createdAt: cursor.at, id: { lt: cursor.id } }] } : {}) }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: limit + 1, include: { rubricVersion: true } });
    const page = rows.slice(0, limit);
    return { data: page.map((row) => this.dto(row, currentId, row.createdById === userId)), meta: { nextCursor: rows.length > limit && page.at(-1) ? cursorEncode(page.at(-1)!.createdAt, page.at(-1)!.id) : null } };
  }

  async get(userId: string, id: string): Promise<AssessmentDto> {
    if (!uuidSchema.safeParse(id).success) throw new AppException(404, 'NOT_FOUND', 'Penilaian tidak ditemukan.');
    const row = await this.db.assessment.findUnique({ where: { id }, include: { rubricVersion: true, item: true } });
    if (!row || (row.createdById !== userId && row.item.currentOwnerId !== userId)) throw new AppException(404, 'NOT_FOUND', 'Penilaian tidak ditemukan.');
    const active = await this.activeRubric(row.item.categoryCode, row.item.subcategoryCode);
    const currentId = await this.latestCurrentId(row.item, active?.id ?? null);
    return this.dto(row, currentId, row.createdById === userId);
  }
}
