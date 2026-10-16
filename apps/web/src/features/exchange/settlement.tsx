'use client';

import { useState } from 'react';
import type { TransactionDto } from '@valora/contracts';
import type { useCriticalAction } from '@/hooks/use-critical-action';
import { Button, Notice } from '@/components/ui/primitives';
import { ConfirmAction } from '@/components/ui/confirm-dialog';
import { ActionFeedback } from '@/components/ui/action-feedback';
import { money } from '@/features/market/process-shared';

export function CashSettlement({ transaction: row, userId, action }: { transaction: TransactionDto; userId?: string; action: ReturnType<typeof useCriticalAction> }) {
  const [confirmation, setConfirmation] = useState<{ row: TransactionDto; kind: 'SENT' | 'RECEIVED' } | null>(null);
  const cash = row.snapshot.cashAdjustment;
  if (row.type !== 'EXCHANGE' || !cash) return null;
  const payerId = cash.payer === 'OWNER' ? row.sellerOrDonorId : row.buyerOrRecipientId;
  const receiverId = cash.payer === 'OWNER' ? row.buyerOrRecipientId : row.sellerOrDonorId;
  const name = (id: string) => row.snapshot.parties.find(party => party.id === id)?.displayName ?? 'Peserta';
  const active = ['AWAITING_HANDOVER', 'ONE_SIDE_CONFIRMED'].includes(row.status);
  return <section className="app-panel exchange-settlement"><h2>Tambahan uang</h2><p className="exchange-cash-amount">{money(cash.amountIdr)}</p><p>{name(payerId)} memberikan kepada {name(receiverId)}.</p><p className="meta">Pembayaran langsung antar pengguna. Konfirmasi adalah laporan pengguna; Valora tidak memeriksa transfer bank.</p><div className="confirmation-list">{[{ actorId: payerId, kind: 'SENT' as const }, { actorId: receiverId, kind: 'RECEIVED' as const }].map(expected => {
    const done = row.cashConfirmations?.find(value => value.actorId === expected.actorId && value.kind === expected.kind);
    const label = expected.kind === 'SENT' ? 'Uang sudah diserahkan' : 'Uang sudah diterima';
    return <div className="confirmation-row" key={expected.kind}><div><strong>{name(expected.actorId)}</strong><p>{label}</p>{done && <small>Laporan pengguna · {new Date(done.confirmedAt).toLocaleString('id-ID')}</small>}</div>{done ? <span className="badge">Sudah dikonfirmasi</span> : active && userId === expected.actorId ? <Button type="button" disabled={action.pending || action.hasSaved()} onClick={() => setConfirmation({ row, kind: expected.kind })}>Konfirmasi {expected.kind === 'SENT' ? 'uang diserahkan' : 'uang diterima'}</Button> : <span className="meta">{row.status === 'DISPUTED' ? 'Ditahan selama sengketa' : active ? 'Menunggu pihak ini' : 'Tidak dikonfirmasi'}</span>}</div>;
  })}</div>{active && <p className="field-hint">Kepemilikan menunggu konfirmasi seluruh barang dan tambahan uang.</p>}{row.status === 'CANCELLED' && <Notice>Pengembalian tambahan uang diatur langsung oleh kedua pihak.</Notice>}{row.resolutionOrigin === 'ADMIN_AUTHORIZED' && <Notice>Penyelesaian melalui putusan admin tidak menjadi bukti pembayaran.</Notice>}
    {confirmation && <ConfirmAction title={confirmation.kind === 'SENT' ? 'Konfirmasi penyerahan tambahan uang' : 'Konfirmasi penerimaan tambahan uang'} buttonLabel="Simpan konfirmasi uang" pending={action.pending} acknowledgement={`Saya menyatakan tambahan uang ${money(cash.amountIdr)} benar-benar sudah ${confirmation.kind === 'SENT' ? 'saya serahkan' : 'saya terima'}.`} onClose={() => setConfirmation(null)} onConfirm={async () => { const result = await action.run(`/transactions/${row.id}/cash-confirmations`, { expectedVersion: confirmation.row.version, kind: confirmation.kind }); if (result) setConfirmation(null); }}><p>{money(cash.amountIdr)} · {name(payerId)} kepada {name(receiverId)}</p><p>Konfirmasikan hanya berdasarkan penyerahan atau penerimaan yang benar-benar terjadi.</p><ActionFeedback action={action} onRecovered={() => setConfirmation(null)} /></ConfirmAction>}
  </section>;
}
