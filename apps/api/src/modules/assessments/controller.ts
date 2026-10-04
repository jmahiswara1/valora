import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Controller, UseGuards, Get, Req, Param } from '@nestjs/common';
import { SessionGuard } from '../auth/guards.js';
import type { AppRequest } from '../../shared/http.js';
import type { AssessmentDto } from '@valora/contracts';
import { AssessmentsService } from "./service.js";

@ApiTags('assessments')
@Controller('assessments')
@UseGuards(SessionGuard)
export class AssessmentsController {
  constructor(private readonly assessments: AssessmentsService) {}
  @Get(':id')
  @ApiOperation({ summary: 'Detail snapshot penilaian dengan proyeksi privasi' })
  get(@Req() request: AppRequest, @Param('id') id: string): Promise<AssessmentDto> { return this.assessments.get(request.actor!.id, id); }
}
