'use client';

import type { ItemDto } from '@valora/contracts';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from "../../components/ui/primitives";
import { PrivatePhoto } from './photo';

export function PrivateItemGallery({ item, onRemove, removing }: { item: ItemDto; onRemove: (id: string) => void; removing: boolean }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = item.media.find((photo) => photo.id === selectedId) ?? item.media[0];
  const selectedIndex = item.media.findIndex(photo => photo.id === selected?.id);
  return <section aria-label={`Galeri ${item.title}`}><div className="account-gallery-main"><PrivatePhoto key={selected?.id ?? 'empty'} mediaId={selected?.id} alt={`Foto ${item.title}`} /></div>
    {item.media.length > 0 && <div className="account-gallery-thumbs">{item.media.map((photo, index) => <div className="account-gallery-thumb" key={photo.id}><button type="button" aria-label={`Lihat foto ${index + 1} ${item.title}`} aria-pressed={photo.id === selected?.id} onClick={() => setSelectedId(photo.id)}><PrivatePhoto mediaId={photo.id} alt={`Foto ${index + 1}`} /></button></div>)}</div>}
    <div className="item-gallery-toolbar"><p role="status" aria-live="polite">{selected ? `Foto ${selectedIndex + 1} dari ${item.media.length}` : 'Belum ada foto'}</p>{selected && <Button type="button" variant="quiet" disabled={removing || Boolean(item.reservedByTransactionId)} aria-label={`Hapus foto ${selectedIndex + 1} ${item.title}`} onClick={() => onRemove(selected.id)}><Trash2 size={16} aria-hidden="true" />Hapus foto</Button>}</div>
  </section>;
}
