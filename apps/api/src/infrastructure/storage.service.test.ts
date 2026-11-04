import { mkdtemp, mkdir, readdir, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { config } from './config.js';
import { StorageService } from './storage.service.js';

let directory: string, storage: StorageService;
const originalRoot = config.localRoot;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'valora-storage-'));
  config.localRoot = directory; storage = new StorageService(); config.localRoot = originalRoot;
});
afterEach(async () => {
  if (!directory.startsWith(resolve(tmpdir()) + sep + 'valora-storage-')) throw new Error('Unexpected test cleanup directory');
  await rm(directory, { recursive: true, force: true });
});

describe('atomic immutable media storage', () => {
  it('publishes one complete file for concurrent retries and refuses different bytes', async () => {
    const bytes = Buffer.alloc(200000, 42);
    await Promise.all(Array.from({ length: 6 }, () => storage.writeImmutable('photo.webp', bytes)));
    expect(await storage.read('photo.webp')).toEqual(bytes);
    expect(await readdir(join(directory, 'media/.upload-tmp'))).toEqual([]);
    await expect(storage.writeImmutable('photo.webp', Buffer.from('different'))).rejects.toThrow('content differs');
    expect(await readFile(join(directory, 'media/photo.webp'))).toEqual(bytes);
  });

  it('cleans old interrupted temporary uploads without removing active or unrelated files', async () => {
    const pending = join(directory, 'media/.upload-tmp'); await mkdir(pending, { recursive: true });
    const old = randomUUID() + '.tmp', active = randomUUID() + '.tmp';
    await Promise.all([writeFile(join(pending, old), 'old'), writeFile(join(pending, active), 'active'), writeFile(join(pending, 'unrelated.txt'), 'keep')]);
    const yesterday = new Date(Date.now() - 2 * 86400000); await utimes(join(pending, old), yesterday, yesterday);
    await storage.cleanupTemporaryUploads(new Date(Date.now() - 86400000));
    expect((await readdir(pending)).sort()).toEqual([active, 'unrelated.txt'].sort());
  });
});
