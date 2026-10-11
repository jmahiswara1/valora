import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { photoAnalysisInputSchema, type PhotoAnalysisInput } from '@valora/contracts';
import { SessionGuard } from '../auth/guards.js';
import { type AppRequest, ZodPipe } from '../../shared/http.js';
import { PhotoAnalysisService } from './photo-analysis.service.js';

@ApiTags('items') @Controller('items') @UseGuards(SessionGuard)
export class PhotoAnalysisController {
  constructor(private readonly photos: PhotoAnalysisService) {}
  @Post('photo-analysis')
  @ApiOperation({ summary: 'Analisis satu sampai tiga foto barang menjadi saran formulir privat' })
  analyze(@Req() req: AppRequest, @Body(new ZodPipe(photoAnalysisInputSchema)) input: PhotoAnalysisInput) { return this.photos.analyze(req.actor!.id, input); }
}
