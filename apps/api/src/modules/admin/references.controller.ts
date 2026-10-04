import { ApiTags } from '@nestjs/swagger';
import { Controller, Get, Param } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database.service.js';

@ApiTags('catalog') @Controller('categories')
export class EconomicReferenceController {
  constructor(private readonly db: DatabaseService) {}
  @Get(':code/economic-references') async references(@Param('code') code: string) { return (await this.db.economicReference.findMany({ where: { categoryCode: code, active: true }, orderBy: { createdAt: 'desc' } })).map((r) => ({ id: r.id, field: r.field, amountIdr: r.amountIdr.toString(), sourceNote: r.sourceNote, referenceDate: r.referenceDate.toISOString().slice(0, 10), region: r.region })); }
}
