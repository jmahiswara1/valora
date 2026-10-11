'use client';

import { useState, useEffect, useRef, type FormEvent } from 'react';
import type { ItemDto, CategoryDto, PhotoSuggestions } from '@valora/contracts';
import { useRouter } from 'next/navigation';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api, ApiClientError } from '@/lib/api';
import { Select } from '@/components/ui/select';
import { Notice, Button, Field, Input } from '@/components/ui/primitives';
import { PrivatePhoto } from './photo';
import { PhotoAnalysis } from './photo-analysis';
import { usePhotoAnalysis, type PhotoFormValues, type SuggestionField } from './use-photo-analysis';
import { photoError, useItemUploads } from './uploads';

const optionalStrings = ['functionSummary', 'conditionSummary', 'completenessSummary', 'issueSummary'] as const;
const optionalNumbers = ['purchaseYear', 'originalPriceIdr', 'estimatedWeightGrams'] as const;
const detailLabels = { functionSummary: 'Fungsi saat ini', conditionSummary: 'Kondisi saat ini', completenessSummary: 'Kelengkapan', issueSummary: 'Kendala atau kerusakan' };

function SelectedPhoto({ file }: { file: File }) {
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    if (image.current) image.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  // Browser object URLs are temporary local previews and need no image optimizer.
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={image} alt={'Pratinjau ' + file.name} />; // impeccable-disable-line broken-image: The effect assigns a local File URL and revokes it on cleanup, including Strict Mode remounts.
}

