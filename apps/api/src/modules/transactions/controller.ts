import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Controller, UseGuards, Get, Req, Param, Post, Headers, Body } from '@nestjs/common';
import { SessionGuard } from '../auth/guards.js';
import { type AppRequest, ZodPipe } from '../../shared/http.js';
import { confirmationSchema, type ConfirmationInput, cashConfirmationSchema, type CashConfirmationInput, cancellationSchema, cancellationResponseSchema, disputeSchema } from '@valora/contracts';
import { TransactionsService } from "./service.js";

@ApiTags('transactions')
@Controller('transactions')
@UseGuards(SessionGuard)
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}
  @Post(':id/cash-confirmations')
  @ApiOperation({ summary: 'Laporan pengguna atas penyerahan atau penerimaan tambahan uang Exchange' })
  cash(@Req() req: AppRequest, @Param('id') id: string, @Headers('idempotency-key') key: string | undefined, @Body(new ZodPipe(cashConfirmationSchema)) input: CashConfirmationInput) { return this.transactions.confirmCash(req.actor!.id, id, input, key); }
  @Get(':id') @ApiOperation({ summary: 'Detail kesepakatan bagi peserta atau admin kasus' })
  get(@Req() req: AppRequest, @Param('id') id: string) { return this.transactions.get(req.actor!.id, id); }
  @Post(':id/confirmations') @ApiOperation({ summary: 'Konfirmasi penyerahan atau penerimaan barang' })
  confirm(@Req() req: AppRequest, @Param('id') id: string, @Headers('idempotency-key') key: string | undefined, @Body(new ZodPipe(confirmationSchema)) input: ConfirmationInput) { return this.transactions.confirm(req.actor!.id, id, input, key); }
  @Post(':id/cancellation-requests') @ApiOperation({ summary: 'Ajukan pembatalan dengan alasan' })
  cancel(@Req() req: AppRequest, @Param('id') id: string, @Headers('idempotency-key') key: string | undefined, @Body(new ZodPipe(cancellationSchema)) input: { expectedVersion: number; reason: string }) { return this.transactions.requestCancel(req.actor!.id, id, input, key); }
  @Post(':id/cancellation-requests/:requestId/respond') @ApiOperation({ summary: 'Setujui atau tolak permintaan pembatalan pihak lain' })
  respond(@Req() req: AppRequest, @Param('id') id: string, @Param('requestId') requestId: string, @Headers('idempotency-key') key: string | undefined, @Body(new ZodPipe(cancellationResponseSchema)) input: { expectedVersion: number; accept: boolean }) { return this.transactions.respondCancel(req.actor!.id, id, requestId, input, key); }
  @Post(':id/disputes') @ApiOperation({ summary: 'Buka sengketa dan tahan penyelesaian otomatis' })
  dispute(@Req() req: AppRequest, @Param('id') id: string, @Headers('idempotency-key') key: string | undefined, @Body(new ZodPipe(disputeSchema)) input: { expectedVersion: number; reason: string }) { return this.transactions.dispute(req.actor!.id, id, input, key); }
}
