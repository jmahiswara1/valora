import { Injectable } from '@nestjs/common';
import { link, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, resolve, sep } from 'node:path';
import { config } from './config.js';

@Injectable()
export class StorageService {
  private readonly directory = resolve(config.localRoot, 'media');

  private path(key: string): string {
    const file = resolve(this.directory, key);
    if (!file.startsWith(this.directory + sep)) throw new Error('Invalid storage key');
    return file;
  }

  async removeMail(key: string): Promise<void> {
    if (!/^[0-9a-f-]{36}\.txt$/i.test(key)) throw new Error('Invalid mail storage key');
    await rm(resolve(config.localRoot, 'mail', key), { force: true });
  }
  async write(key: string, bytes: Buffer): Promise<void> {
    const file = this.path(key);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, bytes, { flag: 'wx' });
  }

  async writeImmutable(key: string, bytes: Buffer): Promise<void> {
    const file = this.path(key);
    const pending = this.path('.upload-tmp');
    await mkdir(dirname(file), { recursive: true });
    await mkdir(pending, { recursive: true });
    const temporary = resolve(pending, randomUUID() + '.tmp');
    try {
      await writeFile(temporary, bytes, { flag: 'wx' });
      try { await link(temporary, file); }
      catch (error) {
        if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') throw error;
        if (!(await readFile(file)).equals(bytes)) throw new Error('Immutable media content differs');
      }
    } finally { await rm(temporary, { force: true }); }
  }

  async cleanupTemporaryUploads(before: Date): Promise<void> {
    const directory = this.path('.upload-tmp');
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); }
    catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return; throw error; }
    for (const entry of entries) {
      if (!entry.isFile() || !/^[0-9a-f-]{36}\.tmp$/i.test(entry.name)) continue;
      const file = resolve(directory, entry.name);
      try { if ((await stat(file)).mtime < before) await rm(file, { force: true }); }
      catch (error) { if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error; }
    }
  }

  async read(key: string): Promise<Buffer> { return readFile(this.path(key)); }
  async remove(key: string): Promise<void> { await rm(this.path(key), { force: true }); }
}
