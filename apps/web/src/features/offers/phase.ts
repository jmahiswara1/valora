import type { OfferDto } from '@valora/contracts';

export const offerStatusLabel: Record<OfferDto['status'], string> = {
  PENDING: 'Menunggu respons', COUNTERED: 'Tawaran balik', ACCEPTED: 'Diterima',
  REJECTED: 'Ditolak', WITHDRAWN: 'Ditarik', EXPIRED: 'Kedaluwarsa',
};

export function offerPhase(offer: OfferDto, userId: string, now: number): 'response' | 'waiting' | 'finished' {
  if (!['PENDING', 'COUNTERED'].includes(offer.status) || Date.parse(offer.expiresAt) <= now) return 'finished';
  return offer.currentRevision?.respondsById === userId ? 'response' : 'waiting';
}
