import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Controller, UseGuards, Post, Req, Param, Body, Headers } from '@nestjs/common';
import { SessionGuard } from '../auth/guards.js';
import { type AppRequest, ZodPipe } from '../../shared/http.js';
import { repairCorrectionSchema, type RepairCorrectionInput, type RepairDto, repairVoidSchema, type RepairVoidInput } from '@valora/contracts';
import { RepairsService } from "./service.js";

@ApiTags('repairs')
@Controller('repairs')
@UseGuards(SessionGuard)
export class RepairsController {
  constructor(private readonly repairs: RepairsService) {}
  @Post(':id/corrections')
  @ApiOperation({ summary: 'Koreksi Repair dengan revisi dan alasan' })
  correct(@Req() request: AppRequest, @Param('id') id: string, @Body(new ZodPipe(repairCorrectionSchema)) input: RepairCorrectionInput, @Headers('idempotency-key') idempotencyKey?: string): Promise<RepairDto> { return this.repairs.correct(request.actor!.id, id, input, idempotencyKey); }
  @Post(':id/void')
  @ApiOperation({ summary: 'Batalkan Repair secara logis dengan jejak audit' })
  void(@Req() request: AppRequest, @Param('id') id: string, @Body(new ZodPipe(repairVoidSchema)) input: RepairVoidInput, @Headers('idempotency-key') idempotencyKey?: string): Promise<RepairDto> { return this.repairs.void(request.actor!.id, id, input, idempotencyKey); }
}
