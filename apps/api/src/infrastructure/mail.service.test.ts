import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Prisma } from '../generated/prisma/client.js';
import type { DatabaseService } from './database.service.js';
const smtp = vi.hoisted(() => ({ sendMail: vi.fn(), close: vi.fn(), create: vi.fn() }));
vi.mock('nodemailer', () => ({ default: { createTransport: smtp.create } }));
vi.mock('./jobs/lock.js', () => ({ exclusiveJob: async (_name: string, action: () => Promise<unknown>) => action() }));
import { config } from './config.js';
import { mailSettings } from './mail-delivery.js';
import { MailService } from './mail.service.js';

const appEnv = config.appEnv;
beforeEach(() => {
  vi.clearAllMocks(); smtp.create.mockReturnValue({ sendMail: smtp.sendMail, close: smtp.close });
  smtp.sendMail.mockResolvedValue({ accepted: ['recipient@example.test'], rejected: [] });
  vi.stubEnv('MAIL_TRANSPORT', 'smtp'); vi.stubEnv('MAIL_FROM', 'sender@example.test'); vi.stubEnv('SMTP_HOST', 'smtp.example.test');
  vi.stubEnv('SMTP_PORT', '587'); vi.stubEnv('SMTP_SECURE', 'false'); vi.stubEnv('MAIL_ENCRYPTION_KEY', '11'.repeat(32));
  vi.stubEnv('SMTP_USER', undefined); vi.stubEnv('SMTP_PASSWORD', undefined);
  config.appEnv = 'production'; vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { config.appEnv = appEnv; vi.unstubAllEnvs(); vi.restoreAllMocks(); });

function fixture() {
  const rows: Record<string, unknown>[] = [];
  const outbox = { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => { rows.push({ id: 'test-mail', attempts: 0, ...data }); }),
    findMany: vi.fn(async () => rows), update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const { attempts, ...rest } = data; Object.assign(rows[0], rest);
      if (attempts) rows[0].attempts = Number(rows[0].attempts) + Number((attempts as { increment: number }).increment);
    }) };
  const db = { mailOutbox: outbox };
  return { rows, outbox, db, service: new MailService(db as unknown as DatabaseService) };
}

describe('production mail outbox', () => {
  it('validates SMTP configuration before accepting production work', () => {
    expect(() => mailSettings({}, 'production')).toThrow('SMTP_HOST');
    expect(() => mailSettings({ MAIL_TRANSPORT: 'local' }, 'production')).toThrow('hanya boleh');
    expect(() => mailSettings({ SMTP_HOST: 'smtp.test', MAIL_FROM: 'sender@example.test', SMTP_USER: 'user' }, 'production')).toThrow('diisi bersama');
  });

  it('queues encrypted content, leaves request delivery to the worker, and clears sent content', async () => {
    const f = fixture();
    await f.service.queue(f.db as unknown as Prisma.TransactionClient, 'recipient@example.test', 'Verification', 'secret verification link', new Date(Date.now() + 60000));
    expect(f.rows[0].encryptedBody).not.toContain('secret verification link');
    await f.service.dispatchAfterCommit(); expect(smtp.sendMail).not.toHaveBeenCalled();
    await f.service.flushDue();
    expect(smtp.create).toHaveBeenCalledWith(expect.objectContaining({ requireTLS: true, secure: false }));
    expect(smtp.sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'recipient@example.test', text: 'secret verification link', disableFileAccess: true, disableUrlAccess: true }));
    expect(f.rows[0]).toMatchObject({ encryptedBody: '', sentAt: expect.any(Date) });
  });

  it('retains encrypted content and schedules retry when SMTP is unavailable', async () => {
    const f = fixture(); await f.service.queue(f.db as unknown as Prisma.TransactionClient, 'recipient@example.test', 'Reset', 'private reset token', new Date(Date.now() + 60000));
    const encrypted = f.rows[0].encryptedBody; smtp.sendMail.mockRejectedValueOnce(new Error('offline'));
    await expect(f.service.flushDue()).resolves.toBeUndefined();
    expect(f.outbox.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ attempts: { increment: 1 }, nextAttemptAt: expect.any(Date) }) }));
    expect(f.rows[0].encryptedBody).toBe(encrypted); expect(f.rows[0].sentAt).toBeUndefined();
    await f.service.flushDue(); expect(f.rows[0].sentAt).toBeInstanceOf(Date);
  });

  it('discards expired tokens without delivering them', async () => {
    const f = fixture(); await f.service.queue(f.db as unknown as Prisma.TransactionClient, 'recipient@example.test', 'Expired', 'expired token', new Date(Date.now() - 1));
    await f.service.flushDue(); expect(smtp.sendMail).not.toHaveBeenCalled(); expect(f.rows[0].encryptedBody).toBe('');
  });

  it('does not turn a committed local registration into a failure when dispatch fails', async () => {
    vi.stubEnv('MAIL_TRANSPORT', 'local'); config.appEnv = 'local'; const f = fixture();
    f.outbox.findMany.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(f.service.dispatchAfterCommit()).resolves.toBeUndefined();
  });
});
