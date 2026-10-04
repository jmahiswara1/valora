import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Controller, UseGuards, Post, Req, Body, Delete, Param } from '@nestjs/common';
import { SessionGuard } from '../auth/guards.js';
import { DatabaseService } from '../../infrastructure/database.service.js';
import { type AppRequest, ZodPipe, AppException } from '../../shared/http.js';
import { blockUserSchema } from '@valora/contracts';
import { serial } from '../../shared/transactions.js';

@ApiTags('reports-blocks')
@Controller('blocks')
@UseGuards(SessionGuard)
export class BlocksController {
  constructor(private readonly db: DatabaseService) {}
  @Post()
  @ApiOperation({ summary: 'Blokir akun agar pesan baru tidak dapat dikirim' })
  async block(@Req() request: AppRequest, @Body(new ZodPipe(blockUserSchema)) input: { userId: string }) {
    const userId = request.actor!.id;
    if (input.userId === userId) throw new AppException(400, 'INVALID_INPUT', 'Akun sendiri tidak dapat diblokir.');
    if (!await this.db.user.findUnique({ where: { id: input.userId }, select: { id: true } })) throw new AppException(404, 'NOT_FOUND', 'Akun tidak ditemukan.');
    await serial(this.db, (tx) => tx.userBlock.upsert({ where: { blockerId_blockedId: { blockerId: userId, blockedId: input.userId } }, create: { blockerId: userId, blockedId: input.userId }, update: { revokedAt: null } }));
    return { blocked: true };
  }
  @Delete(':userId')
  @ApiOperation({ summary: 'Cabut blokir akun' })
  async unblock(@Req() request: AppRequest, @Param('userId') targetId: string) {
    await serial(this.db, (tx) => tx.userBlock.updateMany({ where: { blockerId: request.actor!.id, blockedId: targetId, revokedAt: null }, data: { revokedAt: new Date() } }));
    return { blocked: false };
  }
}
