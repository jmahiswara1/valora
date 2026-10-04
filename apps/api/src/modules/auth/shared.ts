import { createHash, randomBytes } from 'node:crypto';

export const sessionCookie = 'valora_session';

export const sevenDays = 7 * 24 * 60 * 60 * 1000;

export const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');

export const randomToken = (): string => randomBytes(32).toString('base64url');
