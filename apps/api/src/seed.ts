import dotenv from 'dotenv';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Algorithm, hash } from '@node-rs/argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';
import type { Prisma } from './generated/prisma/client.js';
import { rubricSeeds } from './modules/assessments/data.js';

dotenv.config({ path: '.env.local', quiet: true });
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL belum diatur');

type CitySeed = { code: string; name: string; provinceName: string };
const snapshot = JSON.parse(await readFile(resolve(process.cwd(), 'prisma/data/cities.json'), 'utf8')) as { count: number; cities: CitySeed[] };
if (snapshot.count !== 514 || snapshot.cities.length !== 514) throw new Error('Snapshot kota tidak lengkap');

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
try {
  await db.city.createMany({ data: snapshot.cities, skipDuplicates: true });
  const categories = [
    { code: 'electronics', name: 'Elektronik', sortOrder: 1 },
    { code: 'furniture', name: 'Furnitur', sortOrder: 2 },
    { code: 'fashion', name: 'Pakaian', sortOrder: 3 },
    { code: 'books', name: 'Buku', sortOrder: 4 },
    { code: 'household', name: 'Peralatan rumah tangga', sortOrder: 5 },
    { code: 'sports', name: 'Peralatan olahraga', sortOrder: 6 },
    { code: 'hobby', name: 'Barang hobi', sortOrder: 7 },
  ];
  for (const category of categories) {
    await db.category.upsert({ where: { code: category.code }, create: category, update: { name: category.name, sortOrder: category.sortOrder, active: true } });
  }
  const subcategories = [
    { code: 'musical-instruments', name: 'Alat musik', parentCode: 'hobby', sortOrder: 1 },
    { code: 'board-games', name: 'Permainan papan', parentCode: 'hobby', sortOrder: 2 },
    { code: 'arts-crafts', name: 'Seni dan kerajinan', parentCode: 'hobby', sortOrder: 3 },
  ];
  for (const category of subcategories) {
    await db.category.upsert({ where: { code: category.code }, create: category, update: { name: category.name, sortOrder: category.sortOrder, active: true } });
  }
  for (const rubric of rubricSeeds) {
    await db.rubricVersion.createMany({ data: [{
      rubricKey: rubric.rubricKey, categoryCode: rubric.categoryCode, subcategoryCode: rubric.subcategoryCode,
      ruleVersion: rubric.ruleVersion, policyVersion: rubric.policyVersion, recommendationVersion: rubric.recommendationVersion,
      questionConfig: { questions: rubric.questions, contextPrompt: rubric.contextPrompt } as unknown as Prisma.InputJsonValue,
      safetyConfig: { safetyQuestions: rubric.safetyQuestions } as unknown as Prisma.InputJsonValue,
      effectiveAt: new Date('2026-09-28T00:00:00.000Z'), publicationReason: 'Rubrik awal MVP Insyfest 2026',
    }], skipDuplicates: true });
  }

  if (process.env.APP_ENV === 'local') {
    const localRoot = resolve(process.cwd(), '../../.local');
    const credentialsFile = resolve(localRoot, 'demo-credentials.json');
    let password: string;
    try {
      password = (JSON.parse(await readFile(credentialsFile, 'utf8')) as { password: string }).password;
    } catch {
      password = process.env.DEMO_SEED_PASSWORD ?? randomBytes(18).toString('base64url');
    }
    const passwordHash = await hash(password, { algorithm: Algorithm.Argon2id });
    const city = await db.city.findFirstOrThrow({ where: { name: 'Kota Bandung' } });
    const users = [
      { email: 'owner.demo@valora.local', displayName: 'Nadia Demo', role: 'USER' as const },
      { email: 'member.demo@valora.local', displayName: 'Raka Demo', role: 'USER' as const },
      { email: 'admin.demo@valora.local', displayName: 'Admin Demo', role: 'ADMIN' as const },
    ];
    for (const user of users) {
      await db.user.upsert({
        where: { email: user.email },
        create: { ...user, passwordHash, cityId: city.id, emailVerifiedAt: new Date() },
        update: { role: user.role },
      });
    }
    await mkdir(localRoot, { recursive: true });
    await writeFile(credentialsFile, JSON.stringify({ accounts: users.map(({ email, role }) => ({ email, role })), password }, null, 2) + '\n', { flag: 'w' });
  }
  console.log('Seed siap: ' + snapshot.count + ' kota/kabupaten, 7 kategori utama, 3 subkategori hobi, 9 rubrik, akun demo lokal.');
} finally {
  await db.$disconnect();
}
