import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Controller, Get, Query, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { MarketService } from './market.service.js';
import type { MarketFilters } from './shared.js';

@ApiTags('market')
@Controller('market')
export class MarketController {
  constructor(private readonly market: MarketService) {}
  @Get()
  @ApiOperation({ summary: 'Cari Listing aktif yang boleh dilihat publik' })
  list(@Query() filters: MarketFilters) { return this.market.list(filters); }
  @Get(':listingId/media/:mediaId')
  @ApiOperation({ summary: 'Baca foto hanya selama termasuk revisi Listing aktif' })
  photo(@Param('listingId') listingId: string, @Param('mediaId') mediaId: string, @Res() response: Response): Promise<void> { return this.market.publicPhoto(listingId, mediaId, response); }
  @Get(':listingId')
  @ApiOperation({ summary: 'Detail Listing aktif atau status terbatas saat reserved' })
  get(@Param('listingId') id: string) { return this.market.getPublic(id); }
}
