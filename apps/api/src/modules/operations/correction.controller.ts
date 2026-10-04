import { ApiTags } from '@nestjs/swagger';
import { Controller, UseGuards, Post, Req, Param, Body, Headers, Get, Res } from '@nestjs/common';
import { SessionGuard } from '../auth/guards.js';
import { type AppRequest, ZodPipe } from '../../shared/http.js';
import { correctionOpenSchema, caseMediaTicketSchema, type MediaTicketInput, correctionEvidenceSchema } from '@valora/contracts';
import { z } from 'zod';
import type { Response } from 'express';
import { OperationsService } from "./service.js";

@ApiTags('corrections') @Controller() @UseGuards(SessionGuard)
export class CorrectionController {
  constructor(private readonly service: OperationsService) {}
  @Post('transactions/:id/corrections') open(@Req() r: AppRequest, @Param('id') id: string, @Body(new ZodPipe(correctionOpenSchema)) input: z.infer<typeof correctionOpenSchema>, @Headers('idempotency-key') key?: string) { return this.service.open(r.actor!.id, id, input, key); }
  @Get('correction-cases/:id') get(@Req() r: AppRequest, @Param('id') id: string) { return this.service.caseGet(r.actor!.id, id); }
  @Post('correction-cases/:id/media/tickets') ticket(@Req() r: AppRequest, @Param('id') id: string, @Body(new ZodPipe(caseMediaTicketSchema)) input: MediaTicketInput) { return this.service.ticket(r.actor!.id, id, input); }
  @Get('correction-cases/:id/media/:mediaId') photo(@Req() r: AppRequest, @Param('id') id: string, @Param('mediaId') mediaId: string, @Res() response: Response) { return this.service.photo(r.actor!.id, id, mediaId, response); }
  @Post('correction-cases/:id/evidence') evidence(@Req() r: AppRequest, @Param('id') id: string, @Body(new ZodPipe(correctionEvidenceSchema)) input: z.infer<typeof correctionEvidenceSchema>, @Headers('idempotency-key') key?: string) { return this.service.evidence(r.actor!.id, id, input, key); }
}
