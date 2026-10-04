'use client';

import { Select } from '@/components/ui/select';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import { assessmentCreateSchema } from '@valora/contracts';
import type { AssessmentCreateInput, AssessmentDto, IndicatorKey, ItemDto, RubricDto } from '@valora/contracts';
import { api, ApiClientError } from '@/lib/api';
import { Button, Field, Input, Notice } from "@/components/ui/primitives";
import { AccountError } from '@/features/account/error';
import { AccountSkeleton } from '@/features/account/skeleton';

type MoneyKey = keyof AssessmentCreateInput['economic'];
type MoneyDraft = { amount: string; sourceType: 'USER_ESTIMATE' | 'USER_REFERENCE' | 'ADMIN_CATEGORY_REFERENCE'; referenceId?: string; sourceNote: string; referenceDate: string };
const moneyFields: { key: MoneyKey; label: string }[] = [
  { key: 'estimatedResaleValue', label: 'Estimasi nilai jual' },
  { key: 'estimatedRepairCost', label: 'Estimasi biaya perbaikan' },
  { key: 'comparableReplacementPrice', label: 'Harga barang pembanding' },
];
const blankMoney = (): MoneyDraft => ({ amount: '', sourceType: 'USER_ESTIMATE', sourceNote: '', referenceDate: new Date().toISOString().slice(0, 10) });

