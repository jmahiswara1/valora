import { DatabaseService } from '../../infrastructure/database.service.js';
import { sha256 } from './shared.js';

export async function resolveSession(db: DatabaseService, rawToken?: string) {
  const row = rawToken ? await db.session.findUnique({ where: { tokenHash: sha256(rawToken) }, include: { user: true } }) : null;
  if (!row || row.revokedAt || row.expiresAt <= new Date()) return null;
  if (row.user.status === 'ACTIVE') await db.session.updateMany({ where: { id: row.id, lastSeenAt: { lt: new Date(Date.now() - 300000) } }, data: { lastSeenAt: new Date() } });
  return row;
}
