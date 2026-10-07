'use client';
import { useRef, useState, useId } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Bell, BellOff, Bookmark, Pencil, Trash2 } from 'lucide-react';
import { marketSearchUrl, type SavedSearchDto } from '@valora/contracts';
import { Button, Field, Input, Notice } from '@/components/ui/primitives';
import { AccountHeading } from '@/features/account/heading';
import { AccountSkeleton } from '@/features/account/skeleton';
import { useSavedSearches, useSearchActions } from './hooks';
import { SearchCriteria } from './criteria';
import { SearchDialog } from './dialog';

export function SavedSearchesPage() {
  const query = useSavedSearches(), actions = useSearchActions(), heading = useRef<HTMLDivElement>(null), list = useRef<HTMLUListElement>(null), locked = useRef(false);
  const [dialog, setDialog] = useState<{ kind: 'rename' | 'remove'; row: SavedSearchDto } | null>(null), [feedback, setFeedback] = useState(''), [error, setError] = useState('');
  async function toggle(row: SavedSearchDto) {
    if (locked.current) return; locked.current = true; setError(''); setFeedback('');
    try { await actions.mutateAsync({ kind: 'update', id: row.id, input: { expectedVersion: row.version, alertsEnabled: !row.alertsEnabled } }); setFeedback(`Notifikasi ${row.name} ${row.alertsEnabled ? 'dinonaktifkan' : 'diaktifkan'}.`); }
    catch (e) { setError(e instanceof Error ? e.message : 'Pengaturan gagal diubah. Coba lagi.'); }
    finally { locked.current = false; }
  }
  return <section className="saved-search-page">
    <div ref={heading} tabIndex={-1}><AccountHeading title="Pencarian tersimpan" description="Simpan kriteriamu. Ikuti barang baru yang kamu perlukan." actions={<Link href="/market" className="button button-secondary">Jelajahi Market <ArrowUpRight size={17} aria-hidden="true" /></Link>} /></div>
    <p className="saved-search-note">Pencarian ini hanya terlihat olehmu. {query.data ? `${query.data.length} dari 10 pencarian tersimpan.` : 'Maksimum 10 pencarian per akun.'}</p>
    {feedback && <p className="saved-search-feedback" role="status">{feedback}</p>}{error && <Notice kind="error">{error}</Notice>}
    {query.isPending ? <AccountSkeleton /> : query.isError && !query.data ? <Notice kind="error">Pencarian gagal dimuat. <button type="button" className="link-button" onClick={() => query.refetch()}>Coba lagi</button></Notice> : <>
      {query.isError && <Notice kind="error">Daftar terbaru belum dapat dimuat. <button type="button" className="link-button" onClick={() => query.refetch()}>Coba lagi</button></Notice>}
      {query.data?.length ? <ul ref={list} className="saved-search-list">{query.data.map(row => <li key={row.id} data-search-id={row.id}>
        <div className="saved-search-row-content"><h2>{row.name}</h2><SearchCriteria filters={row.filters} /><p className="saved-search-status">{row.alertsEnabled ? <Bell size={15} aria-hidden="true" /> : <BellOff size={15} aria-hidden="true" />}{row.alertsEnabled ? 'Notifikasi aktif' : 'Notifikasi nonaktif'}</p></div>
        <div className="saved-search-row-actions"><Link className="button button-secondary" href={marketSearchUrl(row.filters, row.sort) + '#market-results'}>Lihat hasil <ArrowUpRight size={16} aria-hidden="true" /></Link>
          <Button variant="quiet" disabled={actions.pending} aria-label={`${row.alertsEnabled ? 'Nonaktifkan' : 'Aktifkan'} notifikasi ${row.name}`} aria-pressed={row.alertsEnabled} onClick={() => void toggle(row)}>{row.alertsEnabled ? <BellOff size={18} /> : <Bell size={18} />}</Button>
          <Button variant="quiet" disabled={actions.pending} aria-label={`Ubah nama ${row.name}`} onClick={() => setDialog({ kind: 'rename', row })}><Pencil size={18} /></Button>
          <Button variant="quiet" disabled={actions.pending} aria-label={`Hapus ${row.name}`} onClick={() => setDialog({ kind: 'remove', row })}><Trash2 size={18} /></Button></div>
      </li>)}</ul> : <div className="saved-search-empty"><Bookmark size={32} strokeWidth={1.5} aria-hidden="true" /><h2>Belum ada pencarian tersimpan.</h2><p>Atur kata kunci atau filter di Market, lalu pilih Simpan pencarian.</p><Link href="/market" className="button button-primary">Temukan barang <ArrowUpRight size={17} aria-hidden="true" /></Link></div>}
    </>}
    {dialog && <ManageSearchDialog key={dialog.kind + dialog.row.id} kind={dialog.kind} row={dialog.row} onClose={() => setDialog(null)} onDone={message => {
      const currentIndex = query.data?.findIndex(row => row.id === dialog.row.id) ?? 0; const removed = dialog.kind === 'remove';
      setDialog(null); setFeedback(message); setError('');
      if (removed) requestAnimationFrame(() => { const next = list.current?.querySelectorAll<HTMLAnchorElement>('a')[Math.min(currentIndex, (query.data?.length ?? 1) - 2)]; (next ?? heading.current)?.focus(); });
    }} />}
  </section>;
}
function ManageSearchDialog({ kind, row, onClose, onDone }: { kind: 'rename' | 'remove'; row: SavedSearchDto; onClose: () => void; onDone: (message: string) => void }) {
  const actions = useSearchActions(), id = useId(), locked = useRef(false), [name, setName] = useState(row.name), [error, setError] = useState('');
  return <SearchDialog title={kind === 'rename' ? 'Ubah nama pencarian' : 'Hapus pencarian?'} description={kind === 'rename' ? 'Kriteria pencarian dan pengaturan notifikasi tetap mengikuti pencarian ini.' : `${row.name} akan dihapus. Notifikasi berikutnya dari pencarian ini akan berhenti.`} onClose={onClose}>
    <form className="form-stack" onSubmit={async event => {
      event.preventDefault(); if (locked.current) return; locked.current = true; setError('');
      try { await actions.mutateAsync(kind === 'remove' ? { kind: 'remove', id: row.id } : { kind: 'update', id: row.id, input: { expectedVersion: row.version, name: name.trim() } }); onDone(kind === 'remove' ? `${row.name} dihapus.` : 'Nama pencarian diperbarui.'); }
      catch (e) { setError(e instanceof Error ? e.message : 'Perubahan gagal. Coba lagi.'); }
      finally { locked.current = false; }
    }}>
      {kind === 'rename' && <Field label="Nama pencarian" htmlFor={id}><Input id={id} value={name} maxLength={80} disabled={actions.pending} onChange={event => setName(event.target.value)} /></Field>}
      {error && <Notice kind="error">{error}</Notice>}<div className="saved-search-actions"><Button type="submit" variant={kind === 'remove' ? 'danger' : 'primary'} disabled={actions.pending || kind === 'rename' && !name.trim()}>{actions.pending ? 'Memproses…' : kind === 'rename' ? 'Simpan nama' : 'Hapus pencarian'}</Button><Button variant="quiet" disabled={actions.pending} onClick={onClose}>Kembali</Button></div>
    </form>
  </SearchDialog>;
}
