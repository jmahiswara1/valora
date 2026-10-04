import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PassportImpactService } from './projection.service.js';

@ApiTags('passport-impact')
@Controller('passport')
export class PublicPassportController {
  constructor(private readonly service: PassportImpactService) {}
  @Get(':id') get(@Param('id') id: string) { return this.service.passport(id); }
  @Get(':id/media/:mediaId') photo(@Param('id') id: string, @Param('mediaId') mediaId: string, @Res() response: Response) { return this.service.photo(id, mediaId, response); }
}
