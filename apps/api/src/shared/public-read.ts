import type { Prisma } from '../generated/prisma/client.js';
import type { DatabaseService } from '../infrastructure/database.service.js';

// Public projections need a consistent visibility/content snapshot, without
// joining the mutation gate. Keep private reads on the session-checked path.
export function publicRead<T>(db: DatabaseService, action: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return db.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    return action(tx);
  }, { isolationLevel: 'RepeatableRead', maxWait: 10000, timeout: 20000 });
}
