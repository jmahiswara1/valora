import { Injectable } from '@nestjs/common';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
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

  async read(key: string): Promise<Buffer> { return readFile(this.path(key)); }
  async remove(key: string): Promise<void> { await rm(this.path(key), { force: true }); }
}
