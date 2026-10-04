import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from "../../dist/generated/prisma/client.js";
if (!new URL(process.env.DATABASE_URL).pathname.endsWith('_test')) throw new Error('Only test database rate buckets may be cleared.');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
await db.authRateBucket.deleteMany(); await db.$disconnect();
