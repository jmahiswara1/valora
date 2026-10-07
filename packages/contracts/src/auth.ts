import { z } from 'zod';
import { uuidSchema } from './common.js';
import type { CityDto } from './catalog.js';

export const emailSchema = z.email().trim().toLowerCase().max(254);

export const passwordSchema = z.string().min(12, 'Kata sandi minimal 12 karakter').max(128);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(2).max(80),
  cityId: uuidSchema,
});

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1) });

export const verifyEmailSchema = z.object({ token: z.string().min(20).max(256) });

export const resetRequestSchema = z.object({ email: emailSchema });

export const resetConfirmSchema = z.object({ token: z.string().min(20).max(256), password: passwordSchema });

export const profilePatchSchema = z.object({
  profilePhotoPublic: z.boolean().optional(),
  displayName: z.string().trim().min(2).max(80).optional(),
  cityId: uuidSchema.optional(),
  email: emailSchema.optional(),
}).refine((value) => Object.keys(value).length > 0);

export const passwordChangeSchema = z.object({ currentPassword: z.string().min(1), newPassword: passwordSchema });

export const accountCloseSchema = z.object({ reason: z.string().trim().max(500).optional() });

export type RegisterInput = z.infer<typeof registerSchema>;

export type LoginInput = z.infer<typeof loginSchema>;

export interface UserDto { profilePhotoPublic: boolean; id: string; email: string; displayName: string; city: CityDto; role: 'USER' | 'ADMIN'; status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED'; emailVerifiedAt: string | null; profilePhotoProvider: 'LOCAL' | 'CLOUDINARY' | null; profilePhotoUrl: string | null; profilePhotoMigrationAvailable: boolean }

export const reauthenticateSchema = z.object({ password: z.string().min(1).max(128) });

export type SessionDto = { state: 'GUEST' | 'AUTHENTICATED' | 'RESTRICTED'; reason: string | null; serverTime: string; user: UserDto | null; sessionId: string | null; expiresAt: string | null; reauthenticatedUntil: string | null };

export type ActiveSessionDto = { id: string; createdAt: string; lastSeenAt: string; expiresAt: string; current: boolean };
