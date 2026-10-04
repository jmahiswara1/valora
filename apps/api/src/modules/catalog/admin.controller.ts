import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Controller, UseGuards, Get } from '@nestjs/common';
import { SessionGuard, AdminGuard } from '../auth/guards.js';

@ApiTags('admin')
@Controller('admin')
@UseGuards(SessionGuard, AdminGuard)
export class AdminFoundationController {
  @Get('overview')
  @ApiOperation({ summary: 'Gerbang peran admin untuk operasi Market dan sengketa' })
  overview(): { stage: number; message: string } { return { stage: 5, message: 'Passport, Impact, operasi admin, rubrik, koreksi, dan retensi tersedia.' }; }
}
