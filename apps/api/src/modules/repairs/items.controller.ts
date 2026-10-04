import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Controller, UseGuards, Post, Req, Param, Body, Get, Query } from '@nestjs/common';
import { SessionGuard } from '../auth/guards.js';
import { type AppRequest, ZodPipe } from '../../shared/http.js';
import { repairCreateSchema, type RepairCreateInput, type RepairDto } from '@valora/contracts';
import { RepairsService } from "./service.js";

@ApiTags('repairs')
@Controller('items/:itemId/repairs')
@UseGuards(SessionGuard)
export class ItemRepairsController {
  constructor(private readonly repairs: RepairsService) {}
  @Post()
  @ApiOperation({ summary: 'Catat Repair dan foto bukti privat' })
  create(@Req() request: AppRequest, @Param('itemId') itemId: string, @Body(new ZodPipe(repairCreateSchema)) input: RepairCreateInput): Promise<RepairDto> { return this.repairs.create(request.actor!.id, itemId, input); }
  @Get()
  @ApiOperation({ summary: 'Riwayat Repair Item dengan proyeksi privat' })
  list(@Req() request: AppRequest, @Param('itemId') itemId: string, @Query('limit') limit?: string, @Query('cursor') cursor?: string): Promise<{ data: RepairDto[]; meta: { nextCursor: string | null } }> { return this.repairs.list(request.actor!.id, itemId, limit, cursor); }
}