export default function NewAssessmentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const cache = useQueryClient();
  const item = useQuery({ queryKey: ['item', id], queryFn: () => api<ItemDto>(`/items/${id}`) });
  const rubric = useQuery({ queryKey: ['rubric', item.data?.categoryCode, item.data?.subcategoryCode], enabled: !!item.data && (item.data.categoryCode !== 'hobby' || !!item.data.subcategoryCode), queryFn: () => api<RubricDto>(`/categories/${item.data!.categoryCode}/rubric${item.data!.subcategoryCode ? `?subcategoryCode=${encodeURIComponent(item.data!.subcategoryCode)}` : ''}`) });
  const references = useQuery({ queryKey: ['economic-references', item.data?.categoryCode], enabled: Boolean(item.data), queryFn: () => api<{ id: string; field: MoneyKey; amountIdr: string; sourceNote: string; referenceDate: string; region: string }[]>(`/categories/${item.data!.categoryCode}/economic-references`) });
  const [answers, setAnswers] = useState<Partial<Record<IndicatorKey, string>>>({});
  const [safety, setSafety] = useState<Record<string, string>>({});
  const [hasIssue, setHasIssue] = useState('');
  const [repairNeeded, setRepairNeeded] = useState('');
  const [contextAnswer, setContextAnswer] = useState('');
  const [money, setMoney] = useState<Record<MoneyKey, MoneyDraft>>({ estimatedResaleValue: blankMoney(), estimatedRepairCost: blankMoney(), comparableReplacementPrice: blankMoney() });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const running = useRef(false);

  function updateMoney(key: MoneyKey, patch: Partial<MoneyDraft>) { setMoney((current) => ({ ...current, [key]: { ...current[key], ...patch } })); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (running.current) return; setError('');
    if (!item.data || !rubric.data) return;
    const economic: Record<string, unknown> = {};
    for (const { key } of moneyFields) if (money[key].amount !== '' && !(key === 'estimatedRepairCost' && repairNeeded === 'no')) {
      economic[key] = { ...(money[key].referenceId ? { referenceId: money[key].referenceId } : {}), amountIdr: Number(money[key].amount), sourceType: money[key].sourceType, sourceNote: money[key].sourceNote, referenceDate: money[key].referenceDate };
    }
    const parsed = assessmentCreateSchema.safeParse({
      expectedItemRevision: item.data.itemRevision, rubricVersionId: rubric.data.id,
      answers, safetyAnswers: safety, contextAnswer,
      hasIssue: hasIssue === '' ? null : hasIssue === 'yes', repairNeeded: repairNeeded === '' ? null : repairNeeded === 'yes', economic,
    });
    if (!parsed.success) { setError(parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(' · ')); return; }
    running.current = true; setBusy(true);
    try {
      const created = await api<AssessmentDto>(`/items/${id}/assessments`, { method: 'POST', body: parsed.data });
      await cache.invalidateQueries({ queryKey: ['assessments', id] });
      router.push(`/app/barang/${id}/penilaian/${created.id}`);
    } catch (cause) { setError(cause instanceof ApiClientError ? cause.message : 'Penilaian gagal disimpan. Coba lagi.'); }
    finally { running.current = false; setBusy(false); }
  }

  if (item.isPending) return <AccountSkeleton />;
  if (item.isError) return <Notice kind="error">Barang tidak ditemukan. <Link href="/app/barang">Kembali ke daftar</Link></Notice>;
  if (item.data.reservedByTransactionId) return <Notice>Barang sedang direservasi. Penilaian baru dapat dibuat setelah transaksi berakhir. <Link href={`/app/transaksi/${item.data.reservedByTransactionId}`}>Buka transaksi</Link></Notice>;
  if (item.data.categoryCode === 'hobby' && !item.data.subcategoryCode) return <Notice>Pilih subkategori Hobi pada <Link href={`/app/barang/${id}/edit`}>detail barang</Link> sebelum membuat penilaian.</Notice>;
  if (rubric.isPending) return <AccountSkeleton />;
  if (rubric.isError) return <AccountError retry={() => rubric.refetch()}>Rubrik belum tersedia untuk kategori ini. Barang tetap dapat disimpan dan perawatan dapat dicatat.</AccountError>;

  return <><div className="app-heading"><div><Link className="eyebrow" href={`/app/barang/${id}/penilaian`}>← RIWAYAT PENILAIAN</Link><h1>Nilai {item.data.title}</h1><p>Jawab yang kamu ketahui. Hasil belum lengkap tetap bisa disimpan dan dilengkapi lewat penilaian baru.</p></div></div>
    <Notice>Penilaian berdasarkan laporanmu dan aturan {rubric.data.ruleVersion}. Angka ini bukan pemeriksaan kondisi fisik atau taksiran harga resmi.</Notice>
    <form className="item-form assessment-form" onSubmit={submit} aria-busy={busy}>
      {error && <Notice kind="error">{error}</Notice>}
      <fieldset className="account-form-fields" disabled={busy}>{rubric.data.contextPrompt && <section className="item-form-section"><h2>Konteks barang</h2><Field label={rubric.data.contextPrompt} htmlFor="contextAnswer"><Input id="contextAnswer" value={contextAnswer} onChange={(event) => setContextAnswer(event.target.value)} maxLength={500} placeholder="Jelaskan jenis dan sumber daya bila relevan" /></Field></section>}
      <section className="item-form-section"><h2>Kondisi dan kegunaan</h2><p>Pilih uraian yang paling mendekati kondisi yang kamu lihat.</p><div className="form-stack">{rubric.data.questions.filter((question) => !['repairMethod', 'repairSupport'].includes(question.key)).map((question) => <Field key={question.key} label={question.prompt} htmlFor={question.key}><Select className="select" id={question.key} value={answers[question.key] ?? ''} onChange={(event) => setAnswers((current) => ({ ...current, [question.key]: event.target.value || undefined }))}><option value="">Belum tahu / isi nanti</option>{question.choices.map((choice) => <option key={choice.code} value={choice.code}>{choice.label}</option>)}</Select></Field>)}</div></section>
      <section className="item-form-section"><h2>Masalah dan Repair</h2><div className="form-stack"><Field label="Apakah ada masalah pada barang ini?" htmlFor="hasIssue"><Select className="select" id="hasIssue" value={hasIssue} onChange={(event) => setHasIssue(event.target.value)}><option value="">Belum tahu</option><option value="yes">Ada</option><option value="no">Tidak ada</option></Select></Field><Field label="Apakah barang perlu perbaikan?" htmlFor="repairNeeded"><Select className="select" id="repairNeeded" value={repairNeeded} onChange={(event) => setRepairNeeded(event.target.value)}><option value="">Belum tahu</option><option value="yes">Perlu</option><option value="no">Tidak perlu</option></Select></Field>{repairNeeded === 'yes' && rubric.data.questions.filter((question) => ['repairMethod', 'repairSupport'].includes(question.key)).map((question) => <Field key={question.key} label={question.prompt} htmlFor={question.key}><Select className="select" id={question.key} value={answers[question.key] ?? ''} onChange={(event) => setAnswers((current) => ({ ...current, [question.key]: event.target.value || undefined }))}><option value="">Belum tahu / isi nanti</option>{question.choices.map((choice) => <option key={choice.code} value={choice.code}>{choice.label}</option>)}</Select></Field>)}</div></section>
      <section className="item-form-section"><h2>Keselamatan dan pengungkapan</h2><p>“Tidak tahu” menahan penawaran barang sampai kondisi ini jelas.</p><div className="form-stack">{rubric.data.safetyQuestions.map((question) => <Field key={question.code} label={question.prompt} htmlFor={question.code}><Select className="select" id={question.code} value={safety[question.code] ?? ''} onChange={(event) => setSafety((current) => ({ ...current, [question.code]: event.target.value }))}><option value="">Belum dijawab</option><option value="TIDAK">Tidak</option><option value="YA">Ya</option><option value="TIDAK_TAHU">Tidak tahu</option></Select></Field>)}</div></section>
      <section className="item-form-section"><h2>Nilai ekonomi</h2>{references.isError && <AccountError retry={() => references.refetch()}>Referensi ekonomi gagal dimuat. Kamu tetap bisa memasukkan perkiraan sendiri.</AccountError>}<p>Nominal dalam rupiah, masing-masing dengan sumber dan tanggal acuan. Kosongkan bila belum tahu; Score total belum akan muncul.</p><div className="form-stack">{moneyFields.filter(({ key }) => !(key === 'estimatedRepairCost' && repairNeeded === 'no')).map(({ key, label }) => <div className="economic-entry" key={key}><Field label={`${label} (Rp)`} htmlFor={`${key}-amount`}><Input id={`${key}-amount`} type="number" readOnly={money[key].sourceType === 'ADMIN_CATEGORY_REFERENCE'} min={0} step={1} value={money[key].amount} onChange={(event) => updateMoney(key, { amount: event.target.value })} placeholder="Belum tahu" /></Field><div className="form-grid"><Field label="Asal angka" htmlFor={`${key}-source`}><Select className="select" id={`${key}-source`} value={money[key].sourceType} onChange={(event) => updateMoney(key, { sourceType: event.target.value as MoneyDraft['sourceType'], referenceId: undefined, ...(event.target.value === 'ADMIN_CATEGORY_REFERENCE' ? { amount: '', sourceNote: '', referenceDate: '' } : {}) })}><option value="USER_ESTIMATE">Perkiraan saya</option><option value="USER_REFERENCE">Referensi yang saya temukan</option>{references.data?.some((ref) => ref.field === key) && <option value="ADMIN_CATEGORY_REFERENCE">Acuan kategori dari admin</option>}</Select></Field><Field label="Tanggal acuan" htmlFor={`${key}-date`}><Input id={`${key}-date`} type="date" readOnly={money[key].sourceType === 'ADMIN_CATEGORY_REFERENCE'} value={money[key].referenceDate} onChange={(event) => updateMoney(key, { referenceDate: event.target.value })} /></Field></div>{money[key].sourceType === 'ADMIN_CATEGORY_REFERENCE' && <Field label="Pilih acuan kategori" htmlFor={`${key}-reference`}><Select className="select" id={`${key}-reference`} required value={money[key].referenceId ?? ''} onChange={(e) => { const ref = references.data?.find((r) => r.id === e.target.value); updateMoney(key, ref ? { referenceId: ref.id, amount: ref.amountIdr, sourceNote: ref.sourceNote + ' · ' + ref.region, referenceDate: ref.referenceDate } : { referenceId: undefined, amount: '', sourceNote: '', referenceDate: '' }); }}><option value="">Pilih acuan secara eksplisit</option>{references.data?.filter((ref) => ref.field === key).map((ref) => <option key={ref.id} value={ref.id}>Rp {ref.amountIdr} · {ref.region} · {ref.referenceDate}</option>)}</Select></Field>}<Field label="Uraian atau tautan sumber" htmlFor={`${key}-note`}><Input id={`${key}-note`} readOnly={money[key].sourceType === 'ADMIN_CATEGORY_REFERENCE'} value={money[key].sourceNote} onChange={(event) => updateMoney(key, { sourceNote: event.target.value })} maxLength={500} placeholder="Contoh: perkiraan saya dari kondisi saat ini" /></Field></div>)}</div>{repairNeeded === 'no' && <Notice>Biaya perbaikan dicatat Rp0 dengan alasan “tidak perlu perbaikan”.</Notice>}</section>
      </fieldset><div className="form-actions"><Button disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan penilaian'}</Button>{!busy && <Link className="button button-quiet" href={`/app/barang/${id}/penilaian`}>Batal</Link>}</div>
    </form>
  </>;
}
