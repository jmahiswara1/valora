import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Controller, Get, Query } from '@nestjs/common';
import type { CityDto, CategoryDto } from '@valora/contracts';
import { CatalogService } from "./service.js";

@ApiTags('catalog')
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('cities')
  @ApiOperation({ summary: 'Cari seluruh kabupaten/kota Indonesia untuk profil' })
  async cities(@Query('q') query?: string): Promise<{ data: CityDto[]; meta: { nextCursor: null } }> {
    return { data: await this.catalog.cities((query ?? '').trim().slice(0, 120)), meta: { nextCursor: null } };
  }

  @Get('categories')
  @ApiOperation({ summary: 'Kategori dan subkategori Item aktif' })
  categories(): Promise<CategoryDto[]> { return this.catalog.categories(); }
}
