import type { AssessmentDto } from '@valora/contracts';
import { Notice } from "../../components/ui/primitives";
import Link from 'next/link';
import { AssessmentExplanation } from './explanation';

const money = (value: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);

const componentNames = { condition: 'Kondisi', repairability: 'Kemudahan Repair', economicValue: 'Nilai Ekonomi', reusePotential: 'Potensi Pakai Ulang' };

const actionNames = { REPAIR: 'Repair', RESELL: 'Resell', EXCHANGE: 'Exchange', DONATE: 'Donate' };

const statusNames = { ELIGIBLE: 'Dapat dipilih', NEEDS_DATA: 'Perlu data', INELIGIBLE: 'Belum layak' };

const missingNames: Record<string, string> = {
  function: 'Fungsi utama', physical: 'Kondisi fisik', completeness: 'Kelengkapan', repairMethod: 'Metode perbaikan', repairSupport: 'Dukungan perbaikan', reuse: 'Potensi pakai ulang',
  hasIssue: 'Kendala barang', repairNeeded: 'Kebutuhan perbaikan', contextAnswer: 'Jenis barang atau sumber daya',
  estimatedResaleValue: 'Estimasi nilai jual', estimatedRepairCost: 'Estimasi biaya perbaikan', comparableReplacementPrice: 'Harga barang pembanding',
};

const reasonNames: Record<string, string> = {
  NO_REPORTED_ISSUE: 'Tidak ada kendala yang dilaporkan.', NO_REPAIR_NEEDED: 'Perbaikan tidak diperlukan menurut jawabanmu.', REPAIR_POSSIBLE: 'Perbaikan dapat dipertimbangkan menurut jawabanmu.',
  REPAIRABILITY_BELOW_50: 'Kemudahan Repair di bawah ambang awal.', CONDITION_BELOW_50: 'Kondisi di bawah ambang Resell.',
  ECONOMIC_BELOW_50: 'Nilai ekonomi di bawah ambang Resell.', THRESHOLD_MET: 'Memenuhi ambang awal dan tetap memerlukan pemeriksaan berikutnya.',
  REUSE_POTENTIAL_MET: 'Potensi pakai ulang memenuhi ambang awal.', REUSE_BELOW_50: 'Potensi pakai ulang di bawah ambang awal.',
};

function describe(code: string, assessment: AssessmentDto): string {
  if (code.startsWith('safety:')) return assessment.rubric.safetyQuestions.find((question) => question.code === code.slice(7))?.prompt ?? 'Deklarasi keselamatan';
  if (code.includes(':')) return assessment.rubric.safetyQuestions.find((question) => question.code === code.split(':')[1])?.prompt ?? code;
  return missingNames[code] ?? reasonNames[code] ?? code;
}

export function AssessmentResult({ assessment, itemId }: { assessment: AssessmentDto; itemId: string }) {
  const components = (Object.keys(componentNames) as (keyof typeof componentNames)[]).map((key) => ({ key, name: componentNames[key], value: assessment[key] }));
  return <div className="assessment-stack">
    {!assessment.isCurrent && <Notice kind="error">Penilaian ini historis. Data barang atau versi rubrik telah berubah. <Link href={`/app/barang/${itemId}/penilaian/baru`}>Buat penilaian baru</Link>.</Notice>}
    <section className="assessment-hero" aria-label="Hasil penilaian">
      <div><span className="eyebrow">VALORA SCORE · {assessment.ruleVersion}</span>
        <h2>{assessment.score === null ? assessment.status === 'PARTIAL_ECONOMIC' ? 'Nilai ekonomi belum lengkap' : 'Penilaian belum lengkap' : assessment.score}</h2>
        <p>{assessment.score === null ? 'Skor total dan label tersedia setelah semua data wajib lengkap.' : assessment.label}</p>
      </div>
      <p className="assessment-origin">Berdasarkan laporan pemilik dan rubrik Valora. Bukan pemeriksaan fisik, appraisal, atau verifikasi pembayaran.</p>
    </section>
    <div className="assessment-components">{components.map(({ key, name, value }) => <div key={key}><span className="eyebrow">{name}</span><strong>{value === null ? '—' : value}</strong><small>{key === 'condition' ? 'Bobot 30%' : key === 'reusePotential' ? 'Bobot 20%' : 'Bobot 25%'}{key === 'repairability' && assessment.repairabilityReason === 'NOT_NEEDED' ? ' · tidak perlu Repair' : ''}</small></div>)}</div>
    {assessment.missingFields.length > 0 && <section className="assessment-section"><h3>Data yang perlu dilengkapi</h3><ul>{assessment.missingFields.map((field) => <li key={field}>{describe(field, assessment)}</li>)}</ul><Link className="button button-secondary" href={`/app/barang/${itemId}/penilaian/baru`}>Lengkapi lewat penilaian baru</Link></section>}
    {assessment.safetyFlags.length > 0 && <section className="assessment-section"><h3>Catatan kondisi dan keselamatan</h3><ul>{assessment.safetyFlags.map((flag) => <li key={flag}><strong>{flag.startsWith('PROHIBITED:') ? 'Tidak dapat ditawarkan: ' : flag.startsWith('SPECIAL_REVIEW:') ? 'Perlu review khusus: ' : 'Perlu diungkap: '}</strong>{describe(flag, assessment)}</li>)}</ul></section>}
    <AssessmentExplanation id={assessment.id} /><section className="assessment-section"><h3>Pilihan tindakan</h3><p className="muted">Urutan ini membantu navigasi; keputusan akhir tetap milikmu. Repair dapat dicatat meski penilaian belum lengkap.</p><div className="recommendation-list">{assessment.recommendations.map((entry) => <div key={entry.action}><div><strong>{actionNames[entry.action]}</strong><span className={`badge ${entry.status === 'ELIGIBLE' ? 'badge-green' : 'badge-warn'}`}>{statusNames[entry.status]}</span></div><p>{entry.reasons.map((reason) => describe(reason, assessment)).join(' ')}</p>{entry.action === 'REPAIR' && <Link href={`/app/barang/${itemId}/perbaikan`}>Catat Repair →</Link>}</div>)}</div></section>
    <section className="assessment-section"><h3>Konteks dan sumber</h3><p className="muted">Rubrik {assessment.ruleVersion} · kebijakan {assessment.policyVersion} · rekomendasi {assessment.recommendationVersion} · {new Date(assessment.createdAt).toLocaleDateString('id-ID')}</p>
      {assessment.economicSources && <dl className="detail-list">{Object.entries(assessment.economicSources).map(([key, source]) => <div key={key}><dt>{missingNames[key] ?? key}</dt><dd>{money(source.amountIdr)} · {source.sourceType === 'USER_ESTIMATE' ? 'perkiraan pemilik' : 'referensi pengguna'}<br /><small>{source.sourceNote} · {source.referenceDate}</small></dd></div>)}</dl>}
    </section>
  </div>;
}
