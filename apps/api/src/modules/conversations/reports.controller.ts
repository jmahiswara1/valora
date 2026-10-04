import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Controller, UseGuards, Post, Req, Body } from '@nestjs/common';
import { SessionGuard } from '../auth/guards.js';
import { DatabaseService } from '../../infrastructure/database.service.js';
import { type AppRequest, ZodPipe, AppException } from '../../shared/http.js';
import { reportCreateSchema, type ReportCreateInput } from '@valora/contracts';
import { serial } from '../../shared/transactions.js';

@ApiTags('reports-blocks')
@Controller('reports')
@UseGuards(SessionGuard)
export class ReportsController {
  constructor(private readonly db: DatabaseService) {}
  @Post()
  @ApiOperation({ summary: 'Laporkan Listing, pesan, atau akun dengan alasan' })
  async create(@Req() request: AppRequest, @Body(new ZodPipe(reportCreateSchema)) input: ReportCreateInput) {
    const reporterId = request.actor!.id;
    const reporter = await this.db.user.findUnique({ where: { id: reporterId }, select: { emailVerifiedAt: true } });
    if (!reporter?.emailVerifiedAt) throw new AppException(403, 'EMAIL_UNVERIFIED', 'Verifikasi email sebelum mengirim laporan.');
    return serial(this.db, async (tx) => {
    let messageId: string | null = null;
    if (input.targetType === 'LISTING') {
      const listing = await tx.listing.findUnique({ where: { id: input.targetId }, select: { id: true, ownerId: true, status: true } });
      if (!listing || listing.ownerId === reporterId || !['ACTIVE', 'RESERVED', 'SUSPENDED'].includes(listing.status)) throw new AppException(404, 'NOT_FOUND', 'Konten tidak ditemukan.');
    } else if (input.targetType === 'MESSAGE') {
      const message = await tx.message.findUnique({ where: { id: input.targetId }, include: { conversation: true } });
      if (!message || message.deletedAt || (message.conversation.participantAId !== reporterId && message.conversation.participantBId !== reporterId) || message.senderId === reporterId) throw new AppException(404, 'NOT_FOUND', 'Konten tidak ditemukan.');
      messageId = message.id;
    } else if (input.targetType === 'TRANSACTION') {
      const transaction = await tx.transaction.findUnique({ where: { id: input.targetId } });
      if (!transaction || ![transaction.sellerOrDonorId, transaction.buyerOrRecipientId].includes(reporterId)) throw new AppException(404, 'NOT_FOUND', 'Transaksi tidak ditemukan.');
    } else {
      if (input.targetId === reporterId || !await tx.conversation.findFirst({ where: { OR: [{ participantAId: reporterId, participantBId: input.targetId }, { participantAId: input.targetId, participantBId: reporterId }] }, select: { id: true } })) throw new AppException(404, 'NOT_FOUND', 'Akun tidak ditemukan.');
    }
    const report = await tx.report.create({ data: { reporterId, targetType: input.targetType, targetId: input.targetId, messageId, reasonCode: input.reasonCode, details: input.details } });
    return { id: report.id, status: report.status, createdAt: report.createdAt.toISOString() };
    });
  }
}
