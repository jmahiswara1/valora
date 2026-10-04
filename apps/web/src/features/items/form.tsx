'use client';

import { Select } from '@/components/ui/select';

import { useState, useEffect, useRef, type FormEvent } from 'react';
import type { ItemDto, CategoryDto } from '@valora/contracts';
import { useRouter } from 'next/navigation';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api';
import { Notice, Button, Field, Input } from "../../components/ui/primitives";
import Link from 'next/link';

const optionalStrings = ['functionSummary', 'conditionSummary', 'completenessSummary', 'issueSummary'] as const;

const optionalNumbers = ['purchaseYear', 'originalPriceIdr', 'estimatedWeightGrams'] as const;

function SelectedPhoto({ file }: { file: File }) {
  const [url] = useState(() => URL.createObjectURL(file));
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return <div className="photo-preview">
    {/* Browser object URLs are temporary local previews and need no image optimizer. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={url} alt={`Pratinjau ${file.name}`} />
    <small>{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MiB</small>
  </div>;
}

export function ItemForm({ item }: { item?: ItemDto }) {
  const router = useRouter(); const cache = useQueryClient();
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api<CategoryDto[]>('/categories'), staleTime: 300_000 });
  const [category, setCategory] = useState(item?.categoryCode ?? ''); const [subcategory, setSubcategory] = useState(item?.subcategoryCode ?? '');
  const [files, setFiles] = useState<File[]>([]); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [progress, setProgress] = useState('');
  const running = useRef(false);
  const selectedCategory = categories.data?.find((entry) => entry.code === category);
  async function upload(file: File, itemId?: string): Promise<string> {
    const ticket = await api<{ ticketId: string; uploadUrl: string }>(itemId ? `/items/${itemId}/media/tickets` : '/media/tickets', { method: 'POST', body: { fileName: file.name, mime: file.type, bytes: file.size } });
    await api(ticket.uploadUrl.replace('/api/v1', ''), { method: 'PUT', body: file });
    return ticket.ticketId;
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (running.current) return; setError('');
    if (!item && !files.length) return setError('Tambahkan minimal satu foto sebelum menyimpan barang.');
    if (files.length + (item?.media.length ?? 0) > 8) return setError('Maksimal delapan foto per barang.');
    if (files.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024)) return setError('Gunakan JPEG, PNG, atau WebP, masing-masing maksimal 8 MiB.');
    const data = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = { title: data.get('title'), description: data.get('description'), categoryCode: category, subcategoryCode: subcategory || null };
    for (const key of optionalStrings) payload[key] = String(data.get(key) ?? '').trim() || null;
    for (const key of optionalNumbers) payload[key] = String(data.get(key) ?? '').trim() ? Number(data.get(key)) : null;
    running.current = true; setBusy(true);
    let detailSaved = false;
    try {
      if (item) {
        setProgress('Menyimpan detail…');
        let updated = await api<ItemDto>(`/items/${item.id}`, { method: 'PATCH', body: { ...payload, expectedVersion: item.version } });
        detailSaved = true;
        cache.setQueryData(['item', item.id], updated);
        for (let i = 0; i < files.length; i++) {
          setProgress(`Mengunggah foto ${i + 1} dari ${files.length}…`);
          const ticketId = await upload(files[i], item.id);
          updated = await api<ItemDto>(`/items/${item.id}/media/finalize`, { method: 'POST', body: { ticketId } });
          cache.setQueryData(['item', item.id], updated);
          setFiles((current) => current.slice(1));
        }
        cache.invalidateQueries({ queryKey: ['items'] });
        router.push(`/app/barang/${item.id}`);
      } else {
        const uploadTicketIds: string[] = [];
        for (let i = 0; i < files.length; i++) { setProgress(`Mengunggah foto ${i + 1} dari ${files.length}…`); uploadTicketIds.push(await upload(files[i])); }
        setProgress('Menyimpan barang…');
        const created = await api<ItemDto>('/items', { method: 'POST', body: { ...payload, uploadTicketIds } });
        cache.invalidateQueries({ queryKey: ['items'] }); router.push(`/app/barang/${created.id}`);
      }
    } catch (e) {
      const cause = e instanceof ApiClientError ? e.message : 'Periksa koneksi dan coba lagi.';
      setError(detailSaved ? `Detail barang sudah tersimpan, tetapi foto berikutnya gagal: ${cause}` : `Gagal menyimpan barang: ${cause}`);
    } finally { running.current = false; setBusy(false); setProgress(''); }
  }
    return <form className="item-form" onSubmit={submit} aria-busy={busy}>
    {error && <Notice kind="error">{error}</Notice>}
    {categories.isError && <Notice kind="error">Kategori gagal dimuat. <Button type="button" variant="quiet" onClick={() => categories.refetch()}>Coba lagi</Button></Notice>}
    <p className="meta">Nama, kategori, cerita, dan minimal satu foto diperlukan. Detail tambahan boleh dilengkapi nanti.</p>
    <fieldset className="account-form-fields" disabled={busy}>
    <section className="item-form-section"><h2>Kenalkan barangmu</h2><p>Informasi dasar yang membantu kamu mengenali barang ini.</p><div className="form-stack"><Field label="Nama barang" htmlFor="title"><Input id="title" name="title" required minLength={3} maxLength={120} defaultValue={item?.title} placeholder="Contoh: Keyboard mekanis" /></Field><Field label="Kategori" htmlFor="category"><Select className="select" id="category" required value={category} onChange={(e) => { setCategory(e.target.value); setSubcategory(''); }}><option value="">Pilih kategori</option>{categories.data?.map((entry) => <option key={entry.code} value={entry.code}>{entry.name}</option>)}</Select></Field>{selectedCategory?.subcategories.length ? <Field label="Subkategori" htmlFor="subcategory" hint="Boleh dikosongkan sebagai draft; penilaian memerlukan subkategori yang didukung."><Select className="select" id="subcategory" value={subcategory} onChange={(e) => setSubcategory(e.target.value)}><option value="">Pilih subkategori</option>{selectedCategory.subcategories.map((entry) => <option key={entry.code} value={entry.code}>{entry.name}</option>)}</Select></Field> : null}<Field label="Cerita singkat" htmlFor="description" hint="Minimal 10 karakter, maksimal 3.000 karakter."><textarea className="textarea" id="description" name="description" required minLength={10} maxLength={3000} defaultValue={item?.description} placeholder="Ceritakan asal dan penggunaan barang ini." /></Field></div></section>
    <section className="item-form-section"><h2>Foto barang</h2><p>Minimal satu foto, maksimal delapan. Format JPEG, PNG, atau WebP; masing-masing maksimal 8 MiB.</p>{item?.media.length ? <p style={{ marginBottom: 15 }}>{item.media.length} foto sudah tersimpan. Kamu bisa mengelolanya di halaman detail.</p> : null}<label className="upload-zone" htmlFor="photos"><strong>Pilih foto dari perangkat</strong><br /><span className="muted">Foto diproses untuk menghapus metadata lokasi.</span><input id="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple style={{ display: 'block', margin: '14px auto 0', maxWidth: '100%' }} onChange={(e) => { const selected = Array.from(e.target.files ?? []); setFiles(selected); setError(''); }} /></label>{files.length > 0 && <div className="photo-previews" style={{ marginTop: 15 }}>{files.map((file, index) => <SelectedPhoto file={file} key={file.name + file.lastModified + index} />)}</div>}</section>
    <section className="item-form-section"><h2>Detail tambahan</h2><p>Isi yang kamu ketahui sekarang. Sisanya dapat dilengkapi nanti.</p><div className="form-grid"><Field label="Tahun pembelian" htmlFor="purchaseYear"><Input id="purchaseYear" name="purchaseYear" type="number" min={1900} max={new Date().getFullYear()} defaultValue={item?.purchaseYear ?? ''} /></Field><Field label="Harga awal (Rp)" htmlFor="originalPriceIdr"><Input id="originalPriceIdr" name="originalPriceIdr" type="number" min={0} step={1} defaultValue={item?.originalPriceIdr ?? ''} /></Field><Field label="Perkiraan berat (gram)" htmlFor="estimatedWeightGrams"><Input id="estimatedWeightGrams" name="estimatedWeightGrams" type="number" min={1} step={1} defaultValue={item?.estimatedWeightGrams ?? ''} /></Field></div><div className="form-stack" style={{ marginTop: 20 }}>{optionalStrings.map((key) => <Field key={key} label={{ functionSummary: 'Fungsi saat ini', conditionSummary: 'Kondisi saat ini', completenessSummary: 'Kelengkapan', issueSummary: 'Kendala atau kerusakan' }[key]} htmlFor={key}><textarea className="textarea" id={key} name={key} maxLength={1500} defaultValue={item?.[key] ?? ''} /></Field>)}</div></section>
    </fieldset><div className="form-actions"><Button disabled={busy || categories.isPending || categories.isError}>{busy ? progress : item ? 'Simpan perubahan' : 'Simpan barang'}</Button>{!busy && <Link className="button button-quiet" href={item ? `/app/barang/${item.id}` : '/app/barang'}>Batal</Link>}</div>
  </form>;
}
