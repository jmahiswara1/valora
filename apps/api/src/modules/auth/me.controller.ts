import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Controller, UseGuards, Get, Req, Query, Delete, Param, Post, Body, Patch, Res } from '@nestjs/common';
import { type AppRequest, ZodPipe } from '../../shared/http.js';
import { actionStatusSchema, type UserDto, profilePatchSchema, passwordChangeSchema, accountCloseSchema } from '@valora/contracts';
import type { Response } from 'express';
import { cookieSecure } from '../../infrastructure/config.js';
import { SessionGuard } from './guards.js';
import { AuthService } from "./service.js";
import { sessionCookie } from './shared.js';

@ApiTags('me')
@Controller('me')
@UseGuards(SessionGuard)
export class MeController {
  constructor(private readonly auth: AuthService) {}

  @Get('sessions')
  sessions(@Req() r: AppRequest, @Query('cursor') cursor?: string) { return this.auth.sessions(r.actor!.id, r.actor!.sessionId, cursor); }
  @Delete('sessions/:id')
  revoke(@Req() r: AppRequest, @Param('id') id: string) { return this.auth.revoke(r.actor!.id, r.actor!.sessionId, id); }
  @Post('sessions/revoke-others')
  revokeOthers(@Req() r: AppRequest) { return this.auth.revoke(r.actor!.id, r.actor!.sessionId); }
  @Post('actions/status')
  actionStatus(@Req() r: AppRequest, @Body(new ZodPipe(actionStatusSchema)) input: { operation: string; key: string }) { return this.auth.actionStatus(r.actor!.id, input.operation, input.key); }

  @Get()
  @ApiOperation({ summary: 'Baca profil akun sendiri' })
  me(@Req() request: AppRequest): Promise<UserDto> { return this.auth.publicUser(request.actor!.id); }

  @Patch()
  @ApiOperation({ summary: 'Ubah profil sendiri; perubahan email memerlukan verifikasi' })
  patch(@Req() request: AppRequest, @Body(new ZodPipe(profilePatchSchema)) input: { displayName?: string; cityId?: string; email?: string; profilePhotoPublic?: boolean }): Promise<UserDto> {
    return this.auth.patchProfile(request.actor!.id, input);
  }

  @Patch('password')
  @ApiOperation({ summary: 'Ubah kata sandi dan cabut sesi lain' })
  password(@Req() request: AppRequest, @Body(new ZodPipe(passwordChangeSchema)) input: { currentPassword: string; newPassword: string }): Promise<{ passwordChanged: true }> {
    return this.auth.changePassword(request.actor!.id, request.actor!.sessionId, input.currentPassword, input.newPassword);
  }

  @Post('close')
  @ApiOperation({ summary: 'Tutup akun dan cabut seluruh sesi' })
  close(@Req() request: AppRequest, @Body(new ZodPipe(accountCloseSchema)) input: { reason?: string }, @Res({ passthrough: true }) response: Response): Promise<{ closedAt: string }> {
    return this.auth.closeAccount(request.actor!.id, input.reason).then((result) => { response.clearCookie(sessionCookie, { httpOnly: true, secure: cookieSecure, sameSite: 'lax', path: '/' }); return result; });
  }
}
