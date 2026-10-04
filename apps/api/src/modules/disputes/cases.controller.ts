import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Controller, UseGuards, Get, Req, Param, Post, Headers, Body } from '@nestjs/common';
import { SessionGuard } from '../auth/guards.js';
import { type AppRequest, ZodPipe } from '../../shared/http.js';
import { evidenceSchema, type EvidenceInput, caseMediaTicketSchema, type MediaTicketInput } from '@valora/contracts';
import { DisputesService } from "./service.js";

@ApiTags('cases') @Controller('cases') @UseGuards(SessionGuard)
export class CasesController {
  constructor(private readonly cases: DisputesService) {}
  @Get(':id') @ApiOperation({ summary: 'Kasus dan bukti hanya bagi peserta' })
  get(@Req() req: AppRequest, @Param('id') id: string) { return this.cases.get(req.actor!.id, id); }
  @Post(':id/evidence') @ApiOperation({ summary: 'Tambahkan catatan, pesan terkait, dan foto privat' })
  evidence(@Req() req: AppRequest, @Param('id') id: string, @Headers('idempotency-key') key: string | undefined, @Body(new ZodPipe(evidenceSchema)) input: EvidenceInput) { return this.cases.evidence(req.actor!.id, id, input, key); }
  @Post(':id/media/tickets') @ApiOperation({ summary: 'Tiket foto bukti khusus kasus' })
  ticket(@Req() req: AppRequest, @Param('id') id: string, @Body(new ZodPipe(caseMediaTicketSchema)) input: MediaTicketInput) { return this.cases.ticket(req.actor!.id, id, input); }
}
