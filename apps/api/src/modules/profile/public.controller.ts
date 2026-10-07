import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { PublicProfilesService } from './public.service.js';
import { ProfilePhotoService } from './photo.service.js';

@ApiTags('public profiles')
@Controller('profiles')
export class PublicProfilesController {
  constructor(private readonly profiles: PublicProfilesService, private readonly photos: ProfilePhotoService) {}
  @Get(':id') get(@Param('id') id: string) { return this.profiles.get(id); }
  @Get(':id/listings') listings(@Param('id') id: string, @Query('cursor') cursor?: string) { return this.profiles.listings(id, cursor); }
  @Get(':id/reviews') reviews(@Param('id') id: string, @Query('cursor') cursor?: string) { return this.profiles.reviews(id, cursor); }
  @Get(':id/photo') async photo(@Param('id') id: string, @Res() response: Response) { const bytes = await this.photos.publicImage(id); response.set({ 'Content-Type': 'image/webp', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }).send(bytes); }
}
