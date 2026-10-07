import { Body, Controller, Get, Headers, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { handoverPageSchema, handoverProposalSchema, handoverResponseSchema, handoverWithdrawSchema, shipmentSchema, type HandoverProposalInput, type HandoverResponseInput, type ShipmentInput } from '@valora/contracts';
import { SessionGuard } from '../auth/guards.js';
import { ZodPipe, type AppRequest } from '../../shared/http.js';
import { HandoverService } from './service.js';

@ApiTags('handover') @Controller('transactions') @UseGuards(SessionGuard)
export class HandoverController {
  constructor(private readonly handover: HandoverService) {}
  @Get(':id/handover') get(@Req() req: AppRequest, @Param('id') id: string) { return this.handover.get(req.actor!.id, id); }
  @Get(':id/handover/proposals/:proposalId') proposal(@Req() req: AppRequest, @Param('id') id: string, @Param('proposalId') proposalId: string) { return this.handover.proposal(req.actor!.id, id, proposalId); }
  @Get(':id/handover/proposals/:proposalId/shipments') shipments(@Req() req: AppRequest, @Param('id') id: string, @Param('proposalId') proposalId: string, @Query(new ZodPipe(handoverPageSchema)) query: { limit: number; cursor?: string }) { return this.handover.shipments(req.actor!.id, id, proposalId, query); }
  @Post(':id/handover/proposals') propose(@Req() req: AppRequest, @Param('id') id: string, @Headers('idempotency-key') key: string | undefined, @Body(new ZodPipe(handoverProposalSchema)) input: HandoverProposalInput) { return this.handover.propose(req.actor!.id, id, input, key); }
  @Post(':id/handover/proposals/:proposalId/respond') respond(@Req() req: AppRequest, @Param('id') id: string, @Param('proposalId') proposalId: string, @Headers('idempotency-key') key: string | undefined, @Body(new ZodPipe(handoverResponseSchema)) input: HandoverResponseInput) { return this.handover.respond(req.actor!.id, id, proposalId, input, key); }
  @Post(':id/handover/proposals/:proposalId/withdraw') withdraw(@Req() req: AppRequest, @Param('id') id: string, @Param('proposalId') proposalId: string, @Headers('idempotency-key') key: string | undefined, @Body(new ZodPipe(handoverWithdrawSchema)) input: { expectedVersion: number }) { return this.handover.withdraw(req.actor!.id, id, proposalId, input.expectedVersion, key); }
  @Post(':id/handover/shipments/:itemId') shipment(@Req() req: AppRequest, @Param('id') id: string, @Param('itemId') itemId: string, @Headers('idempotency-key') key: string | undefined, @Body(new ZodPipe(shipmentSchema)) input: ShipmentInput) { return this.handover.shipment(req.actor!.id, id, itemId, input, key); }
  @Get(':id/timeline') history(@Req() req: AppRequest, @Param('id') id: string, @Query(new ZodPipe(handoverPageSchema)) query: { limit: number; cursor?: string }) { return this.handover.history(req.actor!.id, id, query); }
}
