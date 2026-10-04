import { AppException } from './http.js';
export function cursorId(value?: string): { cursor?: { id: string }; skip?: number } { if (value && !/^[0-9a-f-]{36}$/i.test(value)) throw new AppException(400, 'INVALID_INPUT', 'Cursor tidak valid.'); return value ? { cursor: { id: value }, skip: 1 } : {}; }
export function page<T extends { id: string }>(rows: T[]) { return { data: rows.slice(0, 30), meta: { nextCursor: rows.length > 30 ? rows[29].id : null } }; }
