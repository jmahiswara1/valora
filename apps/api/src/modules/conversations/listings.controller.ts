import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Controller, UseGuards, Post, Req, Param } from '@nestjs/common';
import { SessionGuard } from '../auth/guards.js';
import type { AppRequest } from '../../shared/http.js';
import { ConversationsService } from "./service.js";

@ApiTags('conversations')
@Controller('listings/:listingId/conversations')
@UseGuards(SessionGuard)
export class ListingConversationsController {
  constructor(private readonly conversations: ConversationsService) {}
  @Post()
  @ApiOperation({ summary: 'Mulai atau buka percakapan dengan pemilik Listing' })
  open(@Req() request: AppRequest, @Param('listingId') listingId: string) { return this.conversations.open(request.actor!.id, listingId); }
}
