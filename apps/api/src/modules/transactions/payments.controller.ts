import { Body, Controller, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { demoPaymentSchema, type DemoPaymentInput } from '@valora/contracts';
import { SessionGuard } from '../auth/guards.js';
import { ZodPipe, type AppRequest } from '../../shared/http.js';
import { DemoPaymentsService } from './payments.js';

@ApiTags('demo-payments') @Controller('transactions') @UseGuards(SessionGuard)
export class DemoPaymentsController {
  constructor(private readonly payments: DemoPaymentsService) {}
  @Get(':id/demo-payment') get(@Req() req: AppRequest, @Param('id') id: string) { return this.payments.get(req.actor!.id, id); }
  @Post(':id/demo-payment/confirm') confirm(@Req() req: AppRequest, @Param('id') id: string, @Headers('idempotency-key') key: string | undefined, @Body(new ZodPipe(demoPaymentSchema)) input: DemoPaymentInput) { return this.payments.confirm(req.actor!.id, id, input, key); }
}
