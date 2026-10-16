'use client';

import { useRef, useState, type FormEvent } from 'react';
import type { OfferDto } from '@valora/contracts';
import { Button, Field, Input, Notice } from '@/components/ui/primitives';
import { ExchangePicker } from './picker';
import { CashEditor, cashDraft, cashValue } from './cash';

export function CounterForm({ offer, userId, pending, stale, onSubmit, onClose }: {
  offer: OfferDto; userId: string; pending: boolean; stale: boolean; onSubmit: (body: unknown) => void; onClose: () => void;
}) {
  const exchange = offer.listing.type === 'EXCHANGE', terms = offer.currentRevision?.exchangeTerms;
  const owner = offer.bidderId !== userId;
  const own = owner ? terms?.ownerItems ?? [] : terms?.bidderItems ?? [];
  const [ids, setIds] = useState(own.map(item => item.id)), [cash, setCash] = useState(cashDraft(terms?.cashAdjustment));
  const [price, setPrice] = useState(String(offer.currentRevision?.priceIdr ?? '')), [message, setMessage] = useState('');
  const request = useRef<{ signature: string; id: string } | null>(null);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending || stale || exchange && (!terms || !ids.length)) return;
    const body = { expectedVersion: offer.version, ...(exchange ? { exchangeItemIds: ids, cashAdjustment: cashValue(cash) } : { priceIdr: Number(price) }), ...(message.trim() ? { message: message.trim() } : {}) };
    if (exchange) { const signature = JSON.stringify(body); if (request.current?.signature !== signature) request.current = { signature, id: crypto.randomUUID() }; onSubmit({ ...body, clientRequestId: request.current.id }); }
    else onSubmit(body);
  }
  return <form className="offer-counter-form" onSubmit={submit} aria-busy={pending}><h3>Usulkan kesepakatan baru</h3>{stale && <Notice>Penawaran sudah berubah. Tutup formulir dan tinjau revisi terbaru.</Notice>}<fieldset disabled={pending || stale}>{exchange ? <><p className="field-hint">Ubah barang milikmu dan tambahan uang. Paket pihak lain tetap mengikuti revisi yang sedang kamu tanggapi.</p><ExchangePicker listingId={offer.listingId} selected={ids} onChange={setIds} anchorId={owner ? own[0]?.id : undefined} snapshots={own} /><CashEditor value={cash} onChange={setCash} /></> : <Field label="Nominal counteroffer" htmlFor={`counter-${offer.id}`}><Input id={`counter-${offer.id}`} required type="number" min={1} max={1_000_000_000_000} step={1} value={price} onChange={event => setPrice(event.target.value)} /></Field>}<Field label="Pesan (opsional)" htmlFor={`counter-message-${offer.id}`}><Input id={`counter-message-${offer.id}`} maxLength={500} value={message} onChange={event => setMessage(event.target.value)} /></Field></fieldset><div className="form-actions"><Button type="submit" disabled={pending || stale || exchange && (!terms || !ids.length)}>{pending ? 'Mengirim…' : 'Kirim counteroffer'}</Button><Button type="button" variant="quiet" disabled={pending} onClick={onClose}>Tutup formulir</Button></div></form>;
}
