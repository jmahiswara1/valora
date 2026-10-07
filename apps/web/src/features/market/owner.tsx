'use client';
import Link from 'next/link';
import { Star, ArrowUpRight } from 'lucide-react';
import { usePublicProfile } from '@/features/profile/public';
import { ProfileAvatar } from '@/features/profile/avatar';

export function MarketOwnerProfile({ id, displayName }: { id: string; displayName: string }) {
  const profile = usePublicProfile(id);
  if (!id) return <p className="detail-owner-name">{displayName}</p>;
  return <div className="market-owner-profile"><Link className="review-author" href={`/profil/${id}`}><ProfileAvatar photoUrl={profile.data?.profilePhotoUrl ?? null} displayName={displayName} /><strong>{displayName}</strong></Link>{profile.data && <p className="market-owner-rating"><Star size={15} aria-hidden="true" />{profile.data.rating.average === null ? 'Belum ada ulasan' : `${profile.data.rating.average.toLocaleString('id-ID', { minimumFractionDigits: 1 })} · ${profile.data.rating.count} ulasan`}</p>}<Link href={`/profil/${id}`} className="market-owner-link">Lihat profil <ArrowUpRight size={16} aria-hidden="true" /></Link></div>;
}
