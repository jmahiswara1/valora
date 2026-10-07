'use client';

import { MessagePhotos } from '../conversations/photos';
import type { EvidenceDto } from '@valora/contracts';
import { PrivatePhoto } from '../items/photo';
import { time } from './shared';

export function EvidenceList({ evidence }: { evidence: EvidenceDto[] }) {
  return <div className="evidence-list">{evidence.map((e) => <article key={e.id} className="evidence-entry"><span className="meta">Bukti {e.id.slice(0, 8)} · {time(e.createdAt)}</span>{e.note && <p className="preserve-lines">{e.note}</p>}{e.message && <blockquote><p>{e.message.body}</p><MessagePhotos photos={e.message.attachments} scope={{ scopeType: 'DISPUTE', scopeId: e.caseId }} /><small>Pesan terkait · {time(e.message.sentAt)}</small></blockquote>}<div className="evidence-photos">{e.media.map((m) => <PrivatePhoto key={m.id} mediaId={m.id} alt="Foto bukti kasus privat" />)}</div></article>)}</div>;
}
