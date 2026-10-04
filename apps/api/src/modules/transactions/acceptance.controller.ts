import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Controller, UseGuards, Post, Req, Param, Headers, Body } from '@nestjs/common';
import { SessionGuard } from '../auth/guards.js';
import { type AppRequest, ZodPipe } from '../../shared/http.js';
import { offerAcceptSchema, type OfferAcceptInput } from '@valora/contracts';
import { TransactionsService } from "./service.js";

@ApiTags('transactions')
@Controller('offers')
@UseGuards(SessionGuard)
export class OfferAcceptanceController {
  constructor(private readonly transactions: TransactionsService) {}
  @Post(':id/accept') @ApiOperation({ summary: 'Terima revisi final dan reservasi atomik' })
  accept(@Req() req: AppRequest, @Param('id') id: string, @Headers('idempotency-key') key: string | undefined, @Body(new ZodPipe(offerAcceptSchema)) input: OfferAcceptInput) { return this.transactions.accept(req.actor!.id, id, input, key); }
}
