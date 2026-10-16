import { z } from 'zod';
import { uuidSchema } from './common.js';

// Stage 6: recovery operation names are shared by API and browser.
export const actionOperationNames = ['handover-propose', 'handover-respond', 'handover-withdraw', 'shipment-update', 'accept', 'confirm', 'cash-confirm', 'cancel-request', 'cancel-respond', 'dispute', 'overdue-case', 'evidence', 'case-claim', 'case-access', 'resolve', 'correction-open', 'correction-claim', 'operations-grant', 'correction-evidence', 'correction-close', 'ownership-correction', 'impact-adjust', 'source-correction', 'passport-visibility', 'user-status', 'report-claim', 'report-resolve', 'admin-listing', 'retention-hold', 'retention-release', 'rubric-draft', 'rubric-edit', 'rubric-publish', 'category', 'reference-status', 'economic-reference', 'repair-correct', 'repair-void', 'moderation', 'review-create', 'review-reply', 'review-visibility'] as const;

export const actionStatusSchema = z.object({ operation: z.string().min(1).max(180).refine((s) => actionOperationNames.some((name) => s === name || s.startsWith(name + ':'))), key: uuidSchema });

export type ActionStatusDto = { status: 'COMMITTED' | 'PURGED' | 'NOT_FOUND'; completedAt: string | null };

export function actionOperationFor(path: string, payload: unknown): string {
  const input = (payload ?? {}) as Record<string, string>;
  const rules: [RegExp, (m: RegExpMatchArray) => string][] = [
    [/^\/transactions\/([^/]+)\/handover\/proposals$/, m => 'handover-propose:' + m[1]],
    [/^\/transactions\/([^/]+)\/handover\/proposals\/([^/]+)\/(respond|withdraw)$/, m => 'handover-' + m[3] + ':' + m[1] + ':' + m[2]],
    [/^\/transactions\/([^/]+)\/handover\/shipments\/([^/]+)$/, m => 'shipment-update:' + m[1] + ':' + m[2]],
    [/^\/transactions\/([^/]+)\/reviews$/, m => 'review-create:' + m[1]],
    [/^\/reviews\/([^/]+)\/reply$/, m => 'review-reply:' + m[1]],
    [/^\/admin\/(reviews|review-replies)\/([^/]+)\/visibility$/, m => 'review-visibility:' + (m[1] === 'reviews' ? 'REVIEW' : 'REVIEW_REPLY') + ':' + m[2]],
    [/^\/offers\/([^/]+)\/accept$/, m => 'accept:' + m[1]],
    [/^\/transactions\/([^/]+)\/confirmations$/, m => 'confirm:' + m[1]],
    [/^\/transactions\/([^/]+)\/cash-confirmations$/, m => 'cash-confirm:' + m[1]],
    [/^\/transactions\/([^/]+)\/cancellation-requests$/, m => 'cancel-request:' + m[1]],
    [/^\/transactions\/([^/]+)\/cancellation-requests\/([^/]+)\/respond$/, m => 'cancel-respond:' + m[1] + ':' + m[2]],
    [/^\/transactions\/([^/]+)\/disputes$/, m => 'dispute:' + m[1]],
    [/^\/transactions\/([^/]+)\/corrections$/, m => 'correction-open:' + m[1]],
    [/^\/cases\/([^/]+)\/evidence$/, m => 'evidence:' + m[1]],
    [/^\/correction-cases\/([^/]+)\/evidence$/, m => 'correction-evidence:' + m[1]],
    [/^\/admin\/transactions\/([^/]+)\/open-case$/, m => 'overdue-case:' + m[1]],
    [/^\/admin\/transactions\/([^/]+)\/resolve-dispute$/, m => 'resolve:' + m[1]],
    [/^\/admin\/disputes\/([^/]+)\/claim$/, m => 'case-claim:' + m[1]],
    [/^\/admin\/cases\/([^/]+)\/(chat|evidence|handover)-access$/, m => 'case-access:' + m[1] + ':' + m[2].toUpperCase()],
    [/^\/admin\/correction-cases\/([^/]+)\/(claim|close)$/, m => 'correction-' + m[2] + ':' + m[1]],
    [/^\/admin\/(reports|correction-cases)\/([^/]+)\/access$/, m => 'operations-grant:' + (m[1] === 'reports' ? 'REPORT' : 'CORRECTION') + ':' + m[2]],
    [/^\/admin\/reports\/([^/]+)\/(claim|resolve)$/, m => 'report-' + m[2] + ':' + m[1]],
    [/^\/admin\/transactions\/([^/]+)\/correct$/, m => 'ownership-correction:' + m[1]],
    [/^\/admin\/impact\/corrections$/, () => 'impact-adjust:' + input.caseId],
    [/^\/admin\/(assessments|repairs)\/([^/]+)\/validity$/, m => 'source-correction:' + (m[1] === 'repairs' ? 'REPAIR' : 'ASSESSMENT') + ':' + m[2]],
    [/^\/admin\/passport\/([^/]+)\/visibility$/, m => 'passport-visibility:' + m[1]],
    [/^\/admin\/users\/([^/]+)\/(suspend|release)$/, m => 'user-status:' + m[1]],
    [/^\/admin\/listings\/([^/]+)\/(suspend|release)$/, m => 'admin-listing:' + m[1] + ':' + m[2]],
    [/^\/admin\/retention\/holds$/, () => 'retention-hold'],
    [/^\/admin\/retention\/holds\/([^/]+)\/release$/, m => 'retention-release:' + m[1]],
    [/^\/admin\/rubrics\/drafts$/, () => 'rubric-draft'],
    [/^\/admin\/rubrics\/drafts\/([^/]+)\/publish$/, m => 'rubric-publish:' + m[1]],
    [/^\/admin\/rubrics\/drafts\/([^/]+)$/, m => 'rubric-edit:' + m[1]],
    [/^\/admin\/categories\/([^/]+)$/, m => 'category:' + m[1]],
    [/^\/admin\/economic-references$/, () => 'economic-reference'],
    [/^\/admin\/economic-references\/([^/]+)\/(activate|deactivate)$/, m => 'reference-status:' + m[1] + ':' + (m[2] === 'activate')],
    [/^\/repairs\/([^/]+)\/(corrections|void)$/, m => (m[2] === 'void' ? 'repair-void:' : 'repair-correct:') + m[1]],
    [/^\/admin\/listing-reviews\/([^/]+)\/decide$/, m => 'moderation:' + m[1]],
  ];
  for (const [pattern, operation] of rules) { const match = path.match(pattern); if (match) return operation(match); }
  throw new Error('Operation pemulihan belum terdaftar: ' + path);
}
