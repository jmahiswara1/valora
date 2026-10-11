'use client';

import { useEffect, useRef, useState } from 'react';
import { photoAnalysisSchema, type ItemDto, type PhotoAnalysisDto, type PhotoSuggestions } from '@valora/contracts';
import { api, ApiClientError } from '@/lib/api';
import { photoError } from './uploads';

export type SuggestionField = 'title' | 'category' | 'description' | 'conditionSummary' | 'issueSummary';
export type PhotoFormValues = { title: string; categoryCode: string; subcategoryCode: string; description: string; conditionSummary: string; issueSummary: string };
export const suggestionFields: SuggestionField[] = ['title', 'category', 'description', 'conditionSummary', 'issueSummary'];
export function proposedValue(suggestions: PhotoSuggestions, field: SuggestionField) {
  return field === 'category' ? suggestions.categoryCode : suggestions[field];
}
export function currentValue(values: PhotoFormValues, field: SuggestionField) {
  return field === 'category' ? values.categoryCode || values.subcategoryCode : values[field];
}

export function usePhotoAnalysis({ item, files, values, upload }: {
  item?: ItemDto; files: File[]; values: PhotoFormValues; upload: (file: File) => Promise<string>;
}) {
  const scope = `${item?.id ?? 'new'}:${item?.version ?? 0}`;
  const [photos, setPhotos] = useState<string[]>(item?.media[0] ? ['m:' + item.media[0].id] : []);
  const [stored, setStored] = useState<{ scope: string; value: PhotoAnalysisDto } | null>(null);
  const [selected, setSelected] = useState<SuggestionField[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [progress, setProgress] = useState('');
  const [retryAt, setRetryAt] = useState<string | null>(null), [clock, setClock] = useState(0);
  const [applied, setApplied] = useState('');
  const generation = useRef(0), running = useRef(false), dirty = useRef(new Set<SuggestionField>());
  const result = stored?.scope === scope ? stored.value : null;
  const cooling = !!retryAt && Date.parse(retryAt) > clock;
  useEffect(() => () => { generation.current++; }, []);
  useEffect(() => {
    if (!retryAt) return;
    const timer = setTimeout(() => setClock(Date.now()), Math.max(0, Date.parse(retryAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [retryAt]);
  useEffect(() => {
    if (!result?.expiresAt) return;
    const timer = setTimeout(() => { setStored(null); setSelected([]); setApplied('Hasil analisis sudah kedaluwarsa. Analisis kembali jika diperlukan.'); }, Math.max(0, Date.parse(result.expiresAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [result]);
  function clear() {
    generation.current++; running.current = false; setBusy(false); setStored(null); setSelected([]); setError(''); setApplied(''); setProgress(''); setRetryAt(null);
  }
  function resetPhotos(next: File[]) {
    clear(); setPhotos(item?.media[0] ? ['m:' + item.media[0].id] : next[0] ? ['u:0'] : []);
  }
  function choosePhoto(id: string) {
    if (!photos.includes(id) && photos.length >= 3) return;
    clear(); setPhotos(photos.includes(id) ? photos.filter(value => value !== id) : [...photos, id]);
  }
  function edited(field: SuggestionField) {
    dirty.current.add(field); setSelected(current => current.filter(value => value !== field)); setApplied('');
  }
  async function analyze() {
    if (running.current || cooling || !photos.length) return;
    const invalid = photoError(files, item?.media.length);
    if (invalid) { setError(invalid); return; }
    const token = ++generation.current;
    running.current = true; dirty.current.clear(); setBusy(true); setError(''); setApplied('');
    try {
      const uploadTicketIds: string[] = [], mediaIds: string[] = [];
      for (const id of photos) {
        if (id.startsWith('m:')) mediaIds.push(id.slice(2));
        else {
          const file = files[Number(id.slice(2))];
          if (!file) throw new Error('Foto terpilih sudah berubah. Pilih foto kembali.');
          setProgress('Menyiapkan foto terpilih…'); uploadTicketIds.push(await upload(file));
        }
        if (generation.current !== token) return;
      }
      setProgress('AI sedang mengamati foto…');
      const response = photoAnalysisSchema.parse(await api('/items/photo-analysis', {
        method: 'POST', timeoutMs: 75_000,
        body: { ...(item ? { itemId: item.id, expectedVersion: item.version } : {}), uploadTicketIds, mediaIds },
      }));
      if (generation.current !== token) return;
      setRetryAt(response.retryAt); setClock(Date.now());
      if (response.status === 'UNAVAILABLE') {
        const reason = response.reason;
        setError(reason === 'USER_QUOTA' ? 'Kuota AI harian akunmu sudah habis. Kamu tetap bisa mengisi manual.' :
          reason === 'APP_QUOTA' ? 'Kuota AI harian Valora sudah habis. Kamu tetap bisa mengisi manual.' :
          reason === 'BUSY' ? 'AI sedang melayani permintaan lain. Coba lagi sebentar.' :
          reason === 'TIMEOUT' ? 'Analisis memerlukan terlalu lama. Coba lagi atau isi manual.' :
          reason === 'DISABLED' || reason === 'NOT_CONFIGURED' ? 'Analisis foto belum diaktifkan. Kamu tetap bisa mengisi manual.' :
          'Analisis belum berhasil. Coba lagi atau isi manual.');
        return;
      }
      setStored({ scope, value: response });
      setSelected(suggestionFields.filter(field => proposedValue(response.suggestions, field) && !currentValue(values, field).trim() && !dirty.current.has(field)));
    } catch (cause) {
      if (generation.current !== token) return;
      if (cause instanceof ApiClientError && ([401, 403, 404, 409].includes(cause.status) || cause.code === 'SESSION_CHANGED')) { setStored(null); setSelected([]); }
      if (cause instanceof ApiClientError && cause.code === 'RATE_LIMITED') { setRetryAt(new Date(Date.now() + 60_000).toISOString()); setClock(Date.now()); }
      setError(cause instanceof ApiClientError ? cause.message : 'Analisis belum berhasil. Periksa koneksi, lalu coba lagi atau isi manual.');
    } finally {
      if (generation.current === token) { running.current = false; setBusy(false); setProgress(''); }
    }
  }
  function chooseField(field: SuggestionField) {
    setSelected(current => current.includes(field) ? current.filter(value => value !== field) : [...current, field]); setApplied('');
  }
  function apply(callback: (suggestions: PhotoSuggestions, fields: SuggestionField[]) => void) {
    if (!result || busy || !selected.length || !result.expiresAt || Date.parse(result.expiresAt) <= Date.now()) return;
    callback(result.suggestions, selected); setApplied(`${selected.length} saran diterapkan. Periksa isinya, lalu simpan barang jika sudah sesuai.`); setSelected([]);
  }
  return { photos, result, selected, busy, progress, error, cooling, retryAt, applied, analyze, choosePhoto, chooseField, edited, resetPhotos, clear, apply };
}
