import { z } from 'zod';
import { versionReasonSchema } from './common.js';

export interface CityDto { id: string; code: string; name: string; provinceName: string }

export interface CategoryDto { code: string; name: string; subcategories: { code: string; name: string }[] }

export const categoryAdminSchema = versionReasonSchema.omit({ expectedVersion: true }).extend({ expectedUpdatedAt: z.iso.datetime(), name: z.string().trim().min(2).max(120), active: z.boolean() });
