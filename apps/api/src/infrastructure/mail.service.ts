import { exclusiveJob } from './jobs/lock.js';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Prisma } from '../generated/prisma/client.js';
import { config, secret } from './config.js';
import { DatabaseService } from './database.service.js';
import { createMailDelivery } from './mail-delivery.js';

@Injectable()
export class MailService implements OnModuleInit, OnModuleDestroy {
  private readonly key = secret('MAIL_ENCRYPTION_KEY');
  private readonly delivery = createMailDelivery(process.env, config.appEnv);
  private timer?: NodeJS.Timeout;

  constructor(private readonly db: DatabaseService) {}

  private encrypt(body: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(body, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
  }

  private decrypt(value: string): string {
    const packed = Buffer.from(value, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', this.key, packed.subarray(0, 12));
    decipher.setAuthTag(packed.subarray(12, 28));
    return Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]).toString('utf8');
  }

  async queue(tx: Prisma.TransactionClient, recipient: string, subject: string, body: string, expiresAt: Date): Promise<void> {
    await tx.mailOutbox.create({ data: { recipient, subject, encryptedBody: this.encrypt(body), expiresAt } });
  }

  async flushDue(): Promise<void> { await exclusiveJob('mail', () => this.flushUnlocked()); }

  async dispatchAfterCommit(): Promise<void> {
    // Production delivery belongs to the worker. Local fixtures can read their
    // verification message immediately, without making queue failures undo a response.
    if (this.delivery.mode === 'local') await this.flushDue().catch(() => this.logFailure());
  }

  private logFailure(): void { console.error(JSON.stringify({ event: 'mail_job_failed' })); }
  private async flushUnlocked(): Promise<void> {
    const now = new Date();
    const due = await this.db.mailOutbox.findMany({ where: { sentAt: null, nextAttemptAt: { lte: now } }, orderBy: { createdAt: 'asc' }, take: 20 });
    if (due.length === 0) return;
    const directory = resolve(config.localRoot, 'mail');
    if (this.delivery.mode === 'local') await mkdir(directory, { recursive: true });
    for (const row of due) {
      if (row.expiresAt <= now) {
        await this.db.mailOutbox.update({ where: { id: row.id }, data: { encryptedBody: '', sentAt: now } });
        continue;
      }
      try {
        const body = this.decrypt(row.encryptedBody);
        if (this.delivery.mode === 'local') await writeFile(resolve(directory, row.id + '.txt'), 'Kepada: ' + row.recipient + '\nSubjek: ' + row.subject + '\n\n' + body, 'utf8');
        else await this.delivery.send(row, body);
        await this.db.mailOutbox.update({ where: { id: row.id }, data: { encryptedBody: '', sentAt: new Date() } });
      } catch {
        this.logFailure();
        await this.db.mailOutbox.update({ where: { id: row.id }, data: { attempts: { increment: 1 }, nextAttemptAt: new Date(Date.now() + Math.min(3600000, 15000 * 2 ** Math.min(row.attempts, 8))) } });
      }
    }
  }

  onModuleInit(): void {
    void this.flushDue().catch((error: unknown) => console.error(JSON.stringify({ event: 'mail_job_failed', type: error instanceof Error ? error.name : 'Unknown' })));
    this.timer = setInterval(() => void this.flushDue().catch((error: unknown) => console.error(JSON.stringify({ event: 'mail_job_failed', type: error instanceof Error ? error.name : 'Unknown' }))), 15000);
    this.timer.unref();
  }

  onModuleDestroy(): void { if (this.timer) clearInterval(this.timer); this.delivery.close(); }
}
