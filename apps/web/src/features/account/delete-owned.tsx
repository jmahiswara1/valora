'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button, Notice } from '@/components/ui/primitives';
import { ConfirmAction } from '@/components/ui/confirm-dialog';

export function DeleteOwnedButton({ kind, id, version, disabled = false }: { kind: 'listing' | 'item'; id: string; version: number; disabled?: boolean }) {
  const router = useRouter(), cache = useQueryClient(), running = useRef(false);
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [targetVersion, setTargetVersion] = useState(version);
  const label = kind === 'listing' ? 'Hapus Listing' : 'Hapus barang';
  async function remove() {
    if (running.current || disabled) return; running.current = true; setBusy(true); setError('');
    try {
      await api(`/${kind === 'listing' ? 'listings' : 'items'}/${id}`, { method: 'DELETE', body: { expectedVersion: targetVersion } });
      setOpen(false); router.replace(kind === 'listing' ? '/app/listings' : '/app/barang');
      for (const key of [['items'], ['item'], ['listings'], ['market'], ['favorites']]) void cache.invalidateQueries({ queryKey: key });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Penghapusan belum berhasil. Coba lagi.'); }
    finally { running.current = false; setBusy(false); }
  }
  return <><Button variant="danger" disabled={disabled || busy} onClick={() => { setTargetVersion(version); setError(''); setOpen(true); }}><Trash2 size={16} aria-hidden="true" />{label}</Button>{open && <ConfirmAction title={label} buttonLabel={label} pending={busy} onClose={() => setOpen(false)} onConfirm={remove}>
    <p>{kind === 'listing' ? 'Listing dihapus dari Market dan daftar milikmu. Penawaran terbuka akan berakhir. Barang tetap tersimpan di Barang saya.' : 'Barang dihapus dari Barang saya. Listing terkait ikut dihapus dan penawaran terbuka akan berakhir.'}</p><p>Riwayat transaksi dan kepemilikan tetap tersimpan.</p>{error && <Notice kind="error">{error}</Notice>}
  </ConfirmAction>}</>;
}
