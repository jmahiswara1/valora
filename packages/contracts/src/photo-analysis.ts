import { z } from 'zod';
import { uuidSchema } from './common.js';

export const photoAnalysisInputSchema = z.object({
  itemId: uuidSchema.optional(),
  expectedVersion: z.number().int().positive().optional(),
  uploadTicketIds: z.array(uuidSchema).max(3).default([]),
  mediaIds: z.array(uuidSchema).max(3).default([]),
}).strict().superRefine((value, ctx) => {
  const ids = [...value.uploadTicketIds, ...value.mediaIds];
  if (ids.length < 1 || ids.length > 3 || new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'Pilih satu sampai tiga foto yang berbeda.' });
  if (!!value.itemId !== !!value.expectedVersion || (!value.itemId && value.mediaIds.length)) ctx.addIssue({ code: 'custom', message: 'Foto tersimpan memerlukan barang dan versi yang sesuai.' });
});

// Suggestions deliberately exclude function, safety declarations, economics and scoring.
const visualText = (max: number) => z.string().trim().min(3).max(max).refine(value => !/[<>]|https?:\/\/|www\./iu.test(value), 'Gunakan teks biasa.');
export const photoSuggestionsSchema = z.object({
  title: visualText(120).nullable(),
  categoryCode: z.string().min(2).max(50).nullable(),
  subcategoryCode: z.string().min(2).max(50).nullable(),
  description: visualText(3000).refine(value => value.length >= 10).nullable(),
  conditionSummary: visualText(1500).nullable(),
  issueSummary: visualText(1500).nullable(),
}).strict();
export const photoAnalysisContentSchema = z.object({
  status: z.enum(['READY', 'NEEDS_PHOTOS']),
  summary: visualText(500),
  suggestions: photoSuggestionsSchema,
  observations: z.array(visualText(500)).max(6),
  requestedPhotos: z.array(visualText(300)).max(4),
}).strict().superRefine((value, ctx) => {
  if (value.status === 'READY' && !Object.values(value.suggestions).some(Boolean)) ctx.addIssue({ code: 'custom', message: 'Hasil siap memerlukan saran.' });
  if (value.status === 'NEEDS_PHOTOS' && !value.requestedPhotos.length) ctx.addIssue({ code: 'custom', message: 'Jelaskan foto tambahan yang diperlukan.' });
});
export const photoAnalysisReasons = ['DISABLED', 'NOT_CONFIGURED', 'USER_QUOTA', 'APP_QUOTA', 'BUSY', 'TIMEOUT', 'UPSTREAM_UNAVAILABLE', 'INVALID_OUTPUT'] as const;
export const photoAnalysisSchema = z.object({
  status: z.enum(['READY', 'NEEDS_PHOTOS', 'UNAVAILABLE']),
  summary: visualText(500),
  suggestions: photoSuggestionsSchema,
  observations: z.array(visualText(500)).max(6),
  requestedPhotos: z.array(visualText(300)).max(4),
  cached: z.boolean(),
  generatedAt: z.iso.datetime().nullable(),
  expiresAt: z.iso.datetime().nullable(),
  reason: z.enum(photoAnalysisReasons).nullable(),
  retryAt: z.iso.datetime().nullable(),
}).strict();
export type PhotoAnalysisInput = z.infer<typeof photoAnalysisInputSchema>;
export type PhotoSuggestions = z.infer<typeof photoSuggestionsSchema>;
export type PhotoAnalysisDto = z.infer<typeof photoAnalysisSchema>;
export type PhotoAnalysisReason = typeof photoAnalysisReasons[number];
