import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Controller, UseGuards, Get, Req, Sse, Param, Query, Post, Body } from '@nestjs/common';
import { SessionGuard } from '../auth/guards.js';
import { type AppRequest, ZodPipe } from '../../shared/http.js';
import { conversationMessagesQuerySchema, messageCreateSchema, type MessageCreateInput } from '@valora/contracts';
import { ConversationsService } from "./service.js";

@ApiTags('conversations')
@Controller('conversations')
@UseGuards(SessionGuard)
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}
  @Get()
  @ApiOperation({ summary: 'Daftar percakapan privat dan jumlah pesan belum dibaca' })
  list(@Req() request: AppRequest) { return this.conversations.list(request.actor!.id); }
  @Get('unread-count')
  @ApiOperation({ summary: 'Jumlah pesan belum dibaca pada semua percakapan' })
  unreadCount(@Req() request: AppRequest) { return this.conversations.unreadCount(request.actor!.id); }
  @Sse('stream')
  @ApiOperation({ summary: 'Kanal SSE metadata perubahan percakapan; isi pesan tetap melalui REST' })
  stream(@Req() request: AppRequest) { return this.conversations.stream(request.actor!.id, request.actor!.sessionId); }
  @Get(':id/messages')
  @ApiOperation({ summary: 'Histori pesan privat dengan cursor' })
  history(@Req() request: AppRequest, @Param('id') id: string, @Query(new ZodPipe(conversationMessagesQuerySchema)) query: { before?: string; limit: number }) { return this.conversations.history(request.actor!.id, id, query.before, query.limit); }
  @Post(':id/messages')
  @ApiOperation({ summary: 'Kirim pesan teks dengan clientMessageId idempoten' })
  send(@Req() request: AppRequest, @Param('id') id: string, @Body(new ZodPipe(messageCreateSchema)) input: MessageCreateInput) { return this.conversations.send(request.actor!.id, id, input); }
  @Post(':id/read')
  @ApiOperation({ summary: 'Majukan cursor pesan yang sudah dibaca' })
  read(@Req() request: AppRequest, @Param('id') id: string) { return this.conversations.markRead(request.actor!.id, id); }
}
