import nodemailer from 'nodemailer';
import { z } from 'zod';

export function mailSettings(env: NodeJS.ProcessEnv, appEnv: string) {
  const mode = env.MAIL_TRANSPORT ?? (appEnv === 'local' ? 'local' : 'smtp');
  if (mode === 'local') {
    if (appEnv !== 'local') throw new Error('MAIL_TRANSPORT=local hanya boleh untuk lingkungan local');
    return { mode: 'local' as const };
  }
  if (mode !== 'smtp') throw new Error('MAIL_TRANSPORT harus local atau smtp');
  const host = env.SMTP_HOST?.trim(), from = env.MAIL_FROM?.trim();
  const port = Number(env.SMTP_PORT ?? 587);
  if (!host || /\s|:\/\//.test(host)) throw new Error('SMTP_HOST wajib berisi hostname SMTP');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('SMTP_PORT tidak valid');
  if (!z.email().safeParse(from).success) throw new Error('MAIL_FROM wajib berisi alamat email pengirim');
  if (env.SMTP_SECURE !== undefined && !['true', 'false'].includes(env.SMTP_SECURE)) throw new Error('SMTP_SECURE harus true atau false');
  if (Boolean(env.SMTP_USER) !== Boolean(env.SMTP_PASSWORD)) throw new Error('SMTP_USER dan SMTP_PASSWORD harus diisi bersama');
  return { mode: 'smtp' as const, host, port, from: from!, secure: env.SMTP_SECURE === undefined ? port === 465 : env.SMTP_SECURE === 'true',
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD! } : undefined };
}

export function createMailDelivery(env: NodeJS.ProcessEnv, appEnv: string) {
  const settings = mailSettings(env, appEnv);
  if (settings.mode === 'local') return { mode: 'local' as const, close: () => {} };
  const transport = nodemailer.createTransport({ host: settings.host, port: settings.port, secure: settings.secure,
    requireTLS: !settings.secure, auth: settings.auth, tls: { minVersion: 'TLSv1.2' },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000 });
  return { mode: 'smtp' as const, close: () => transport.close(),
    send: async (mail: { id: string; recipient: string; subject: string }, text: string) => {
      const result = await transport.sendMail({ from: settings.from, to: mail.recipient, subject: mail.subject, text,
        messageId: `<${mail.id}@${settings.from.split('@')[1]}>`, disableFileAccess: true, disableUrlAccess: true });
      if (!result.accepted.length || result.rejected.length) throw new Error('SMTP did not accept the recipient');
    } };
}
