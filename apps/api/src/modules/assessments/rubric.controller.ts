import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Controller, Get, Param, Query } from '@nestjs/common';
import type { RubricDto } from '@valora/contracts';
import { AssessmentsService } from "./service.js";

@ApiTags('assessments')
@Controller('categories')
export class RubricController {
  constructor(private readonly assessments: AssessmentsService) {}
  @Get(':code/rubric')
  @ApiOperation({ summary: 'Rubrik aktif kategori dan subkategori' })
  get(@Param('code') code: string, @Query('subcategoryCode') subcategoryCode?: string): Promise<RubricDto> { return this.assessments.rubric(code, subcategoryCode); }
}
