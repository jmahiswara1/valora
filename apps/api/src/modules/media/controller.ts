import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Controller, UseGuards, Post, Req, Body, Put, Param, Get, Query, Res } from '@nestjs/common';
import { SessionGuard } from '../auth/guards.js';
import { type AppRequest, ZodPipe } from '../../shared/http.js';
import { mediaTicketSchema, type MediaTicketInput } from '@valora/contracts';
import type { Response } from 'express';
import { MediaService } from "./service.js";

@ApiTags('media')
@Controller('media')
@UseGuards(SessionGuard)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('tickets')
  @ApiOperation({ summary: 'Buat tiket foto awal sebelum Item tersimpan' })
  ticket(@Req() request: AppRequest, @Body(new ZodPipe(mediaTicketSchema)) input: MediaTicketInput): Promise<{ ticketId: string; uploadUrl: string; expiresAt: string }> {
    return this.media.ticket(request.actor!.id, input);
  }

  @Put('uploads/:ticketId')
  @ApiOperation({ summary: 'Unggah dan validasi foto sesuai tiket' })
  upload(@Req() request: AppRequest, @Param('ticketId') ticketId: string): Promise<{ ticketId: string; mime: 'image/webp'; bytes: number }> {
    return this.media.upload(request.actor!.id, ticketId, request.body, request.headers['content-type']);
  }

  @Get(':mediaId/access')
  @ApiOperation({ summary: 'Minta URL singkat untuk foto Item privat milik sendiri' })
  access(@Req() request: AppRequest, @Param('mediaId') mediaId: string): Promise<{ url: string; expiresAt: string }> {
    return this.media.access(request.actor!.id, mediaId);
  }

  @Get('private/:mediaId')
  @ApiOperation({ summary: 'Baca foto privat dengan sesi dan URL bertanda tangan' })
  privatePhoto(@Req() request: AppRequest, @Param('mediaId') mediaId: string, @Query('expires') expires: string, @Query('signature') signature: string, @Res() response: Response): Promise<void> {
    return this.media.privatePhoto(request.actor!.id, mediaId, expires, signature, response);
  }
}
