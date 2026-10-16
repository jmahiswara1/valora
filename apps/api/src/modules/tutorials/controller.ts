import { Body, Controller, Delete, Get, Headers, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { tutorialCreateSchema, tutorialActionSchema, tutorialQuestionSchema, tutorialPhotoTicketSchema, tutorialPhotoFinalizeSchema, tutorialRecordSchema, type TutorialCreateInput, type TutorialActionInput, type TutorialQuestionInput, type TutorialPhotoTicketInput, type TutorialPhotoFinalizeInput, type TutorialRecordInput } from '@valora/contracts';
import { SessionGuard } from '../auth/guards.js';
import { ZodPipe, type AppRequest } from '../../shared/http.js';
import { TutorialsService } from './service.js';
import { TutorialPhotosService } from './photos.js';
import { TutorialAiService } from './ai.js';

@ApiTags('repair-tutorials') @Controller() @UseGuards(SessionGuard)
export class TutorialsController {
  constructor(private readonly tutorials: TutorialsService, private readonly photos: TutorialPhotosService, private readonly ai: TutorialAiService) {}
  @Get('repair-guides') @ApiOperation({ summary: 'Katalog panduan bawaan dan status ketersediaan' }) catalog() { return this.tutorials.catalog(); }
  @Get('repair-guides/:guideId') @ApiOperation({ summary: 'Panduan aktif versi terbaru' }) guide(@Param('guideId') id: string) { return this.tutorials.guide(id); }
  @Get('items/:itemId/repair-tutorials') @ApiOperation({ summary: 'Panduan yang sesuai barang milik sendiri' }) available(@Req() req: AppRequest, @Param('itemId') id: string) { return this.tutorials.availability(req.actor!.id, id); }
  @Post('items/:itemId/repair-tutorial-sessions') @ApiOperation({ summary: 'Buat sesi privat dengan snapshot panduan' }) create(@Req() req: AppRequest, @Param('itemId') id: string, @Body(new ZodPipe(tutorialCreateSchema)) input: TutorialCreateInput, @Headers('idempotency-key') key?: string) { return this.tutorials.create(req.actor!.id, id, input, key); }
  @Get('repair-tutorial-sessions/mine') @ApiOperation({ summary: 'Sesi panduan milik akun, aktif atau historis' }) mine(@Req() req: AppRequest, @Query('cursor') cursor?: string, @Query('state') state?: string) { return this.tutorials.mine(req.actor!.id, cursor, state); }
  @Get('repair-tutorial-sessions/:id') @ApiOperation({ summary: 'Detail sesi dan kemampuan terkini' }) detail(@Req() req: AppRequest, @Param('id') id: string) { return this.tutorials.detail(req.actor!.id, id); }
  @Get('repair-tutorial-sessions/:id/start-preview') @ApiOperation({ summary: 'Pratinjau perubahan Market sebelum mulai' }) preview(@Req() req: AppRequest, @Param('id') id: string) { return this.tutorials.startPreview(req.actor!.id, id); }
  @Post('repair-tutorial-sessions/:id/actions') @ApiOperation({ summary: 'Simpan persiapan, progres, jeda atau tutup sesi' }) action(@Req() req: AppRequest, @Param('id') id: string, @Body(new ZodPipe(tutorialActionSchema)) input: TutorialActionInput, @Headers('idempotency-key') key?: string) { return this.tutorials.action(req.actor!.id, id, input, key); }
  @Post('repair-tutorial-sessions/:id/questions') @ApiOperation({ summary: 'Pertanyaan kontekstual AI dengan foto terpilih' }) ask(@Req() req: AppRequest, @Param('id') id: string, @Body(new ZodPipe(tutorialQuestionSchema)) input: TutorialQuestionInput) { return this.ai.ask(req.actor!.id, id, input); }
  @Get('repair-tutorial-sessions/:id/questions') @ApiOperation({ summary: 'Riwayat pertanyaan privat sesi' }) questions(@Req() req: AppRequest, @Param('id') id: string, @Query('cursor') cursor?: string, @Query('stepId') stepId?: string) { return this.ai.history(req.actor!.id, id, cursor, stepId); }
  @Get('repair-tutorial-sessions/:id/questions/by-request/:requestId') @ApiOperation({ summary: 'Pulihkan pertanyaan tanpa pengulangan biaya AI' }) recover(@Req() req: AppRequest, @Param('id') id: string, @Param('requestId') requestId: string) { return this.ai.recover(req.actor!.id, id, requestId); }
  @Post('repair-tutorial-sessions/:id/photos/tickets') @ApiOperation({ summary: 'Tiket foto privat panduan, maksimal 12 foto per sesi' }) ticket(@Req() req: AppRequest, @Param('id') id: string, @Body(new ZodPipe(tutorialPhotoTicketSchema)) input: TutorialPhotoTicketInput) { return this.photos.ticket(req.actor!.id, id, input); }
  @Post('repair-tutorial-sessions/:id/photos/finalize') @ApiOperation({ summary: 'Simpan foto yang telah diproses ke sesi' }) finalize(@Req() req: AppRequest, @Param('id') id: string, @Body(new ZodPipe(tutorialPhotoFinalizeSchema)) input: TutorialPhotoFinalizeInput) { return this.photos.finalize(req.actor!.id, id, input); }
  @Get('repair-tutorial-photos/:id/access') @ApiOperation({ summary: 'Tautan foto privat lima menit, khusus pembuat sesi' }) access(@Req() req: AppRequest, @Param('id') id: string) { return this.photos.access(req.actor!.id, id); }
  @Get('repair-tutorial-photos/:id/private') @ApiOperation({ summary: 'Baca foto panduan dengan otorisasi ulang' }) binary(@Req() req: AppRequest, @Param('id') id: string, @Query('expires') expires: string, @Query('signature') signature: string, @Res() res: Response) { return this.photos.privatePhoto(req.actor!.id, id, expires, signature, res); }
  @Delete('repair-tutorial-photos/:id') @ApiOperation({ summary: 'Hapus foto privat panduan' }) remove(@Req() req: AppRequest, @Param('id') id: string) { return this.photos.remove(req.actor!.id, id); }
  @Post('repair-tutorial-sessions/:id/record') @ApiOperation({ summary: 'Tinjau dan catat satu hasil perawatan atau perbaikan secara atomik' }) record(@Req() req: AppRequest, @Param('id') id: string, @Body(new ZodPipe(tutorialRecordSchema)) input: TutorialRecordInput, @Headers('idempotency-key') key?: string) { return this.tutorials.record(req.actor!.id, id, input, key); }
}
