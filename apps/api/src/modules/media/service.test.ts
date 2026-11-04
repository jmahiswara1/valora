import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../../infrastructure/database.service.js';
import type { StorageService } from '../../infrastructure/storage.service.js';
import { MediaService } from './service.js';

async function fixture() {
  const photo = (background: string) => sharp({ create: { width: 4, height: 4, channels: 3, background } }).png({ compressionLevel: 0 }).toBuffer();
  const [body, other] = await Promise.all([photo('red'), photo('blue')]);
  const ticket = { id: randomUUID(), userId: randomUUID(), status: 'ISSUED', purpose: 'ITEM', expiresAt: new Date(Date.now() + 60000), declaredBytes: body.length, declaredMime: 'image/png', storageKey: null as string | null };
  let failCommit = false, commits = Promise.resolve();
  const update = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    if (data.status === 'UPLOADED' && failCommit) { failCommit = false; throw new Error('Injected commit failure'); }
    Object.assign(ticket, data); return { ...ticket };
  });
  const tx = { $queryRaw: async () => [], uploadTicket: { findUnique: async () => ({ ...ticket }), update } };
  const db = { uploadTicket: tx.uploadTicket, $transaction: <T>(action: (value: typeof tx) => Promise<T>) => {
    const result = commits.then(() => action(tx)); commits = result.then(() => {}, () => {}); return result;
  } };
  const files = new Map<string, Buffer>();
  const storage = { writeImmutable: vi.fn(async (key: string, bytes: Buffer) => {
    const old = files.get(key); if (old && !old.equals(bytes)) throw new Error('Content changed'); files.set(key, bytes);
  }) };
  const service = new MediaService(db as unknown as DatabaseService, storage as unknown as StorageService);
  const upload = (bytes = body) => service.upload(ticket.userId, ticket.id, bytes, 'image/png');
  return { ticket, body, other, update, files, storage, upload, failNextCommit: () => { failCommit = true; } };
}

describe('recoverable photo uploads', () => {
  it('reuses the persisted file after a database failure and after a lost response', async () => {
    const f = await fixture(); f.failNextCommit();
    await expect(f.upload()).rejects.toThrow('Injected commit failure');
    expect(f.ticket.status).toBe('ISSUED'); expect(f.ticket.storageKey).toBeTruthy(); expect(f.files.size).toBe(1);
    const first = await f.upload(); const replay = await f.upload();
    expect(f.ticket.status).toBe('UPLOADED'); expect(replay).toEqual(first); expect(f.files.size).toBe(1);
  });

  it('concurrent identical uploads converge on one ticket and one stored image', async () => {
    const f = await fixture();
    const results = await Promise.all([f.upload(), f.upload(), f.upload()]);
    expect(results[1]).toEqual(results[0]); expect(results[2]).toEqual(results[0]); expect(f.files.size).toBe(1);
    expect(f.update.mock.calls.filter(([input]) => input.data.status === 'UPLOADED')).toHaveLength(1);
  });

  it('cannot replace the photo bound to a ticket with different contents', async () => {
    const f = await fixture(); expect(f.other.length).toBe(f.body.length);
    await f.upload();
    await expect(f.upload(f.other)).rejects.toMatchObject({ code: 'STATE_CONFLICT' });
    expect(f.files.size).toBe(1);
  });

  it('does not write a file when the ticket has already been consumed', async () => {
    const f = await fixture(); f.ticket.status = 'CONSUMED';
    await expect(f.upload()).rejects.toMatchObject({ code: 'STATE_CONFLICT' }); expect(f.storage.writeImmutable).not.toHaveBeenCalled();
  });
});
