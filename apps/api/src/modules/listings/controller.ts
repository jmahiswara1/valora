import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Controller, UseGuards, Get, Req, Param, Patch, Body, Post, Delete } from '@nestjs/common';
import { SessionGuard } from '../auth/guards.js';
import { type AppRequest, ZodPipe } from '../../shared/http.js';
import { listingPatchSchema, type ListingPatchInput, versionActionSchema } from '@valora/contracts';
import { ListingService } from "./service.js";

@ApiTags('listings')
@Controller('listings')
@UseGuards(SessionGuard)
export class ListingsController {
  constructor(private readonly listings: ListingService) {}
  @Delete(':id')
  @ApiOperation({ summary: 'Hapus Listing milik sendiri tanpa menghapus riwayat transaksi' })
  remove(@Req() request: AppRequest, @Param('id') id: string, @Body(new ZodPipe(versionActionSchema)) input: { expectedVersion: number }) { return this.listings.remove(request.actor!.id, id, input.expectedVersion); }
  @Get('mine')
  @ApiOperation({ summary: 'Daftar Listing milik sendiri' })
  mine(@Req() request: AppRequest) { return this.listings.listMine(request.actor!.id); }
  @Get(':id')
  @ApiOperation({ summary: 'Detail privat Listing milik sendiri' })
  get(@Req() request: AppRequest, @Param('id') id: string) { return this.listings.getOwner(request.actor!.id, id); }
  @Patch(':id')
  @ApiOperation({ summary: 'Buat revisi Listing dan jeda penawaran aktif' })
  patch(@Req() request: AppRequest, @Param('id') id: string, @Body(new ZodPipe(listingPatchSchema)) input: ListingPatchInput) { return this.listings.patch(request.actor!.id, id, input); }
  @Post(':id/submit')
  @ApiOperation({ summary: 'Ajukan revisi Listing untuk moderasi' })
  submit(@Req() request: AppRequest, @Param('id') id: string, @Body(new ZodPipe(versionActionSchema)) input: { expectedVersion: number }) { return this.listings.submit(request.actor!.id, id, input.expectedVersion); }
  @Post(':id/withdraw')
  @ApiOperation({ summary: 'Tarik Listing dengan berakhirkan penawaran terbuka' })
  withdraw(@Req() request: AppRequest, @Param('id') id: string, @Body(new ZodPipe(versionActionSchema)) input: { expectedVersion: number }) { return this.listings.withdraw(request.actor!.id, id, input.expectedVersion); }
}
