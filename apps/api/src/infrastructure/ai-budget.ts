import { createHash } from 'node:crypto';
import type { Prisma } from '../generated/prisma/client.js';
import { nextWibDay } from '../modules/assessments/explainer/config.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');

// Call only inside serial(): both AI features share the existing quota namespaces
// so deploying vision never resets today's consumed Explainer allowance.
export async function reserveAiBudget(tx: Prisma.TransactionClient, actorId: string, limits: { userQuota: number; appQuota: number }, now: Date): Promise<{ reason: 'BUSY' | 'USER_QUOTA' | 'APP_QUOTA'; retryAt: Date } | null> {
  await tx.explanationLease.deleteMany({ where: { expiresAt: { lte: now } } });
  await tx.photoAnalysisLease.deleteMany({ where: { expiresAt: { lte: now } } });
  await tx.repairTutorialAiLease.deleteMany({ where: { expiresAt: { lte: now } } });
  const count = await tx.explanationLease.count() + await tx.photoAnalysisLease.count() + await tx.repairTutorialAiLease.count();
  if (count >= 2) return { reason: 'BUSY', retryAt: new Date(now.getTime() + 30000) };
  const resetAt = nextWibDay(now);
  const userKey = hash('explanation:daily:user:' + actorId), appKey = hash('explanation:daily:app');
  const user = await tx.authRateBucket.findUnique({ where: { key: userKey } });
  const app = await tx.authRateBucket.findUnique({ where: { key: appKey } });
  const userCount = user && user.resetAt > now ? user.count : 0, appCount = app && app.resetAt > now ? app.count : 0;
  if (userCount >= limits.userQuota) return { reason: 'USER_QUOTA', retryAt: resetAt };
  if (appCount >= limits.appQuota) return { reason: 'APP_QUOTA', retryAt: resetAt };
  for (const [key, value] of [[userKey, userCount], [appKey, appCount]] as const) await tx.authRateBucket.upsert({ where: { key }, update: { count: value + 1, resetAt }, create: { key, count: value + 1, resetAt } });
  return null;
}
