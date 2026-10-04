import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../infrastructure/database.service.js';
import type { CityDto, CategoryDto } from '@valora/contracts';

@Injectable()
export class CatalogService {
  constructor(private readonly db: DatabaseService) {}

  async cities(query: string): Promise<CityDto[]> {
    const cities = await this.db.city.findMany({
      where: { active: true, ...(query ? { OR: [{ name: { contains: query, mode: 'insensitive' } }, { provinceName: { contains: query, mode: 'insensitive' } }] } : {}) },
      orderBy: [{ provinceName: 'asc' }, { name: 'asc' }],
      take: query ? 50 : 514,
    });
    return cities.map(({ id, code, name, provinceName }) => ({ id, code, name, provinceName }));
  }

  async categories(): Promise<CategoryDto[]> {
    const entries = await this.db.category.findMany({ where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
    return entries.filter((entry) => !entry.parentCode).map((entry) => ({
      code: entry.code,
      name: entry.name,
      subcategories: entries.filter((child) => child.parentCode === entry.code).map((child) => ({ code: child.code, name: child.name })),
    }));
  }
}
