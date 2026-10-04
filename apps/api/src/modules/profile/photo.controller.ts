import { Controller, Delete, Get, Param, Post, Put, Req, Res, UseGuards } from '@nestjs/common';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { UserDto } from '@valora/contracts';
import { AuthService } from "../auth/service.js";
import { SessionGuard } from '../auth/guards.js';
import { AppException, type AppRequest } from '../../shared/http.js';
import { ProfilePhotoService } from './photo.service.js';

@ApiTags('profile photos')
@Controller()
export class ProfilePhotosController {
  constructor(private readonly photos: ProfilePhotoService, private readonly auth: AuthService) {}

  @Put('me/profile-photo')
  @UseGuards(SessionGuard)
  @ApiConsumes('image/webp')
  @ApiOperation({ summary: 'Simpan foto profil hasil crop 512 × 512' })
  async upload(@Req() request: AppRequest): Promise<UserDto> {
    if (!Buffer.isBuffer(request.body)) throw new AppException(400, 'INVALID_INPUT', 'Kirim foto hasil crop sebagai image/webp.');
    await this.photos.replace(request.actor!.id, request.body);
    return this.auth.publicUser(request.actor!.id);
  }

  @Delete('me/profile-photo')
  @UseGuards(SessionGuard)
  @ApiOperation({ summary: 'Hapus foto profil sendiri' })
  async remove(@Req() request: AppRequest): Promise<UserDto> {
    await this.photos.remove(request.actor!.id);
    return this.auth.publicUser(request.actor!.id);
  }

  @Post('me/profile-photo/migrate')
  @UseGuards(SessionGuard)
  @ApiOperation({ summary: 'Migrasikan foto lokal ke Cloudinary setelah key tersedia' })
  async migrate(@Req() request: AppRequest): Promise<UserDto> {
    await this.photos.migrateLocalPhoto(request.actor!.id);
    return this.auth.publicUser(request.actor!.id);
  }

  @Get('users/:id/profile-photo')
  @UseGuards(SessionGuard)
  @ApiOperation({ summary: 'Baca foto lokal sendiri atau peserta percakapan' })
  async localImage(@Req() request: AppRequest, @Param('id') id: string, @Res() response: Response): Promise<void> {
    const image = await this.photos.localImageForViewer(request.actor!.id, id);
    response.status(200).set({ 'Content-Type': 'image/webp', 'Content-Length': String(image.length), 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }).send(image);
  }
}
