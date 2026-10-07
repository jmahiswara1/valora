'use client';

import { ApiClientError } from '@/lib/api';
import { usePassport } from './hooks';
import { PassportQrButton } from './qr';
import Image from 'next/image';
import { Notice } from "../../components/ui/primitives";
import Link from 'next/link';
import { Heading } from '../../components/ui/heading';
import { LoadState } from '../../components/ui/query-state';
import { dateTime } from '../../lib/date';

export function PassportPage({ itemId, owner = false }: { itemId: string; owner?: boolean }) {
  const result = usePassport(itemId, owner);
  const data = result.isError ? undefined : result.data;
  if (!owner && result.isError && result.error instanceof ApiClientError && result.error.status === 404) return <div className="empty-state passport-unavailable"><span className="eyebrow">VALORA / PASSPORT</span><h1>Passport belum tersedia.</h1><p>Riwayat barang ini belum tersedia atau tidak dapat diakses publik.</p><Link href="/market" className="button button-secondary">Jelajahi Market</Link></div>;
  return <><Heading eyebrow={owner ? 'BARANG / PASSPORT SAYA' : 'VALORA / PASSPORT'} title={data?.title ?? 'Riwayat barang'}>Perjalanan barang yang tercatat di Valora.</Heading><LoadState query={result} skeleton={owner} />
    <div className={data ? 'passport-share-actions' : undefined}><PassportQrButton itemId={itemId} owner={owner} available={Boolean(data)} /></div>
    {data && !result.isError && <>
    <section className="passport-summary"><span className="eyebrow">ITEM {data.itemId}</span><p>{data.categoryCode} · {owner ? 'Proyeksi pemilik saat ini' : 'Riwayat publik'}</p>{data.description && <p className="preserve-lines">{data.description}</p>}{data.media.length > 0 && <div className="passport-photos">{data.media.map((m, index) => <Image unoptimized loading={index === 0 ? 'eager' : 'lazy'} key={m.id} src={m.url} width={320} height={240} alt="Foto barang yang pernah dipublikasikan" />)}</div>}</section>
    {data.visibility === 'LIMITED' && !owner ? <Notice>Riwayat publik sedang dibatasi selama peninjauan.</Notice> : <><p className="muted">Laporan pemilik menggambarkan informasi yang diberikan pengguna. Konfirmasi transfer mencatat proses serah terima; pemeriksaan fisik dan pembayaran tetap dilakukan para pihak.</p>{owner && data.visibility !== 'PUBLIC' && <Notice>Visibilitas publik: {data.visibility}. Riwayat pemilik tetap dapat dibaca.</Notice>}
      {data.timeline.length ? <ol className="passport-timeline">{data.timeline.map((entry) => <li key={entry.id}><div className="passport-date"><time dateTime={entry.occurredAt}>{dateTime(entry.occurredAt)}</time><span className="badge">{entry.origin === 'USER_REPORTED' ? 'Dilaporkan pemilik' : entry.origin === 'ADMIN_AUTHORIZED' ? 'Putusan admin' : 'Tercatat oleh sistem'}</span></div><div><h2>{entry.summary}</h2>{entry.assessment && <p>{entry.assessment.status} · {entry.assessment.score === null ? 'Score belum tersedia' : `Score ${entry.assessment.score}/100 · ${entry.assessment.label}`} · {entry.assessment.ruleVersion}{entry.assessment.historical && ' · historis'}{!entry.assessment.valid && ' · dibatalkan'}</p>}{entry.repair && <><p>{entry.repair.summary}</p><p className="muted">Kondisi sesudahnya: {entry.repair.afterCondition} · {entry.repair.status}</p></>}{entry.type === 'CORRECTION' && <p className="muted">Dicatat {dateTime(entry.recordedAt)}{entry.correctionOfId && ' · mengoreksi event terdahulu'}</p>}</div></li>)}</ol> : <div className="empty-state"><h2>Belum ada riwayat yang dapat ditampilkan.</h2></div>}</>}
    {owner && <Link href={`/app/barang/${itemId}`} className="button button-secondary">Kembali ke barang</Link>}
  </>}</>;
}
