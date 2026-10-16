import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Controller, UseGuards, Post, Req, Param, Body, Get, Query } from '@nestjs/common';
import { SessionGuard } from '../auth/guards.js';
import { type AppRequest, ZodPipe } from '../../shared/http.js';
import { listingOfferSchema, type ListingOfferInput } from '@valora/contracts';
import { OffersService } from "./service.js";

@ApiTags('offers')
@Controller('listings')
@UseGuards(SessionGuard)
export class ListingOffersController {
  constructor(private readonly offers: OffersService) {}
  @Get(':listingId/exchange-candidates')
  candidates(@Req() request: AppRequest, @Param('listingId') listingId: string, @Query('limit') limit?: string, @Query('cursor') cursor?: string) { return this.offers.candidates(request.actor!.id, listingId, limit, cursor); }
  @Post(':listingId/offers')
  @ApiOperation({ summary: 'Kirim Offer pada revisi Listing aktif' })
  create(@Req() request: AppRequest, @Param('listingId') listingId: string, @Body(new ZodPipe(listingOfferSchema)) input: ListingOfferInput) { return this.offers.create(request.actor!.id, listingId, input); }
}
