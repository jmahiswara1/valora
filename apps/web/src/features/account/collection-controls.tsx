import { Search } from 'lucide-react';
import type { ListingDto } from '@valora/contracts';
import { Field } from '@/components/ui/primitives';
import { listingTypeLabel } from '@/features/market/labels';

export function CollectionSearch({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return <Field label={label} htmlFor={id}><div className="collection-search"><Search size={18} aria-hidden="true" /><input id={id} className="input" type="search" placeholder="Cari barang…" value={value} onChange={event => onChange(event.target.value)} /></div></Field>;
}

export function CollectionTypes({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <div className="collection-type-filters" role="group" aria-label={label}>{(['', 'RESELL', 'EXCHANGE', 'DONATE'] as const).map(type => <button type="button" key={type} aria-pressed={value === type} onClick={() => onChange(type)}>{type ? listingTypeLabel[type as ListingDto['type']] : 'Semua jenis'}</button>)}</div>;
}
