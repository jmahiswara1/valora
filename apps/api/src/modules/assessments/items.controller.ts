import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Controller, UseGuards, Post, Req, Param, Body, Get, Query } from '@nestjs/common';
import { SessionGuard } from '../auth/guards.js';
import { type AppRequest, ZodPipe } from '../../shared/http.js';
import { assessmentCreateSchema, type AssessmentCreateInput, type AssessmentDto } from '@valora/contracts';
import { AssessmentsService } from "./service.js";

@ApiTags('assessments')
@Controller('items/:itemId/assessments')
@UseGuards(SessionGuard)
export class ItemAssessmentsController {
  constructor(private readonly assessments: AssessmentsService) {}
  @Post()
  @ApiOperation({ summary: 'Simpan snapshot penilaian berdasarkan rubrik aktif' })
  create(@Req() request: AppRequest, @Param('itemId') itemId: string, @Body(new ZodPipe(assessmentCreateSchema)) input: AssessmentCreateInput): Promise<AssessmentDto> { return this.assessments.create(request.actor!.id, itemId, input); }
  @Get()
  @ApiOperation({ summary: 'Riwayat penilaian Item milik sendiri' })
  list(@Req() request: AppRequest, @Param('itemId') itemId: string, @Query('limit') limit?: string, @Query('cursor') cursor?: string): Promise<{ data: AssessmentDto[]; meta: { nextCursor: string | null } }> { return this.assessments.list(request.actor!.id, itemId, limit, cursor); }
}
