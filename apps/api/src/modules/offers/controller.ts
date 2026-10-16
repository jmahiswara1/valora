import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Controller, UseGuards, Get, Req, Param, Post, Body, Query } from '@nestjs/common';
import { SessionGuard } from '../auth/guards.js';
import { type AppRequest, ZodPipe } from '../../shared/http.js';
import { offerCounterSchema, type OfferCounterInput, offerDecisionSchema, listPageSchema } from '@valora/contracts';
import { OffersService } from "./service.js";

@ApiTags('offers')
@Controller('offers')
@UseGuards(SessionGuard)
export class OffersController {
  constructor(private readonly offers: OffersService) {}
  @Get('mine')
  @ApiOperation({ summary: 'Daftar Offer sebagai penawar atau pemilik Listing' })
  mine(@Req() request: AppRequest) { return this.offers.listMine(request.actor!.id); }
  @Get(':id/revisions')
  history(@Req() request: AppRequest, @Param('id') id: string, @Query(new ZodPipe(listPageSchema)) query: { limit: number; cursor?: string }) { return this.offers.history(request.actor!.id, id, query.limit, query.cursor); }
  @Get(':id')
  @ApiOperation({ summary: 'Detail Offer hanya untuk kedua pihak' })
  get(@Req() request: AppRequest, @Param('id') id: string) { return this.offers.get(request.actor!.id, id); }
  @Post(':id/counter')
  @ApiOperation({ summary: 'Buat Counteroffer Resell atau paket Exchange dan tenggat baru' })
  counter(@Req() request: AppRequest, @Param('id') id: string, @Body(new ZodPipe(offerCounterSchema)) input: OfferCounterInput) { return this.offers.counter(request.actor!.id, id, input); }
  @Post(':id/reject')
  @ApiOperation({ summary: 'Tolak Offer yang sedang menunggu respons aktor' })
  reject(@Req() request: AppRequest, @Param('id') id: string, @Body(new ZodPipe(offerDecisionSchema)) input: { expectedVersion: number }) { return this.offers.reject(request.actor!.id, id, input.expectedVersion); }
  @Post(':id/withdraw')
  @ApiOperation({ summary: 'Tarik Offer sendiri sebelum berakhir' })
  withdraw(@Req() request: AppRequest, @Param('id') id: string, @Body(new ZodPipe(offerDecisionSchema)) input: { expectedVersion: number }) { return this.offers.withdraw(request.actor!.id, id, input.expectedVersion); }
}
