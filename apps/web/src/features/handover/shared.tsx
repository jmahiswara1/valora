import { ApiClientError } from '@/lib/api';
import type { HandoverProposalDto, TransactionDto } from '@valora/contracts';
export const zones = { 'Asia/Jakarta': { label: 'WIB', offset: 7 }, 'Asia/Makassar': { label: 'WITA', offset: 8 }, 'Asia/Jayapura': { label: 'WIT', offset: 9 } } as const;
export type Zone = keyof typeof zones;
export const methodLabel = (method: string) => method === 'MEETUP' ? 'Bertemu langsung' : 'Pengiriman';
export function plannedTime(value: string, zone: Zone) { return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: zone }).format(new Date(value)) + ' ' + zones[zone].label; }
export function localTime(value: string, zone: Zone) { return new Date(Date.parse(value) + zones[zone].offset * 3600000).toISOString().slice(0, 16); }
export function utcTime(value: string, zone: Zone) { return new Date(Date.parse(value + ':00Z') - zones[zone].offset * 3600000).toISOString(); }
export const proposalLabels = { PENDING: 'Menunggu tanggapan', APPROVED: 'Disepakati', REJECTED: 'Ditolak', WITHDRAWN: 'Ditarik', EXPIRED: 'Kedaluwarsa', INVALIDATED: 'Ditutup karena status transaksi berubah' };
export const partyName = (transaction: TransactionDto, id: string) => transaction.snapshot.parties.find(party => party.id === id)?.displayName ?? 'Peserta';
export function ProposalDetails({ proposal, transaction }: { proposal: HandoverProposalDto; transaction: TransactionDto }) {
  const details = proposal.privateDetails;
  return <div className="handover-details"><dl className="handover-facts"><div><dt>Metode</dt><dd>{methodLabel(proposal.method)}</dd></div><div><dt>{proposal.method === 'MEETUP' ? 'Waktu pertemuan' : 'Perkiraan diterima'}</dt><dd><time dateTime={proposal.plannedAt}>{plannedTime(proposal.plannedAt, proposal.timeZone)}</time></dd></div></dl>
    {!details ? <p className="meta">Detail privat telah dihapus sesuai retensi.</p> : <>{details.location && <div><h4>Lokasi pertemuan</h4><p className="preserve-lines">{details.location}</p></div>}{details.destinations.map(destination => <div key={destination.userId}><h4>Alamat penerimaan · {partyName(transaction, destination.userId)}</h4><p>{destination.details.recipientName} · {destination.details.phone}</p><p className="preserve-lines">{destination.details.address}</p></div>)}{details.note && <div><h4>Catatan</h4><p className="preserve-lines">{details.note}</p></div>}{details.responseReason && <div><h4>Alasan penolakan</h4><p className="preserve-lines">{details.responseReason}</p></div>}</>}
  </div>;
}

export function privateReadDenied(error: unknown) { return error instanceof ApiClientError && ([401, 403, 404, 410].includes(error.status) || error.code === 'SESSION_CHANGED'); }
