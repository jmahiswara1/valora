'use client';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowUpRight, MapPin, Star } from 'lucide-react';
import type { PublicProfileDto, PublicListingDto, ReviewDto } from '@valora/contracts';
import { api, apiEnvelope, ApiClientError } from '@/lib/api';
import { Button, Notice } from '@/components/ui/primitives';
import { MarketGrid } from '@/features/market/grid';
import { ReviewEntry } from '@/features/reviews/entry';
import { ProfileAvatar } from './avatar';

export function usePublicProfile(id?: string) { return useQuery({ queryKey: ['public-profile', id], queryFn: () => api<PublicProfileDto>(`/profiles/${id}`), enabled: Boolean(id), staleTime: 15000, refetchOnWindowFocus: true, retry: false }); }
export function PublicProfilePage({ id }: { id: string }) {
  const query = usePublicProfile(id), search = useSearchParams(), tab = search.get('tab') === 'ulasan' ? 'ulasan' : 'barang';
  const listings = useInfiniteQuery({ queryKey: ['public-profile', id, 'listings'], initialPageParam: '', queryFn: ({ pageParam }) => apiEnvelope<PublicListingDto[]>(`/profiles/${id}/listings${pageParam ? '?cursor=' + encodeURIComponent(pageParam) : ''}`), getNextPageParam: page => page.meta?.nextCursor || undefined, enabled: Boolean(query.data) && tab === 'barang', retry: false });
  const reviews = useInfiniteQuery({ queryKey: ['public-profile', id, 'reviews'], initialPageParam: '', queryFn: ({ pageParam }) => apiEnvelope<ReviewDto[]>(`/profiles/${id}/reviews${pageParam ? '?cursor=' + encodeURIComponent(pageParam) : ''}`), getNextPageParam: page => page.meta?.nextCursor || undefined, enabled: Boolean(query.data) && tab === 'ulasan', retry: false });
  const content = tab === 'barang' ? listings : reviews, profile = query.data;
  return <main id="main-content" className="container public-profile"><Link href="/market" className="back-link">Kembali ke Market <ArrowUpRight size={15} aria-hidden="true" /></Link>
    {query.isPending ? <section className="public-profile-loading" role="status">Memuat profil…</section> : query.isError || !profile ? <section className="public-profile-unavailable"><h1>{query.error instanceof ApiClientError && query.error.status === 404 ? 'Profil tidak tersedia.' : 'Profil belum dapat dimuat.'}</h1><p>{query.error instanceof ApiClientError && query.error.status === 404 ? 'Akun ini tidak tersedia untuk ditampilkan publik.' : 'Coba muat kembali untuk melihat profil ini.'}</p>{!(query.error instanceof ApiClientError && query.error.status === 404) && <Button onClick={() => query.refetch()}>Coba lagi</Button>}<Link href="/market" className="button button-secondary">Jelajahi Market</Link></section> : <>
      <header className="public-profile-header"><ProfileAvatar photoUrl={profile.profilePhotoUrl} displayName={profile.displayName} className="public-profile-avatar" /><div className="public-profile-identity"><h1>{profile.displayName}</h1>{profile.city && <p><MapPin size={17} aria-hidden="true" />{profile.city.name}, {profile.city.provinceName}</p>}<p className="public-profile-joined">Bergabung {new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(profile.joinedAt))}</p></div><div className="public-profile-rating"><Star size={23} aria-hidden="true" fill={profile.rating.count ? 'currentColor' : 'none'} /><div><strong>{profile.rating.average === null ? 'Belum ada ulasan' : `${profile.rating.average.toLocaleString('id-ID', { minimumFractionDigits: 1 })} / 5`}</strong><p>{profile.rating.count ? `${profile.rating.count} ulasan dari transaksi selesai` : 'Pengalaman transaksi akan tampil di sini.'}</p></div></div></header>
      <nav className="public-profile-tabs" aria-label="Konten profil">{(['barang', 'ulasan'] as const).map(value => <Link key={value} href={`/profil/${id}${value === 'ulasan' ? '?tab=ulasan' : ''}`} scroll={false} aria-current={tab === value ? 'page' : undefined}>{value === 'barang' ? 'Barang' : 'Ulasan'}{value === 'ulasan' && <span>{profile.rating.count}</span>}</Link>)}</nav>
      <section className="public-profile-content" aria-label={tab === 'barang' ? 'Barang aktif' : 'Ulasan pengguna'}>{content.isPending ? <p role="status">Memuat {tab}…</p> : content.isError ? <Notice kind="error">{tab === 'barang' ? 'Barang' : 'Ulasan'} belum dapat dimuat. <Button variant="quiet" onClick={() => content.refetch()}>Coba lagi</Button></Notice> : tab === 'barang' ? listings.data?.pages.some(p => p.data.length) ? <MarketGrid listings={listings.data.pages.flatMap(p => p.data)} /> : <div className="public-profile-empty"><h2>Belum ada barang aktif.</h2><p>Barang yang sedang ditawarkan pengguna ini akan tampil di sini.</p></div> : reviews.data?.pages.some(p => p.data.length) ? <div className="public-profile-reviews">{reviews.data.pages.flatMap(p => p.data).map(row => <ReviewEntry key={row.id} row={row} subjectName={profile.displayName} />)}</div> : <div className="public-profile-empty"><h2>Belum ada ulasan.</h2><p>Rating dan pengalaman dari transaksi selesai akan tampil di sini.</p></div>}
        {content.hasNextPage && <div className="public-profile-more"><Button variant="secondary" disabled={content.isFetchingNextPage} onClick={() => content.fetchNextPage()}>{content.isFetchingNextPage ? 'Memuat…' : 'Muat lebih banyak'}</Button></div>}{content.isFetchNextPageError && <Notice kind="error">Halaman berikutnya belum dapat dimuat. Coba lagi.</Notice>}
      </section>
    </>}
  </main>;
}
