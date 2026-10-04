import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Controller, UseGuards, Get, Req, Query } from '@nestjs/common';
import { SessionGuard } from '../auth/guards.js';
import { type AppRequest, ZodPipe } from '../../shared/http.js';
import { listPageSchema } from '@valora/contracts';
import { TransactionsService } from "./service.js";
import type { PageQuery } from './shared.js';

@ApiTags('transactions')
@Controller('me/transactions')
@UseGuards(SessionGuard)
export class MyTransactionsController {
  constructor(private readonly transactions: TransactionsService) {}
  @Get() @ApiOperation({ summary: 'Daftar transaksi dengan filter status dan cursor' })
  list(@Req() req: AppRequest, @Query(new ZodPipe(listPageSchema)) query: PageQuery) { return this.transactions.list(req.actor!.id, query); }
}
