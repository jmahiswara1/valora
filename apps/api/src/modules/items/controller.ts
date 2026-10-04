import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Controller, UseGuards, Get, Req, Query, Post, Body, Param, Patch, Delete } from '@nestjs/common';
import { SessionGuard } from '../auth/guards.js';
import { MediaService } from "../media/service.js";
import { type AppRequest, ZodPipe } from '../../shared/http.js';
import { type ItemDto, itemCreateSchema, type ItemCreateInput, itemPatchSchema, type ItemPatchInput, mediaTicketSchema, type MediaTicketInput, mediaFinalizeSchema } from '@valora/contracts';
import { ItemsService } from "./service.js";

@ApiTags('items')
@Controller('items')
@UseGuards(SessionGuard)
export class ItemsController {
  constructor(private readonly items: ItemsService, private readonly media: MediaService) {}

  @Get()
  @ApiOperation({ summary: 'Daftar Item privat milik sendiri' })
  list(@Req() request: AppRequest, @Query('limit') limit?: string, @Query('cursor') cursor?: string): Promise<{ data: ItemDto[]; meta: { nextCursor: string | null } }> {
    return this.items.list(request.actor!.id, limit, cursor);
  }

  @Post()
  @ApiOperation({ summary: 'Buat Item dan finalisasi minimal satu foto valid secara atomik' })
  create(@Req() request: AppRequest, @Body(new ZodPipe(itemCreateSchema)) input: ItemCreateInput): Promise<ItemDto> { return this.items.create(request.actor!.id, input); }

  @Get(':id')
  @ApiOperation({ summary: 'Detail Item privat milik sendiri' })
  get(@Req() request: AppRequest, @Param('id') id: string): Promise<ItemDto> { return this.items.get(request.actor!.id, id); }

  @Patch(':id')
  @ApiOperation({ summary: 'Ubah Item dengan pemeriksaan versi dan owner' })
  patch(@Req() request: AppRequest, @Param('id') id: string, @Body(new ZodPipe(itemPatchSchema)) input: ItemPatchInput): Promise<ItemDto> { return this.items.patch(request.actor!.id, id, input); }

  @Post(':id/media/tickets')
  @ApiOperation({ summary: 'Buat tiket unggah foto tambahan untuk Item milik sendiri' })
  ticket(@Req() request: AppRequest, @Param('id') id: string, @Body(new ZodPipe(mediaTicketSchema)) input: MediaTicketInput): Promise<{ ticketId: string; uploadUrl: string; expiresAt: string }> {
    return this.media.ticket(request.actor!.id, input, id);
  }

  @Post(':id/media/finalize')
  @ApiOperation({ summary: 'Tautkan foto tambahan yang sudah diproses' })
  finalize(@Req() request: AppRequest, @Param('id') id: string, @Body(new ZodPipe(mediaFinalizeSchema)) input: { ticketId: string }): Promise<ItemDto> {
    return this.items.finalizeMedia(request.actor!.id, id, input.ticketId);
  }

  @Delete(':id/media/:mediaId')
  @ApiOperation({ summary: 'Hapus foto Item milik sendiri selama masih ada foto lain' })
  deleteMedia(@Req() request: AppRequest, @Param('id') id: string, @Param('mediaId') mediaId: string): Promise<ItemDto> {
    return this.items.deleteMedia(request.actor!.id, id, mediaId);
  }
}
