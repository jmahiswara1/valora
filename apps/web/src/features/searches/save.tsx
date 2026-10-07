'use client';
import { useState, useRef, useId } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bookmark, Check } from 'lucide-react';
import { marketSearchKeys, marketSearchKey, marketSearchUrl, type MarketSearchQuery } from '@valora/contracts';
import { useSession } from '@/lib/session';
import { Button, Field, Input, Notice } from '@/components/ui/primitives';
import { useSavedSearches, useSearchActions } from './hooks';
import { SearchDialog } from './dialog';
import { SearchCriteria, useSearchLabels } from './criteria';

export function SaveSearchButton(props: { query: MarketSearchQuery; valid: boolean }) {
  const session = useSession();
  return <SaveSearchControl key={session.session?.user?.id ?? session.state} {...props} />;
}
function SaveSearchControl({ query, valid }: { query: MarketSearchQuery; valid: boolean }) {
  const session = useSession(), router = useRouter(), saved = useSavedSearches();
  const [open, setOpen] = useState(false), [feedback, setFeedback] = useState('');
  const hasCriteria = marketSearchKeys.some(key => query[key] !== undefined), existing = saved.data?.find(row => marketSearchKey(row.filters) === marketSearchKey(query));
  const authenticated = session.state === 'AUTHENTICATED';
  return <div className="saved-search-save">
    <Button variant="secondary" disabled={!valid || !hasCriteria || (session.state !== 'GUEST' && !authenticated) || (authenticated && saved.isPending)} aria-describedby={!hasCriteria ? 'saved-search-hint' : undefined} onClick={() => {
      if (session.state === 'GUEST') { router.push('/masuk?next=' + encodeURIComponent(marketSearchUrl(query, query.sort))); return; }
      if (existing) { router.push('/app/pencarian'); return; }
      setFeedback(''); setOpen(true);
    }}>{existing ? <Check size={17} aria-hidden="true" /> : <Bookmark size={17} aria-hidden="true" />}{existing ? 'Pencarian tersimpan' : 'Simpan pencarian'}</Button>
    {feedback && <span role="status">{feedback} <Link href="/app/pencarian">Kelola pencarian</Link></span>}
    {!hasCriteria && <span className="saved-search-hint" id="saved-search-hint">Gunakan kata kunci atau filter untuk menyimpan pencarian.</span>}
    {saved.isError && <span role="alert">Status pencarian gagal dimuat. <button type="button" className="link-button" onClick={() => saved.refetch()}>Coba lagi</button></span>}
    {session.state === 'UNAVAILABLE' && <span role="alert">Sesi belum dapat diperiksa. <button type="button" className="link-button" onClick={() => session.refresh()}>Coba lagi</button></span>}
    {open && authenticated && <SaveSearchDialog key={session.session?.user?.id} query={query} onClose={() => setOpen(false)} onSaved={name => { setOpen(false); setFeedback(`${name} tersimpan.`); }} />}
  </div>;
}
function SaveSearchDialog({ query, onClose, onSaved }: { query: MarketSearchQuery; onClose: () => void; onSaved: (name: string) => void }) {
  const { defaultName } = useSearchLabels(query), actions = useSearchActions();
  const [name, setName] = useState(defaultName), [enabled, setEnabled] = useState(true), [error, setError] = useState('');
  const id = useId(), input = useRef<HTMLInputElement>(null), locked = useRef(false);
  return <SearchDialog title="Simpan pencarian" description="Temukan kembali pencarianmu dan ikuti barang baru yang cocok." onClose={onClose}>
    <SearchCriteria filters={query} /><form className="form-stack" onSubmit={async event => {
      event.preventDefault(); if (locked.current) return;
      if (!name.trim()) { setError('Isi nama pencarian.'); input.current?.focus(); return; }
      locked.current = true; setError('');
      try { const { sort, ...filters } = query; const result = await actions.mutateAsync({ kind: 'create', input: { name: name.trim(), filters, sort, alertsEnabled: enabled } }); if ('name' in result) onSaved(result.name); }
      catch (e) { setError(e instanceof Error ? e.message : 'Pencarian gagal disimpan. Coba lagi.'); }
      finally { locked.current = false; }
    }}>
      <Field label="Nama pencarian" htmlFor={id}><Input ref={input} id={id} maxLength={80} value={name} disabled={actions.pending} onChange={event => { setName(event.target.value); setError(''); }} aria-invalid={error && !name.trim() ? true : undefined} /></Field>
      <label className="saved-search-check"><input type="checkbox" checked={enabled} disabled={actions.pending} onChange={event => setEnabled(event.target.checked)} /><span>Beritahu saya saat ada barang baru yang cocok.</span></label>
      <p className="saved-search-help">Notifikasi masuk ke akunmu. Barang yang sudah terbit tidak mengirim notifikasi baru.</p>
      {error && <Notice kind="error">{error}</Notice>}
      <div className="saved-search-actions"><Button type="submit" disabled={actions.pending || !name.trim()}>{actions.pending ? 'Menyimpan…' : 'Simpan pencarian'}</Button><Button variant="quiet" disabled={actions.pending} onClick={onClose}>Kembali</Button></div>
    </form>
  </SearchDialog>;
}
