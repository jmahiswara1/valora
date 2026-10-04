'use client';
import { useInfiniteQuery } from '@tanstack/react-query';
import { apiEnvelope } from './api';
import { Button } from "@/components/ui/primitives";
export function useQueue<T>(key: string[], path: string) {
  const query = useInfiniteQuery({ queryKey: key, initialPageParam: null as string | null, queryFn: ({ pageParam }) => apiEnvelope<T[]>(path + (pageParam ? '?cursor=' + pageParam : '')), getNextPageParam: (p) => p.meta?.nextCursor ?? undefined });
  return { ...query, data: query.data?.pages.flatMap((p) => p.data) };
}
export function QueueMore({ query }: { query: { hasNextPage: boolean; isFetchingNextPage: boolean; fetchNextPage: () => unknown } }) { return query.hasNextPage ? <Button variant="quiet" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>Muat berikutnya</Button> : null; }
