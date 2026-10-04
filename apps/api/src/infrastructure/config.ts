import dotenv from 'dotenv';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

dotenv.config({ path: '.env.local', quiet: true });

const cloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim() ?? '';
const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY?.trim() ?? '';
const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET?.trim() ?? '';
const cloudinaryValues = [cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret];

export const config = {
  appEnv: process.env.APP_ENV ?? 'local',
  apiPort: Number(process.env.API_PORT ?? 4000),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
  appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL ?? '',
  localRoot: resolve(process.cwd(), '../../.local'),
  cloudinary: {
    cloudName: cloudinaryCloudName,
    apiKey: cloudinaryApiKey,
    apiSecret: cloudinaryApiSecret,
    configured: cloudinaryValues.every(Boolean),
    partial: cloudinaryValues.some(Boolean) && !cloudinaryValues.every(Boolean),
  },
};

export function secret(name: 'MAIL_ENCRYPTION_KEY' | 'MEDIA_SIGNING_KEY'): Buffer {
  const configured = process.env[name];
  if (configured) {
    if (!/^[a-fA-F0-9]{64}$/.test(configured)) throw new Error(name + ' harus berisi 64 karakter hex');
    return Buffer.from(configured, 'hex');
  }
  if (config.appEnv !== 'local') throw new Error(name + ' wajib pada lingkungan selain local');
  const directory = resolve(config.localRoot, 'keys');
  const file = resolve(directory, name.toLowerCase() + '.hex');
  mkdirSync(directory, { recursive: true });
  if (!existsSync(file)) writeFileSync(file, randomBytes(32).toString('hex'), { flag: 'wx' });
  return Buffer.from(readFileSync(file, 'utf8').trim(), 'hex');
}

export const cookieSecure = config.appEnv !== 'local';
