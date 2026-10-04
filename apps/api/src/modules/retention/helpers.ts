import { Prisma } from '../../generated/prisma/client.js';

export async function queueDeletion(tx: Prisma.TransactionClient, storageKey: string, at = new Date()) { await tx.storageDeletion.upsert({ where: { storageKey }, update: {}, create: { storageKey, nextAttemptAt: at } }); }
