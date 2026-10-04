import pg from 'pg';
import { config } from '../config.js';
// Session advisory locks must use a dedicated connection, never a pooled Prisma query.
export async function exclusiveJob<T>(name: string, action: () => Promise<T>): Promise<T | undefined> {
  const client = new pg.Client({ connectionString: config.databaseUrl });
  await client.connect();
  let locked = false;
  try {
    const result = await client.query<{ locked: boolean }>('SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS locked', ['valora-job:' + name]);
    locked = result.rows[0].locked; if (!locked) return undefined;
    return await action();
  } finally {
    try { if (locked) await client.query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', ['valora-job:' + name]); } finally { await client.end(); }
  }
}
