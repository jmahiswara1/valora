import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Controller, Get, Req, Post, UseGuards, Body, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { type AppRequest, ZodPipe } from '../../shared/http.js';
import { reauthenticateSchema, registerSchema, type RegisterInput, verifyEmailSchema, resetRequestSchema, loginSchema, type LoginInput, type UserDto, resetConfirmSchema } from '@valora/contracts';
import { cookieSecure } from '../../infrastructure/config.js';
import { AuthService } from "./service.js";
import { sessionCookie, randomToken, sevenDays } from './shared.js';
import { SessionGuard } from './guards.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('session')
  session(@Req() r: Request) { return this.auth.session((r.cookies as Record<string, string>)?.[sessionCookie]); }

  @Post('reauthenticate') @UseGuards(SessionGuard)
  reauthenticate(@Req() r: AppRequest, @Body(new ZodPipe(reauthenticateSchema)) input: { password: string }) { return this.auth.reauthenticate(r.actor!.id, r.actor!.sessionId, input.password); }

  @Get('csrf')
  @ApiOperation({ summary: 'Ambil token CSRF untuk mutasi pada origin aplikasi' })
  csrf(@Res({ passthrough: true }) response: Response): { token: string } {
    const token = randomToken();
    response.cookie('valora_csrf', token, { httpOnly: true, secure: cookieSecure, sameSite: 'lax', path: '/', maxAge: sevenDays });
    return { token };
  }

  @Post('register')
  @ApiOperation({ summary: 'Daftar akun pengguna dan kirim verifikasi email' })
  async register(@Body(new ZodPipe(registerSchema)) input: RegisterInput, @Req() request: Request): Promise<{ id: string; email: string; emailVerifiedAt: null }> {
    await this.auth.rateLimit('register:' + request.ip, 10, 60000);
    return this.auth.register(input);
  }

  @Post('verify-email')
  @ApiOperation({ summary: 'Verifikasi email memakai token sekali pakai' })
  verifyEmail(@Body(new ZodPipe(verifyEmailSchema)) input: { token: string }): Promise<{ emailVerifiedAt: string }> { return this.auth.verifyEmail(input.token); }

  @Post('verification/resend')
  @ApiOperation({ summary: 'Kirim ulang tautan verifikasi tanpa mengungkap status akun' })
  async resend(@Body(new ZodPipe(resetRequestSchema)) input: { email: string }, @Req() request: Request): Promise<{ message: string }> {
    await this.auth.rateLimit('resend:' + request.ip, 5, 60000);
    return this.auth.resendVerification(input.email);
  }

  @Post('login')
  @ApiOperation({ summary: 'Masuk dan buat sesi cookie' })
  async login(@Body(new ZodPipe(loginSchema)) input: LoginInput, @Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<UserDto> {
    await this.auth.rateLimit('login:' + request.ip + ':' + input.email, 7, 15 * 60000);
    return this.auth.login(input, response, (request.cookies as Record<string, string>)?.[sessionCookie]);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Cabut sesi saat ini' })
  logout(@Req() request: AppRequest, @Res({ passthrough: true }) response: Response): Promise<{ loggedOut: true }> { return this.auth.logout((request.cookies as Record<string, string>)?.[sessionCookie], response); }

  @Post('password-reset/request')
  @ApiOperation({ summary: 'Minta tautan reset tanpa mengungkap keberadaan akun' })
  async requestReset(@Body(new ZodPipe(resetRequestSchema)) input: { email: string }, @Req() request: Request): Promise<{ message: string }> {
    await this.auth.rateLimit('reset:' + request.ip, 5, 60000);
    return this.auth.requestReset(input.email);
  }

  @Post('password-reset/confirm')
  @ApiOperation({ summary: 'Atur kata sandi baru memakai token sekali pakai' })
  confirmReset(@Body(new ZodPipe(resetConfirmSchema)) input: { token: string; password: string }): Promise<{ passwordChanged: true }> { return this.auth.confirmReset(input.token, input.password); }
}
