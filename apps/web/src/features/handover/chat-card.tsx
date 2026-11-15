'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, Truck } from 'lucide-react';
import type { HandoverDto, HandoverProposalDto, MessageDto, TransactionDto } from '@valora/contracts';
import { api } from '@/lib/api';
import { useCriticalAction } from '@/hooks/use-critical-action';
import { Button } from '@/components/ui/primitives';
import { ActionFeedback } from '@/components/ui/action-feedback';
import { HandoverForm, type HandoverMode } from './form';
import { ProposalDetails, partyName, proposalLabels } from './shared';

export function HandoverChatCard({ reference, actorId }: { reference: NonNullable<MessageDto['handover']>; actorId: string }) {
  const { transactionId, proposalId } = reference;
  const [mode, setMode] = useState<HandoverMode | null>(null);
  const action = useCriticalAction('handover:' + transactionId, actorId);
  const transaction = useQuery({ queryKey: ['transaction', transactionId], queryFn: () => api<TransactionDto>(`/transactions/${transactionId}`), refetchInterval: 15000, retry: false });
  const coordination = useQuery({ queryKey: ['handover', transactionId], queryFn: () => api<HandoverDto>(`/transactions/${transactionId}/handover`), refetchInterval: 15000, retry: false });
  const proposal = useQuery({ queryKey: ['handover-proposal', transactionId, proposalId], queryFn: () => api<HandoverProposalDto>(`/transactions/${transactionId}/handover/proposals/${proposalId}`), refetchInterval: 15000, retry: false });
  const retry = () => { void transaction.refetch(); void coordination.refetch(); void proposal.refetch(); };
  if (transaction.isError || coordination.isError || proposal.isError) return <div className="chat-handover-card"><h3>Usulan serah terima</h3><p>Detail usulan belum dapat dibuka.</p><Button variant="quiet" onClick={retry}>Coba lagi</Button></div>;
  if (!transaction.data || !coordination.data || !proposal.data) return <div className="chat-handover-card"><p role="status">Memuat usulan serah terima…</p></div>;
  const row = proposal.data, data = coordination.data, current = transaction.data;
  const pending = row.status === 'PENDING' && data.pending?.id === row.id;
  const pastTime = row.status === 'PENDING' && Date.parse(row.plannedAt) <= Date.parse(data.serverTime);
  const replaced = row.status === 'APPROVED' && data.agreed && data.agreed.id !== row.id;
  const status = pastTime ? 'Waktu usulan terlewati' : replaced ? 'Digantikan kesepakatan baru' : proposalLabels[row.status];
  const own = row.proposedById === actorId;
  return <div className="chat-handover-card" aria-label="Usulan serah terima">
    <div className="chat-handover-heading">{row.method === 'DELIVERY' ? <Truck size={20} aria-hidden="true" /> : <CalendarClock size={20} aria-hidden="true" />}<h3>Usulan {row.method === 'DELIVERY' ? 'pengiriman' : 'pertemuan'}</h3></div>
    <p className="chat-handover-author">{own ? 'Kamu mengusulkan' : `Diusulkan ${partyName(current, row.proposedById)}`}</p>
    <ProposalDetails proposal={row} transaction={current} compact />
    <p className="chat-handover-status" role="status">{status}</p>
    {pending && (data.permissions.canRespond || data.permissions.canWithdraw) && <div className="chat-handover-actions">
      {data.permissions.canRespond && <><Button disabled={action.pending || action.hasSaved()} onClick={() => setMode({ type: 'accept', proposal: row })}>Terima usulan</Button><Button variant="secondary" disabled={action.pending || action.hasSaved()} onClick={() => setMode({ type: 'reject', proposal: row })}>Tolak usulan</Button></>}
      {data.permissions.canWithdraw && <><p>Pihak lain perlu menyetujui usulan ini.</p><Button variant="secondary" disabled={action.pending || action.hasSaved()} onClick={() => setMode({ type: 'withdraw', proposal: row })}>Tarik usulan</Button></>}
    </div>}
    {pending && !data.permissions.canRespond && !data.permissions.canWithdraw && data.permissions.reason && <p>{data.permissions.reason}</p>}
    {!mode && <ActionFeedback action={action} />}
    {mode && <HandoverForm transaction={current} coordination={data} actorId={actorId} mode={mode} action={action} onClose={() => setMode(null)} />}
  </div>;
}
