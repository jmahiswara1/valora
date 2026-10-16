'use client';

import { useId } from 'react';
import type { CashAdjustment } from '@valora/contracts';
import { Field, Input } from '@/components/ui/primitives';
import { Select } from '@/components/ui/select';

export type CashDraft = { payer: 'NONE' | 'OWNER' | 'BIDDER'; amount: string };
export const cashDraft = (cash?: CashAdjustment | null): CashDraft => ({ payer: cash?.payer ?? 'NONE', amount: cash ? String(cash.amountIdr) : '' });
export const cashValue = (draft: CashDraft): CashAdjustment | null => draft.payer === 'NONE' ? null : { payer: draft.payer, amountIdr: Number(draft.amount) };
export function CashEditor({ value, onChange }: { value: CashDraft; onChange: (value: CashDraft) => void }) {
  const id = useId();
  return <div className="exchange-cash-editor"><Field label="Tambahan uang" htmlFor={id}><Select id={id} value={value.payer} onChange={event => onChange({ ...value, payer: event.target.value as CashDraft['payer'] })}><option value="NONE">Tanpa tambahan uang</option><option value="BIDDER">Penawar memberikan uang</option><option value="OWNER">Pemilik Listing memberikan uang</option></Select></Field>{value.payer !== 'NONE' && <Field label="Nominal tambahan (Rp)" htmlFor={id + '-amount'} hint="Kesepakatan antar pengguna, bukan pembayaran melalui Valora."><Input id={id + '-amount'} type="number" min={1} max={1_000_000_000_000} step={1} inputMode="numeric" required value={value.amount} onChange={event => onChange({ ...value, amount: event.target.value })} /></Field>}<p className="field-hint">Jika memakai tambahan uang, pemberi dan penerima perlu mengonfirmasi setelah uang benar-benar diserahkan.</p></div>;
}
