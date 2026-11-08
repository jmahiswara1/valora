'use client';
import { useId, useState } from 'react';
import { ChatLink } from '@/features/conversations/link';
import { CalendarClock, MessageCircle, ChevronRight, ArrowUpRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { HandoverDto, TransactionDto } from '@valora/contracts';
import { api } from '@/lib/api';
import { useMe } from '@/lib/session';
import { useCriticalAction } from '@/hooks/use-critical-action';
import { ActionFeedback } from '@/components/ui/action-feedback';
import { Button, Notice } from '@/components/ui/primitives';
import { ProposalDetails, partyName } from './shared';
import { HandoverForm, type HandoverMode } from './form';
export function HandoverPanel({ transaction }: { transaction: TransactionDto }) {
  const me = useMe(); const action = useCriticalAction('handover:' + transaction.id, me.data?.id ?? ''); const [mode, setMode] = useState<HandoverMode | null>(null);
  const optionsId = useId();
  const query = useQuery({ queryKey: ['handover', transaction.id], queryFn: () => api<HandoverDto>(`/transactions/${transaction.id}/handover`), refetchInterval: 15000, retry: false });
  if (query.isPending) return <section className="app-panel"><h2>Koordinasi serah terima</h2><p role="status">Memuat jadwal dan pengiriman…</p></section>;
  if (query.isError || !query.data) return <section className="app-panel"><h2>Koordinasi serah terima</h2><Notice kind="error">Koordinasi belum dapat dimuat. <Button variant="quiet" onClick={() => query.refetch()}>Coba lagi</Button></Notice></section>;
  const data = query.data;
  const otherPartyId = me.data?.id === transaction.sellerOrDonorId ? transaction.buyerOrRecipientId : transaction.sellerOrDonorId;
  const chatContent = <><MessageCircle size={21} strokeWidth={1.7} aria-hidden="true" /><span className="handover-option-copy"><strong id={optionsId + '-chat'}>Langsung ke chat</strong><span id={optionsId + '-chat-description'}>{transaction.conversationId ? `Diskusikan serah terima dengan ${partyName(transaction, otherPartyId)}.` : 'Percakapan untuk transaksi ini belum tersedia.'}</span></span><ArrowUpRight size={18} aria-hidden="true" /></>;
  return <section className="app-panel handover-panel" aria-label="Koordinasi serah terima"><div className="handover-heading"><h2>Koordinasi serah terima</h2></div>
    {(data.permissions.canPropose || transaction.conversationId) && <div className="handover-coordination-options" role="group" aria-label="Pilihan koordinasi serah terima">
      {data.permissions.canPropose && <button type="button" className="handover-coordination-option" aria-labelledby={optionsId + '-form'} aria-describedby={optionsId + '-form-description'} disabled={action.pending || action.hasSaved()} onClick={() => setMode({ type: 'propose' })}>
        <CalendarClock size={21} strokeWidth={1.7} aria-hidden="true" /><span className="handover-option-copy"><strong id={optionsId + '-form'}>{data.agreed ? 'Usulkan perubahan' : 'Atur serah terima'}</strong><span id={optionsId + '-form-description'}>Lewat formulir: usulkan metode, jadwal, dan detail serah terima.</span></span><ChevronRight size={18} aria-hidden="true" />
      </button>}
      {transaction.conversationId ? <ChatLink className="handover-coordination-option" conversationId={transaction.conversationId} prefetch={false} aria-labelledby={optionsId + '-chat'} aria-describedby={optionsId + '-chat-description'}>{chatContent}</ChatLink> : <button type="button" className="handover-coordination-option" disabled aria-labelledby={optionsId + '-chat'} aria-describedby={optionsId + '-chat-description'}>{chatContent}</button>}
    </div>}
    {data.agreed ? <div className="handover-section"><h3>Kesepakatan saat ini</h3><ProposalDetails proposal={data.agreed} transaction={transaction} /></div> : <p>Belum ada jadwal yang disepakati. Atur pertemuan atau pengiriman bersama pihak lain. Konfirmasi barang tetap dapat dilakukan ketika serah terima sudah terjadi.</p>}
    {data.pending && <div className="handover-section handover-pending"><div className="handover-heading"><h3>Usulan dari {partyName(transaction, data.pending.proposedById)}</h3><span className="badge">Menunggu tanggapan</span></div>{data.agreed && <p className="meta">Kesepakatan saat ini tetap berlaku sampai perubahan disetujui.</p>}<ProposalDetails proposal={data.pending} transaction={transaction} /><div className="form-actions">{data.permissions.canRespond && <><Button disabled={action.pending || action.hasSaved()} onClick={() => setMode({ type: 'accept', proposal: data.pending! })}>Tinjau usulan</Button><Button variant="quiet" disabled={action.pending || action.hasSaved()} onClick={() => setMode({ type: 'reject', proposal: data.pending! })}>Tolak usulan</Button></>}{data.permissions.canWithdraw && <Button variant="quiet" disabled={action.pending || action.hasSaved()} onClick={() => setMode({ type: 'withdraw', proposal: data.pending! })}>Tarik usulan</Button>}</div></div>}
    {data.agreed?.method === 'DELIVERY' && <div className="handover-section"><h3>Pengiriman per barang</h3>{data.directions.map(direction => <div className="handover-shipment" key={direction.itemId}><h4>{direction.title}</h4><p className="meta">{partyName(transaction, direction.fromUserId)} → {partyName(transaction, direction.toUserId)}</p>{direction.shipment ? direction.shipment.purgedAt ? <p className="meta">Informasi resi telah dihapus sesuai retensi.</p> : <dl className="handover-facts"><div><dt>Kurir</dt><dd>{direction.shipment.courier}</dd></div><div><dt>Resi</dt><dd>{direction.shipment.trackingNumber}</dd></div>{direction.shipment.reason && <div><dt>Alasan perbaikan</dt><dd>{direction.shipment.reason}</dd></div>}</dl> : <p className="meta">Pengirim belum mencatat resi.</p>}{direction.received && <p className="meta">Penerimaan sudah dikonfirmasi; resi dikunci.</p>}{direction.canRecord && <Button variant="secondary" disabled={action.pending || action.hasSaved()} onClick={() => setMode({ type: 'shipment', direction, proposal: data.agreed! })}>{direction.shipment ? 'Perbaiki resi' : 'Catat resi'}</Button>}</div>)}<p className="meta">Status kurir tidak dipantau otomatis. Tetap konfirmasikan penerimaan setelah barang diterima.</p></div>}
    {data.permissions.reason && !data.permissions.canRespond && !data.permissions.canWithdraw && <p className="meta handover-lock">{data.permissions.reason}</p>}{!mode && <ActionFeedback action={action} />}
    {mode && <HandoverForm transaction={transaction} coordination={data} actorId={me.data?.id ?? ''} mode={mode} action={action} onClose={() => setMode(null)} />}
  </section>;
}
