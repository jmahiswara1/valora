import { Controller, Get, Post, Patch, Delete, UseGuards, Req, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { savedSearchCreateSchema, savedSearchUpdateSchema, type SavedSearchCreateInput, type SavedSearchUpdateInput } from '@valora/contracts';
import { SessionGuard } from '../auth/guards.js';
import { ZodPipe, type AppRequest } from '../../shared/http.js';
import { SearchesService } from './service.js';

@ApiTags('saved-searches')
@Controller('me/saved-searches')
@UseGuards(SessionGuard)
export class SearchesController {
  constructor(private readonly searches: SearchesService) {}
  @Get() @ApiOperation({ summary: 'Pencarian tersimpan privat akun' })
  list(@Req() req: AppRequest) { return this.searches.list(req.actor!.id); }
  @Post() @ApiOperation({ summary: 'Simpan kriteria Market secara idempoten' })
  create(@Req() req: AppRequest, @Body(new ZodPipe(savedSearchCreateSchema)) input: SavedSearchCreateInput) { return this.searches.create(req.actor!.id, input); }
  @Patch(':id') @ApiOperation({ summary: 'Ubah nama atau notifikasi pencarian tersimpan' })
  update(@Req() req: AppRequest, @Param('id') id: string, @Body(new ZodPipe(savedSearchUpdateSchema)) input: SavedSearchUpdateInput) { return this.searches.update(req.actor!.id, id, input); }
  @Delete(':id') @ApiOperation({ summary: 'Hapus pencarian milik akun secara idempoten' })
  remove(@Req() req: AppRequest, @Param('id') id: string) { return this.searches.remove(req.actor!.id, id); }
}
