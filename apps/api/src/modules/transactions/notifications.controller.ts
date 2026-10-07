import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Controller, UseGuards, Get, Req, Post, Param } from '@nestjs/common';
import { SessionGuard } from '../auth/guards.js';
import { DatabaseService } from '../../infrastructure/database.service.js';
import { type AppRequest } from '../../shared/http.js';
import { NotificationService } from '../notifications/service.js';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(SessionGuard)
export class NotificationsController {
  constructor(private readonly db: DatabaseService, private readonly notifications: NotificationService) {}
  @Get() @ApiOperation({ summary: 'Pengingat dalam aplikasi untuk akun sendiri' })
  async list(@Req() req: AppRequest) { return this.db.inAppNotification.findMany({ where: { userId: req.actor!.id, type: 'HANDOVER_REMINDER' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 50 }); }
  @Post(':id/read') @ApiOperation({ summary: 'Tandai notifikasi sendiri sudah dibaca' })
  async read(@Req() req: AppRequest, @Param('id') id: string) { const result = await this.notifications.read(req.actor!.id, id); return { read: result.read }; }
}
