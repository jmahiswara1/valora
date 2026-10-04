import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Controller, UseGuards, Get, Req, Post, Param } from '@nestjs/common';
import { SessionGuard } from '../auth/guards.js';
import { DatabaseService } from '../../infrastructure/database.service.js';
import { type AppRequest, AppException } from '../../shared/http.js';
import { validId } from '../../shared/transactions.js';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(SessionGuard)
export class NotificationsController {
  constructor(private readonly db: DatabaseService) {}
  @Get() @ApiOperation({ summary: 'Pengingat dalam aplikasi untuk akun sendiri' })
  async list(@Req() req: AppRequest) { return this.db.inAppNotification.findMany({ where: { userId: req.actor!.id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 50 }); }
  @Post(':id/read') @ApiOperation({ summary: 'Tandai notifikasi sendiri sudah dibaca' })
  async read(@Req() req: AppRequest, @Param('id') id: string) { validId(id); const changed = await this.db.inAppNotification.updateMany({ where: { id, userId: req.actor!.id }, data: { readAt: new Date() } }); if (!changed.count) throw new AppException(404, 'NOT_FOUND', 'Notifikasi tidak ditemukan.'); return { read: true }; }
}
