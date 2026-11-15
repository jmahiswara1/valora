'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { QrCode, Check } from 'lucide-react';
import type { DemoPaymentDto, TransactionDto } from '@valora/contracts';
import { api } from '@/lib/api';
import { useCriticalAction } from '@/hooks/use-critical-action';
import { Button, Notice } from '@/components/ui/primitives';
import { ActionFeedback } from '@/components/ui/action-feedback';
import { HandoverDialog } from '@/features/handover/dialog';
import { money, time } from '@/features/transactions/shared';

const qrisImage = '/images/payments/qris-demo.jpg';
export function DemoPaymentPanel({ transaction, userId }: { transaction: TransactionDto; userId?: string }) {
  const applicable = transaction.type === 'RESELL' || (transaction.type === 'EXCHANGE' && Boolean(transaction.snapshot.cashAdjustment));
  const query = useQuery({ queryKey: ['demo-payment', transaction.id], queryFn: () => api<DemoPaymentDto>(`/transactions/${transaction.id}/demo-payment`), enabled: applicable && Boolean(userId), refetchInterval: 10000, retry: false });
  const action = useCriticalAction('demo-pay:' + transaction.id, userId ?? ''); const [open, setOpen] = useState(false);
  if (!applicable || !userId) return null;
  if (query.isPending) return <section className="app-panel payment-panel"><h2>Pembayaran QRIS</h2><p role="status">Memuat status pembayaran demo…</p></section>;
  if (query.isError || !query.data) return <section className="app-panel payment-panel"><h2>Pembayaran QRIS</h2><Notice kind="error">Status pembayaran demo belum dapat dimuat. <Button variant="quiet" onClick={() => void query.refetch()}>Coba lagi</Button></Notice></section>;
  const payment = query.data;
  if (payment.status === 'NOT_REQUIRED') return null;
  const name = (id: string | null) => transaction.snapshot.parties.find(party => party.id === id)?.displayName ?? 'Peserta';
  const paid = payment.status === 'PAID';
  return <section className="app-panel payment-panel" aria-label="Pembayaran QRIS demo">
    <div className="payment-heading"><h2>{transaction.type === 'EXCHANGE' ? 'Pembayaran tambahan uang' : 'Pembayaran'}</h2><span className="payment-demo-label">Demo · QRIS</span></div>
    <div className="payment-summary"><div><p className="payment-amount">{money(payment.amountIdr)}</p><p className="payment-parties">{name(payment.payerId)} kepada {name(payment.receiverId)}</p></div><span className={'payment-status' + (paid ? ' is-paid' : '')}>{paid && <Check size={16} aria-hidden="true" />}{paid ? 'Simulasi berhasil' : 'Belum disimulasikan'}</span></div>
    <p className="payment-demo-note">Simulasi saja, tanpa perpindahan uang. Jangan melakukan transfer sungguhan.</p>
    {paid ? <div className="payment-receipt"><p>Simulasi tercatat pada {payment.paidAt ? time(payment.paidAt) : 'transaksi ini'}.</p><p className="meta">ID simulasi: {payment.reference}</p><p>{['AWAITING_HANDOVER', 'ONE_SIDE_CONFIRMED'].includes(transaction.status) ? 'Lanjutkan koordinasi dan konfirmasi setelah barang diserahkan atau diterima.' : 'Ini adalah riwayat simulasi, bukan bukti transfer uang.'}</p></div> : <>
      {payment.reason && <Notice>{payment.reason}</Notice>}
      {!payment.reason && !payment.canSimulate && <p className="meta">Menunggu {name(payment.payerId)} menjalankan simulasi pembayaran.</p>}
    </>}
    <div className="form-actions"><Button variant={payment.canSimulate ? 'primary' : 'secondary'} disabled={action.pending} onClick={() => setOpen(true)}><QrCode size={18} aria-hidden="true" />{payment.canSimulate ? 'Bayar dengan QRIS' : 'Lihat QRIS demo'}</Button></div>
    {!open && <ActionFeedback action={action} />}
    {open && <QrisDialog payment={payment} action={action} onClose={() => setOpen(false)} />}
  </section>;
}

function QrisDialog({ payment, action, onClose }: { payment: DemoPaymentDto; action: ReturnType<typeof useCriticalAction>; onClose: () => void }) {
  const [version] = useState(payment.version), [acknowledged, setAcknowledged] = useState(false), [failed, setFailed] = useState(false);
  const stale = version !== payment.version;
  return <HandoverDialog title="Pembayaran QRIS demo" description="Demo saja. Jangan melakukan transfer sungguhan. Gunakan tombol simulasi untuk mencoba alurnya." busy={action.pending} unavailable={stale || action.hasSaved()} submitDisabled={!acknowledged || failed} onClose={onClose} submitLabel="Simulasikan pembayaran berhasil" onSubmit={payment.canSimulate ? async () => {
    if (!acknowledged) return;
    const result = await action.run(`/transactions/${payment.transactionId}/demo-payment/confirm`, { expectedVersion: version, demoOnly: true });
    if (result) onClose();
  } : undefined} footer={<>{stale && <Notice>Data transaksi berubah. Tutup dialog, periksa status terbaru, lalu buka kembali QRIS.</Notice>}<ActionFeedback action={action} onRecovered={onClose} /></>}>
    <div className="payment-dialog-amount"><span>Nominal simulasi</span><strong>{money(payment.amountIdr)}</strong></div>
    {payment.canSimulate && <label className="payment-demo-consent"><input type="checkbox" required checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} />Saya memahami ini hanya simulasi dan tidak melakukan transfer uang.</label>}
    <figure className="payment-qris-image">{failed ? <Notice kind="error">Gambar QRIS belum dapat dimuat. <Button variant="quiet" type="button" onClick={() => setFailed(false)}>Muat ulang gambar</Button></Notice> : <>
      {/* Preserve the supplied image as-is, including its header, merchant identity and footer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrisImage} alt="Gambar QRIS demo Valora lengkap" width={1200} height={1700} onError={() => setFailed(true)} />
    </>}<figcaption><a href={qrisImage} download="QRIS-demo-Valora.jpg">Unduh gambar QRIS utuh</a></figcaption></figure>
    {payment.status === 'PAID' && <Notice kind="success">Simulasi pembayaran sudah tercatat. Ini bukan bukti pembayaran sungguhan.</Notice>}
    {!payment.canSimulate && payment.status !== 'PAID' && <p className="meta">Hanya pihak pembayar yang dapat menjalankan simulasi.</p>}
  </HandoverDialog>;
}
