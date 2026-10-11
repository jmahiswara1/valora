'use client';

import type { CategoryDto } from '@valora/contracts';
import { Button, Notice } from '@/components/ui/primitives';
import { currentValue, proposedValue, suggestionFields, type PhotoFormValues, type SuggestionField, type usePhotoAnalysis } from './use-photo-analysis';

const labels: Record<SuggestionField, string> = { title: 'Nama barang', category: 'Kategori dan subkategori', description: 'Cerita singkat', conditionSummary: 'Kondisi saat ini', issueSummary: 'Kendala atau kerusakan' };
type Analysis = ReturnType<typeof usePhotoAnalysis>;
export function PhotoAnalysis({ analysis, values, categories, disabled, onApply }: {
  analysis: Analysis; values: PhotoFormValues; categories: CategoryDto[]; disabled: boolean; onApply: () => void;
}) {
  const result = analysis.result;
  function categoryName(code: string | null, subcode: string | null) {
    const category = categories.find(value => value.code === code);
    return [category?.name ?? code, category?.subcategories.find(value => value.code === subcode)?.name ?? subcode].filter(Boolean).join(' / ');
  }
  return <div className="photo-analysis">
    <h3>Bantu isi dari foto</h3>
    <p>Pilih 1–3 foto, lalu minta saran nama, kategori, cerita, dan kondisi yang terlihat.</p>
    <p className="field-hint" id="photo-ai-disclosure">Foto terpilih dikirim ke layanan AI. Hindari foto yang memuat wajah, alamat, atau dokumen pribadi. AI tidak memeriksa fungsi, keamanan, atau harga barang.</p>
    <div className="photo-analysis-actions"><Button type="button" variant="secondary" disabled={disabled || analysis.busy || analysis.cooling || !analysis.photos.length || !categories.length} aria-describedby="photo-ai-disclosure" onClick={() => void analysis.analyze()}>{analysis.busy ? analysis.progress || 'Menyiapkan analisis…' : result ? 'Analisis ulang foto' : 'Analisis foto dengan AI'}</Button><span className="meta" aria-live="polite">{analysis.photos.length}/3 foto dipilih</span></div>
    {analysis.cooling && analysis.retryAt && <p className="field-hint">Bisa dicoba kembali setelah {new Date(analysis.retryAt).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' })} WIB.</p>}
    {analysis.busy && <p role="status" className="field-hint">Biasanya selesai dalam satu menit. Kamu tetap bisa mengisi formulir.</p>}
    {analysis.error && <Notice kind="error">{analysis.error}{result && ' Saran sebelumnya masih tersedia untuk foto yang sama.'}</Notice>}
    {result && <section className="photo-analysis-result" aria-label="Saran dari foto">
      <div className="photo-analysis-heading"><h3>{result.status === 'NEEDS_PHOTOS' ? 'Foto tambahan diperlukan' : 'Saran dari foto'}</h3>{result.cached && <span className="meta">Hasil sebelumnya</span>}</div>
      <p className="photo-analysis-summary" role="status">{result.summary}</p>
      <p className="field-hint">Pilih saran yang ingin dipakai. Kolom kosong dipilih otomatis; perubahan manual membatalkan pilihan pada kolom tersebut. Saran belum tersimpan sebagai barang.</p>
      <fieldset className="photo-suggestions" disabled={disabled || analysis.busy}><legend className="sr-only">Pilih saran per kolom</legend>
        {suggestionFields.filter(field => proposedValue(result.suggestions, field)).map(field => <div className="photo-suggestion" key={field}>
          <label className="photo-choice"><input type="checkbox" checked={analysis.selected.includes(field)} onChange={() => analysis.chooseField(field)} /><strong>{labels[field]}</strong></label>
          <dl className="photo-comparison"><div><dt>Saat ini</dt><dd>{field === 'category' ? categoryName(values.categoryCode, values.subcategoryCode) || 'Belum diisi' : currentValue(values, field) || 'Belum diisi'}</dd></div><div><dt>Saran AI</dt><dd>{field === 'category' ? categoryName(result.suggestions.categoryCode, result.suggestions.subcategoryCode) : proposedValue(result.suggestions, field)}</dd></div></dl>
        </div>)}
      </fieldset>
      {(result.observations.length > 0 || result.requestedPhotos.length > 0) && <details className="photo-analysis-details"><summary>Lihat pengamatan dan foto yang diperlukan</summary>{result.observations.length > 0 && <><h4>Yang terlihat pada foto</h4><ul>{result.observations.map((text, index) => <li key={index}>{text}</li>)}</ul></>}{result.requestedPhotos.length > 0 && <><h4>Foto yang membantu</h4><ul>{result.requestedPhotos.map((text, index) => <li key={index}>{text}</li>)}</ul></>}</details>}
      {suggestionFields.some(field => proposedValue(result.suggestions, field)) && <Button type="button" disabled={disabled || analysis.busy || !analysis.selected.length} onClick={onApply}>Terapkan pilihan{analysis.selected.length ? ` (${analysis.selected.length})` : ''}</Button>}
      <p className="field-hint">Tinjau saran sebelum menyimpan. Informasi yang tidak terlihat pada foto tetap perlu kamu isi sendiri.</p>
    </section>}
    {analysis.applied && <Notice kind="success">{analysis.applied}</Notice>}
  </div>;
}
