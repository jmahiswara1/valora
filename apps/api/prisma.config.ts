import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

dotenv.config({ path: '.env.local' });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'node dist/seed.js' },
  datasource: { url: process.env.DATABASE_URL ?? 'postgresql://invalid:invalid@127.0.0.1:5432/valora_dev' },
});
