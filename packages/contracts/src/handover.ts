import { z } from 'zod';
import { versionActionSchema, uuidSchema, listPageSchema } from './common.js';
import { handoverMethods } from './listings.js';

export const handoverStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'EXPIRED', 'INVALIDATED'] as const;
export const handoverZones = ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'] as const;
export const destinationSchema = z.object({ recipientName: z.string().trim().min(2).max(100), phone: z.string().trim().min(7).max(40).regex(/^\+?[\d ()-]+$/, 'Gunakan nomor telepon yang valid.'), address: z.string().trim().min(10).max(1000) }).strict();
export const handoverProposalSchema = versionActionSchema.extend({
  method: z.enum(handoverMethods), plannedAt: z.iso.datetime(), timeZone: z.enum(handoverZones),
  location: z.string().trim().min(5).max(1000).optional(), note: z.string().trim().max(1000).optional(), destination: destinationSchema.optional(),
}).strict().refine(x => x.method === 'MEETUP' ? Boolean(x.location) && !x.destination : !x.location, { message: 'Isi lokasi pertemuan atau alamat pengiriman sesuai metode.' });
export const handoverResponseSchema = versionActionSchema.extend({ accept: z.boolean(), destination: destinationSchema.optional(), reason: z.string().trim().min(5).max(1000).optional() }).strict().refine(x => x.accept || Boolean(x.reason), { message: 'Tambahkan alasan penolakan.' });
export const handoverWithdrawSchema = versionActionSchema.strict();
export const shipmentSchema = versionActionSchema.extend({ proposalId: uuidSchema, courier: z.string().trim().min(2).max(100), trackingNumber: z.string().trim().min(2).max(100), reason: z.string().trim().min(5).max(1000).optional() }).strict();
export const handoverPageSchema = listPageSchema.pick({ cursor: true, limit: true }).extend({ limit: z.coerce.number().int().min(1).max(50).default(20) });
export const adminHandoverPageSchema = handoverPageSchema.extend({ shipmentCursor: uuidSchema.optional() });
export type HandoverProposalInput = z.infer<typeof handoverProposalSchema>;
export type HandoverResponseInput = z.infer<typeof handoverResponseSchema>;
export type ShipmentInput = z.infer<typeof shipmentSchema>;
export type HandoverDestination = z.infer<typeof destinationSchema>;
export interface HandoverPrivateDetails { location: string | null; note: string | null; responseReason: string | null; destinations: { userId: string; details: HandoverDestination }[] }
export interface HandoverProposalDto { id: string; transactionId: string; proposedById: string; method: typeof handoverMethods[number]; plannedAt: string; timeZone: typeof handoverZones[number]; status: typeof handoverStatuses[number]; endReason: string | null; privateDetails: HandoverPrivateDetails | null; createdAt: string; respondedAt: string | null; respondedById: string | null; purgedAt: string | null }
export interface ShipmentDto { id: string; proposalId: string; itemId: string; senderId: string; courier: string | null; trackingNumber: string | null; reason: string | null; revision: number; recordedAt: string; purgedAt: string | null }
export interface HandoverDirectionDto { itemId: string; title: string; fromUserId: string; toUserId: string; received: boolean; canRecord: boolean; shipment: ShipmentDto | null }
export interface HandoverDto { transactionId: string; version: number; deadlineAt: string; serverTime: string; agreed: HandoverProposalDto | null; pending: HandoverProposalDto | null; directions: HandoverDirectionDto[]; permissions: { canPropose: boolean; canRespond: boolean; canWithdraw: boolean; reason: string | null } }
export interface HandoverMutationDto { id: string; transactionId: string; version: number; status: string }
export interface TransactionTimelineDto { id: string; type: string; actorId: string | null; label: string; occurredAt: string; proposalId: string | null; itemId: string | null }
export interface AdminHandoverDto { coordination: HandoverDto; history: HandoverProposalDto[]; shipments: ShipmentDto[]; accessExpiresAt: string; nextCursor: string | null; shipmentNextCursor: string | null }
