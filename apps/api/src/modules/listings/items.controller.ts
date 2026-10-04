import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Controller, UseGuards, Post, Req, Param, Body } from '@nestjs/common';
import { SessionGuard } from '../auth/guards.js';
import { type AppRequest, ZodPipe } from '../../shared/http.js';
import { listingSaveSchema, type ListingSaveInput } from '@valora/contracts';
import { ListingService } from "./service.js";

@ApiTags('listings')
@Controller('items/:itemId/listings')
@UseGuards(SessionGuard)
export class ItemListingsController {
  constructor(private readonly listings: ListingService) {}
  @Post()
  @ApiOperation({ summary: 'Buat draft Listing dari Assessment terkini' })
  create(@Req() request: AppRequest, @Param('itemId') itemId: string, @Body(new ZodPipe(listingSaveSchema)) input: ListingSaveInput) { return this.listings.create(request.actor!.id, itemId, input); }
}
