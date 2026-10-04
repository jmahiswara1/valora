'use client';

import { AccountSkeleton } from '../../features/account/skeleton';
import { Notice, Button } from "./primitives";

export function LoadState({ query, skeleton = false }: { query: { isPending: boolean; isError: boolean; error: Error | null; refetch: () => unknown }; skeleton?: boolean }) { return query.isPending ? skeleton ? <AccountSkeleton /> : <p role="status">Memuat data…</p> : query.isError ? <Notice kind="error">{query.error?.message ?? 'Data gagal dimuat.'} <Button variant="quiet" onClick={() => query.refetch()}>Coba lagi</Button></Notice> : null; }
