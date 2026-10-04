import { ApiTags } from '@nestjs/swagger';
import { Controller, UseGuards, Post, Req, Param } from '@nestjs/common';
import { SessionGuard } from '../auth/guards.js';
import type { AppRequest } from '../../shared/http.js';
import { ExplainerService } from './explainer.service.js';

@ApiTags('explainer') @Controller('assessments') @UseGuards(SessionGuard)
export class ExplainerController {
  constructor(private readonly service: ExplainerService) {}
  @Post(':id/explain') explain(@Req() r: AppRequest, @Param('id') id: string) { return this.service.get(r.actor!.id, id); }
}
