'use client';

import type { ActiveListing } from './shared';

export const listingMoney = (value: number) => new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
}).format(value);

export const listingTypeLabel: Record<ActiveListing['type'], string> = {
  RESELL: 'Resell', EXCHANGE: 'Tukar barang', DONATE: 'Donasi',
};

export const listingConditionLabel = (value: number) => value >= 75 ? 'Kondisi sangat baik' : value >= 50 ? 'Kondisi baik' : 'Perlu perhatian';
