import { Body, Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { reviewCreateSchema, reviewReplySchema, reviewVisibilitySchema, type ReviewCreateInput, type ReviewReplyInput, type ReviewVisibilityInput } from '@valora/contracts';
import { SessionGuard, AdminGuard } from '../auth/guards.js';
import { type AppRequest, ZodPipe } from '../../shared/http.js';
import { ReviewsService } from './service.js';

@ApiTags('reviews')
@Controller()
@UseGuards(SessionGuard)
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}
  @Get('transactions/:id/reviews') get(@Req() req: AppRequest, @Param('id') id: string) { return this.reviews.transaction(req.actor!.id, id); }
  @Post('transactions/:id/reviews') create(@Req() req: AppRequest, @Param('id') id: string, @Body(new ZodPipe(reviewCreateSchema)) input: ReviewCreateInput, @Headers('idempotency-key') key?: string) { return this.reviews.create(req.actor!.id, id, input, key); }
  @Post('reviews/:id/reply') reply(@Req() req: AppRequest, @Param('id') id: string, @Body(new ZodPipe(reviewReplySchema)) input: ReviewReplyInput, @Headers('idempotency-key') key?: string) { return this.reviews.reply(req.actor!.id, id, input, key); }
  @Post('admin/reviews/:id/visibility') @UseGuards(AdminGuard) visibility(@Req() req: AppRequest, @Param('id') id: string, @Body(new ZodPipe(reviewVisibilitySchema)) input: ReviewVisibilityInput, @Headers('idempotency-key') key?: string) { return this.reviews.visibility(req.actor!.id, id, 'REVIEW', input, key); }
  @Post('admin/review-replies/:id/visibility') @UseGuards(AdminGuard) replyVisibility(@Req() req: AppRequest, @Param('id') id: string, @Body(new ZodPipe(reviewVisibilitySchema)) input: ReviewVisibilityInput, @Headers('idempotency-key') key?: string) { return this.reviews.visibility(req.actor!.id, id, 'REVIEW_REPLY', input, key); }
}
