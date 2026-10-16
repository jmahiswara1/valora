'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { TutorialAvailability, TutorialMutationResult, ItemDto } from '@valora/contracts';
import { ArrowRight, Wrench, BookOpen } from 'lucide-react';
import { api } from '@/lib/api';
import { useMe } from '@/lib/session';
import { Button, Notice, Field } from '@/components/ui/primitives';
import { useCriticalAction } from '@/hooks/use-critical-action';
import { ActionFeedback } from '@/components/ui/action-feedback';
import { AccountSkeleton } from '@/features/account/skeleton';
import { AccountError } from '@/features/account/error';
import { EnlargeImage, kindLabel } from './shared';

export function TutorialCatalog({ itemId }: { itemId: string }) {
  const router = useRouter(); const me = useMe(); const action = useCriticalAction('tutorial-create:' + itemId, me.data?.id ?? '');
  const item = useQuery({ queryKey: ['item', itemId], queryFn: () => api<ItemDto>('/items/' + itemId) });
  const data = useQuery({ queryKey: ['tutorial-availability', itemId], queryFn: () => api<TutorialAvailability>(`/items/${itemId}/repair-tutorials`) });
  const [selectedId, setSelectedId] = useState('');
  if (data.isPending || item.isPending) return <AccountSkeleton />;
  if (data.error || item.error || !data.data || !item.data) return <AccountError retry={() => { void data.refetch(); void item.refetch(); }}>Panduan barang gagal dimuat. Coba lagi.</AccountError>;
  const availability = data.data, guide = availability.guides.find(g => g.id === selectedId);
  return <div className="tutorial-page"><header className="account-page-heading"><div><Link className="back-link" href={'/app/barang/' + itemId}>← {item.data.title}</Link><h1>Panduan untuk barangmu.</h1><p>Ikuti langkah yang sesuai. Jeda kapan saja, lanjutkan saat siap.</p></div><Link className="button button-secondary" href={`/app/barang/${itemId}/perbaikan`}>Catat tindakan manual</Link></header>
    <ActionFeedback action={action} onRecovered={() => void data.refetch()} />
    {availability.unclosedSessionId && <section className="tutorial-resume"><BookOpen size={26} aria-hidden="true" /><div><h2>Ada panduan yang belum ditutup.</h2><p>Lanjutkan progres yang sudah tersimpan untuk barang ini.</p></div><Link className="button button-primary" href={'/app/panduan/' + availability.unclosedSessionId}>Lanjutkan panduan <ArrowRight size={17} aria-hidden="true" /></Link></section>}
    {!availability.enabled && !availability.unclosedSessionId && <Notice>Panduan baru belum tersedia untuk barang ini. Barang dalam kesepakatan tidak dapat memulai sesi. Kamu tetap bisa membaca panduan di bawah.</Notice>}
    {!availability.guides.length && <section className="account-empty"><Wrench size={28} aria-hidden="true" /><h2>Belum ada panduan yang cocok.</h2><p>Katalog akan bertambah. Kamu bisa mencatat perawatan atau perbaikan yang sudah dilakukan secara manual.</p><Link href={`/app/barang/${itemId}/perbaikan`} className="button button-secondary">Buka catatan manual</Link></section>}
    <div className="tutorial-guide-list">{availability.guides.map(g => <button type="button" key={g.id} onClick={() => setSelectedId(g.id)} aria-pressed={selectedId === g.id} className="tutorial-guide-choice"><span className="badge">{kindLabel(g.activityKind)}</span><h2>{g.title}</h2><p>{g.scope}</p><span className="tutorial-guide-meta">{g.steps.length} langkah <span>Lihat panduan <ArrowRight size={17} aria-hidden="true" /></span></span></button>)}</div>
    {guide && <section className="tutorial-guide-preview" aria-label={'Pratinjau ' + guide.title}><div><h2>{guide.title}</h2><p>{guide.scope}</p><h3>Siapkan alat</h3><ul>{guide.tools.map(t => <li key={t}>{t}</li>)}</ul><details><summary>Baca semua langkah dan batas panduan</summary><ol>{guide.steps.map(s => <li key={s.id}><h3>{s.title}</h3><p>{s.instruction}</p><p className="muted">Berhenti bila: {s.stop.join(' ')}</p></li>)}</ol><ul>{guide.exclusions.map(t => <li key={t}>{t}</li>)}</ul></details><form className="form-stack" onSubmit={async e => { e.preventDefault(); const problem = String(new FormData(e.currentTarget).get('problem') ?? ''); const result = await action.run<TutorialMutationResult>(`/items/${itemId}/repair-tutorial-sessions`, { guideId: guide.id, guideVersion: guide.version, expectedItemVersion: availability.itemVersion, problem }); if (result) router.push('/app/panduan/' + result.id); }}><Field htmlFor="tutorial-problem" label="Apa yang ingin kamu rawat atau perbaiki?" hint="Opsional. Hindari data pribadi. Hanya masuk ke konteks AI saat kamu mengirim pertanyaan."><textarea className="input" id="tutorial-problem" name="problem" maxLength={1500} rows={3} /></Field><Button disabled={action.pending || !availability.enabled || Boolean(availability.unclosedSessionId)}>Simpan sesi & siapkan langkah <ArrowRight size={17} aria-hidden="true" /></Button><p className="muted">Membuat sesi belum mengubah Listing, kondisi barang, atau Impact.</p></form><details><summary>Sumber dan versi panduan</summary><p>Versi {guide.version} · ditinjau 16 Oktober 2026.</p><ul>{guide.sources.map(s => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></li>)}</ul></details></div>{guide.steps[0].illustration && <EnlargeImage {...guide.steps[0].illustration} />}</section>}
  </div>;
}
