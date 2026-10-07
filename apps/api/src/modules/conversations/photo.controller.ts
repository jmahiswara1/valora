import { Controller, UseGuards, Get, Param, Query, Req, Res } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Response } from 'express';
import { messagePhotoScopeSchema } from '@valora/contracts';
import { SessionGuard } from '../auth/guards.js';
import { type AppRequest, ZodPipe } from '../../shared/http.js';
import type { MessagePhotoScope } from '@valora/contracts';
import { MessagePhotosService } from './photo.service.js';

@ApiTags('conversations')
@Controller('message-photos')
@UseGuards(SessionGuard)
export class MessagePhotosController {
  constructor(private readonly photos: MessagePhotosService) {}
  @Get(':id/access') @ApiOperation({ summary: 'URL foto pesan privat dengan sesi dan lingkup kasus' })
  access(@Req() req: AppRequest, @Param('id') id: string, @Query(new ZodPipe(messagePhotoScopeSchema)) scope: MessagePhotoScope) { return this.photos.access(req.actor!.id, req.actor!.sessionId, id, scope); }
  @Get('private/:id') @ApiOperation({ summary: 'Baca foto pesan dengan otorisasi ulang dan URL lima menit' })
  photo(@Req() req: AppRequest, @Param('id') id: string, @Query('expires') expires: string, @Query('signature') signature: string, @Query(new ZodPipe(messagePhotoScopeSchema)) scope: MessagePhotoScope, @Res() res: Response) { return this.photos.privatePhoto(req.actor!.id, req.actor!.sessionId, id, expires, signature, scope, res); }
}
