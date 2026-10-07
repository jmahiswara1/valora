import type { Prisma } from '../../generated/prisma/client.js';
import { uuidSchema, type PublicPersonDto, type ReviewDto } from '@valora/contracts';
import { AppException } from '../../shared/http.js';

export const personSelect = { id: true, displayName: true, status: true, profilePhotoPublic: true, version: true, profilePhoto: { select: { userId: true } } } satisfies Prisma.UserSelect;
export const reviewInclude = { author: { select: personSelect }, subject: { select: personSelect }, transaction: { select: { type: true, status: true, correctedAt: true } }, reply: true } satisfies Prisma.ReviewInclude;
export type ReviewRow = Prisma.ReviewGetPayload<{ include: typeof reviewInclude }>;
export function publicPerson(row: Prisma.UserGetPayload<{ select: typeof personSelect }>): PublicPersonDto {
  return { id: row.id, displayName: row.displayName, profilePhotoUrl: row.status === 'ACTIVE' && row.profilePhotoPublic && row.profilePhoto ? `/api/v1/profiles/${row.id}/photo?v=${row.version}` : null };
}
export function publicReviewWhere(): Prisma.ReviewWhereInput {
  return { visibility: 'VISIBLE', purgedAt: null, author: { status: 'ACTIVE' }, subject: { status: 'ACTIVE' }, transaction: { status: 'COMPLETED', correctedAt: null } };
}
export function reviewVisible(row: ReviewRow) { return row.visibility === 'VISIBLE' && !row.purgedAt && row.author.status === 'ACTIVE' && row.subject.status === 'ACTIVE' && row.transaction.status === 'COMPLETED' && !row.transaction.correctedAt; }
export function reviewDto(row: ReviewRow, privateView = false): ReviewDto {
  const visible = reviewVisible(row), reply = row.reply;
  return { id: row.id, author: publicPerson(row.author), subjectId: row.subjectId, rating: row.rating,
    comment: visible || privateView ? row.comment : null, type: row.transaction.type, createdAt: row.createdAt.toISOString(), version: row.version, visibility: visible ? 'VISIBLE' : 'HIDDEN',
    reply: reply && (privateView || visible) ? { id: reply.id, body: privateView || reply.visibility === 'VISIBLE' ? reply.body : null, createdAt: reply.createdAt.toISOString(), version: reply.version, visibility: reply.visibility === 'VISIBLE' && !reply.purgedAt ? 'VISIBLE' : 'HIDDEN' } : null };
}
export function reviewCursor(cursor?: string): { at: Date; id: string } | null {
  if (!cursor) return null;
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { at?: string; id?: string };
    if (!value.at || !value.id || !uuidSchema.safeParse(value.id).success || Number.isNaN(Date.parse(value.at))) throw new Error();
    return { at: new Date(value.at), id: value.id };
  } catch { throw new AppException(400, 'INVALID_INPUT', 'Cursor tidak valid.'); }
}
export function reviewPage<T extends { id: string; createdAt: Date }, D>(rows: T[], map: (row: T) => D) {
  const page = rows.slice(0, 20), last = page.at(-1);
  return { data: page.map(map), meta: { nextCursor: rows.length > 20 && last ? Buffer.from(JSON.stringify({ at: last.createdAt.toISOString(), id: last.id })).toString('base64url') : null } };
}