export function ItemForm({ item }: { item?: ItemDto }) {
  const router = useRouter(), cache = useQueryClient();
  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api<CategoryDto[]>('/categories'), staleTime: 300_000 });
  const [values, setValues] = useState<PhotoFormValues>({ title: item?.title ?? '', description: item?.description ?? '', categoryCode: item?.categoryCode ?? '', subcategoryCode: item?.subcategoryCode ?? '', conditionSummary: item?.conditionSummary ?? '', issueSummary: item?.issueSummary ?? '' });
  const [files, setFiles] = useState<File[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false), [progress, setProgress] = useState('');
  const running = useRef(false), version = useRef(item?.version);
  const uploads = useItemUploads(item?.id);
  const analysis = usePhotoAnalysis({ item, files, values, upload: uploads.upload });
  const selectedCategory = categories.data?.find(entry => entry.code === values.categoryCode);
  function change(key: keyof PhotoFormValues, value: string) {
    analysis.edited(key === 'categoryCode' || key === 'subcategoryCode' ? 'category' : key);
    setValues(current => ({ ...current, [key]: value, ...(key === 'categoryCode' ? { subcategoryCode: '' } : {}) }));
  }
  function apply(suggestions: PhotoSuggestions, selected: SuggestionField[]) {
    setValues(current => {
      const next = { ...current };
      for (const field of selected) {
        if (field === 'category') {
          if (!categories.data?.some(category => category.code === suggestions.categoryCode && (!suggestions.subcategoryCode || category.subcategories.some(sub => sub.code === suggestions.subcategoryCode)))) continue;
          next.categoryCode = suggestions.categoryCode ?? ''; next.subcategoryCode = suggestions.subcategoryCode ?? '';
        } else if (suggestions[field] !== null) next[field] = suggestions[field];
      }
      return next;
    });
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (running.current) return; setError('');
    if (!item && !files.length) return setError('Tambahkan minimal satu foto sebelum menyimpan barang.');
    const invalid = photoError(files, item?.media.length);
    if (invalid) return setError(invalid);
    const data = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = { title: values.title, description: values.description, categoryCode: values.categoryCode, subcategoryCode: values.subcategoryCode || null };
    for (const key of optionalStrings) payload[key] = String(data.get(key) ?? '').trim() || null;
    for (const key of optionalNumbers) payload[key] = String(data.get(key) ?? '').trim() ? Number(data.get(key)) : null;
    running.current = true; setBusy(true); analysis.clear();
    let detailSaved = false;
    try {
      if (item) {
        setProgress('Menyimpan detail…');
        let updated = await api<ItemDto>('/items/' + item.id, { method: 'PATCH', body: { ...payload, expectedVersion: version.current ?? item.version } });
        detailSaved = true; version.current = updated.version; cache.setQueryData(['item', item.id], updated);
        for (let i = 0; i < files.length; i++) {
          setProgress('Mengunggah foto ' + (i + 1) + ' dari ' + files.length + '…');
          const ticketId = await uploads.upload(files[i]);
          updated = await api<ItemDto>('/items/' + item.id + '/media/finalize', { method: 'POST', body: { ticketId } });
          version.current = updated.version; uploads.consumed(files[i]); cache.setQueryData(['item', item.id], updated);
          setFiles(current => current.filter(file => file !== files[i]));
        }
        void cache.invalidateQueries({ queryKey: ['items'] }); router.push('/app/barang/' + item.id);
      } else {
        const uploadTicketIds: string[] = [];
        for (let i = 0; i < files.length; i++) { setProgress('Mengunggah foto ' + (i + 1) + ' dari ' + files.length + '…'); uploadTicketIds.push(await uploads.upload(files[i])); }
        setProgress('Menyimpan barang…');
        const created = await api<ItemDto>('/items', { method: 'POST', body: { ...payload, uploadTicketIds } });
        files.forEach(uploads.consumed); void cache.invalidateQueries({ queryKey: ['items'] }); router.push('/app/barang/' + created.id);
      }
    } catch (cause) {
      const message = cause instanceof ApiClientError ? cause.message : 'Periksa koneksi dan coba lagi.';
      setError(detailSaved ? 'Detail barang sudah tersimpan, tetapi foto berikutnya gagal: ' + message : 'Gagal menyimpan barang: ' + message);
    } finally { running.current = false; setBusy(false); setProgress(''); }
  }
  return <form className="item-form" onSubmit={submit} aria-busy={busy}>
    {error && <Notice kind="error">{error}</Notice>}
    {categories.isError && <Notice kind="error">Kategori gagal dimuat. <Button type="button" variant="quiet" onClick={() => categories.refetch()}>Coba lagi</Button></Notice>}
    <p className="meta">Nama, kategori, cerita, dan minimal satu foto diperlukan. Detail tambahan boleh dilengkapi nanti.</p>
    <fieldset className="account-form-fields" disabled={busy}>
      <section className="item-form-section">
        <h2>Foto barang</h2><p>Minimal satu foto, maksimal delapan. Format JPEG, PNG, atau WebP; masing-masing maksimal 8 MiB.</p>
        <label className="upload-zone" htmlFor="photos"><strong>Pilih foto dari perangkat</strong><span>Foto diproses untuk menghapus metadata lokasi.</span><input id="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => { const selected = Array.from(event.target.files ?? []); setFiles(selected); setError(photoError(selected, item?.media.length)); analysis.resetPhotos(selected); }} /></label>
        {(item?.media.length || files.length) ? <fieldset className="photo-analysis-selection"><legend>Pilih foto untuk analisis AI</legend><p className="field-hint">Foto yang tidak dipilih tetap disimpan bersama barang.</p><div className="photo-previews">
          {item?.media.map((media, index) => <div className="photo-preview" key={media.id}><PrivatePhoto mediaId={media.id} alt={'Foto barang tersimpan ' + (index + 1)} /><label className="photo-choice"><input type="checkbox" checked={analysis.photos.includes('m:' + media.id)} disabled={analysis.photos.length >= 3 && !analysis.photos.includes('m:' + media.id)} onChange={() => analysis.choosePhoto('m:' + media.id)} /><span>Foto tersimpan {index + 1}</span></label></div>)}
          {files.map((file, index) => <div className="photo-preview" key={file.name + file.lastModified + index}><SelectedPhoto file={file} /><label className="photo-choice"><input type="checkbox" checked={analysis.photos.includes('u:' + index)} disabled={analysis.photos.length >= 3 && !analysis.photos.includes('u:' + index)} onChange={() => analysis.choosePhoto('u:' + index)} /><span>Foto baru {index + 1}</span></label><small className="photo-file-name">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MiB</small></div>)}
        </div></fieldset> : null}
        <PhotoAnalysis analysis={analysis} values={values} categories={categories.data ?? []} disabled={busy || categories.isPending || categories.isError} onApply={() => analysis.apply(apply)} />
      </section>
      <section className="item-form-section"><h2>Kenalkan barangmu</h2><p>Informasi dasar yang membantu kamu mengenali barang ini.</p><div className="form-stack">
        <Field label="Nama barang" htmlFor="title"><Input id="title" name="title" required minLength={3} maxLength={120} value={values.title} onChange={event => change('title', event.target.value)} placeholder="Contoh: Keyboard mekanis" /></Field>
        <Field label="Kategori" htmlFor="category"><Select className="select" id="category" required value={values.categoryCode} onChange={event => change('categoryCode', event.target.value)}><option value="">Pilih kategori</option>{categories.data?.map(entry => <option key={entry.code} value={entry.code}>{entry.name}</option>)}</Select></Field>
        {selectedCategory?.subcategories.length ? <Field label="Subkategori" htmlFor="subcategory" hint="Boleh dikosongkan sebagai draft; penilaian memerlukan subkategori yang didukung."><Select className="select" id="subcategory" value={values.subcategoryCode} onChange={event => change('subcategoryCode', event.target.value)}><option value="">Pilih subkategori</option>{selectedCategory.subcategories.map(entry => <option key={entry.code} value={entry.code}>{entry.name}</option>)}</Select></Field> : null}
        <Field label="Cerita singkat" htmlFor="description" hint="Minimal 10 karakter, maksimal 3.000 karakter."><textarea className="textarea" id="description" name="description" required minLength={10} maxLength={3000} value={values.description} onChange={event => change('description', event.target.value)} placeholder="Ceritakan asal dan penggunaan barang ini." /></Field>
      </div></section>
      <section className="item-form-section"><h2>Detail tambahan</h2><p>Isi yang kamu ketahui sekarang. Sisanya dapat dilengkapi nanti.</p><div className="form-grid">
        <Field label="Tahun pembelian" htmlFor="purchaseYear"><Input id="purchaseYear" name="purchaseYear" type="number" min={1900} max={new Date().getFullYear()} defaultValue={item?.purchaseYear ?? ''} /></Field>
        <Field label="Harga awal (Rp)" htmlFor="originalPriceIdr"><Input id="originalPriceIdr" name="originalPriceIdr" type="number" min={0} step={1} defaultValue={item?.originalPriceIdr ?? ''} /></Field>
        <Field label="Perkiraan berat (gram)" htmlFor="estimatedWeightGrams"><Input id="estimatedWeightGrams" name="estimatedWeightGrams" type="number" min={1} step={1} defaultValue={item?.estimatedWeightGrams ?? ''} /></Field>
      </div><div className="form-stack item-form-details">{optionalStrings.map(key => <Field key={key} label={detailLabels[key]} htmlFor={key}>{key === 'conditionSummary' || key === 'issueSummary' ? <textarea className="textarea" id={key} name={key} maxLength={1500} value={values[key]} onChange={event => change(key, event.target.value)} /> : <textarea className="textarea" id={key} name={key} maxLength={1500} defaultValue={item?.[key] ?? ''} />}</Field>)}</div></section>
    </fieldset>
    <div className="form-actions"><Button disabled={busy || categories.isPending || categories.isError}>{busy ? progress : item ? 'Simpan perubahan' : 'Simpan barang'}</Button>{!busy && <Link className="button button-quiet" href={item ? '/app/barang/' + item.id : '/app/barang'}>Batal</Link>}</div>
  </form>;
}
