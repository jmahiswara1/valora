import { Controller, Get, Post, Body, Query, Param, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { notificationsQuerySchema, notificationReadSchema, type NotificationsQuery } from '@valora/contracts';
import { SessionGuard } from '../auth/guards.js';
import { ZodPipe, type AppRequest } from '../../shared/http.js';
import { NotificationService } from './service.js';

@ApiTags('notifications')
@Controller('me/notifications')
@UseGuards(SessionGuard)
export class NotificationCenterController {
  constructor(private readonly notifications: NotificationService) {}
  @Get() @ApiOperation({ summary: 'Pusat notifikasi privat dengan filter dan pagination' })
  list(@Req() req: AppRequest, @Query(new ZodPipe(notificationsQuerySchema)) query: NotificationsQuery) { return this.notifications.list(req.actor!.id, query); }
  @Get('summary') @ApiOperation({ summary: 'Jumlah belum dibaca dan lima aktivitas terbaru' })
  summary(@Req() req: AppRequest) { return this.notifications.summary(req.actor!.id); }
  @Post('read-all') @ApiOperation({ summary: 'Tandai seluruh notifikasi sendiri sudah dibaca' })
  readAll(@Req() req: AppRequest) { return this.notifications.readAll(req.actor!.id); }
  @Post(':id/read') @ApiOperation({ summary: 'Tandai notifikasi sendiri dibaca secara idempoten' })
  read(@Req() req: AppRequest, @Param('id') id: string, @Body(new ZodPipe(notificationReadSchema)) input: { throughSequence?: number }) { return this.notifications.read(req.actor!.id, id, input.throughSequence); }
}
