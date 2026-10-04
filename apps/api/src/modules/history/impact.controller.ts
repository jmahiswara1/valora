import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, Query, UseGuards, Req, Param } from '@nestjs/common';
import { SessionGuard } from '../auth/guards.js';
import type { AppRequest } from '../../shared/http.js';
import { PassportImpactService } from './projection.service.js';

@ApiTags('passport-impact')
@Controller()
export class ImpactController {
  constructor(private readonly service: PassportImpactService) {}
  @Get('impact/public') public(@Query('from') from?: string, @Query('to') to?: string) { return this.service.impact(undefined, from, to); }
  @Get('me/impact') @UseGuards(SessionGuard) me(@Req() req: AppRequest, @Query('from') from?: string, @Query('to') to?: string) { return this.service.impact(req.actor!.id, from, to); }
  @Get('items/:id/passport') @UseGuards(SessionGuard) owner(@Req() req: AppRequest, @Param('id') id: string) { return this.service.passport(id, req.actor!.id); }
}
