import { Controller, Get, Put, Delete, UseGuards, Req, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { favoritesQuerySchema, favoriteStatusQuerySchema, type FavoritesQuery } from '@valora/contracts';
import { SessionGuard } from '../auth/guards.js';
import { ZodPipe, type AppRequest } from '../../shared/http.js';
import { FavoritesService } from './service.js';

@ApiTags('favorites')
@Controller('me/favorites')
@UseGuards(SessionGuard)
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: 'Daftar Favorit privat akun dengan proyeksi publik terkini' })
  list(@Req() request: AppRequest, @Query(new ZodPipe(favoritesQuerySchema)) input: FavoritesQuery) {
    return this.favorites.list(request.actor!.id, input);
  }

  @Get('status')
  @ApiOperation({ summary: 'Status Favorit untuk paling banyak 100 Listing unik' })
  status(@Req() request: AppRequest, @Query(new ZodPipe(favoriteStatusQuerySchema)) input: { listingIds: string[] }) {
    return this.favorites.status(request.actor!.id, input.listingIds);
  }

  @Put(':listingId')
  @ApiOperation({ summary: 'Simpan Listing aktif ke Favorit secara idempoten' })
  save(@Req() request: AppRequest, @Param('listingId') listingId: string) {
    return this.favorites.save(request.actor!.id, listingId);
  }

  @Delete(':listingId')
  @ApiOperation({ summary: 'Hapus Favorit milik akun secara idempoten' })
  remove(@Req() request: AppRequest, @Param('listingId') listingId: string) {
    return this.favorites.remove(request.actor!.id, listingId);
  }
}
