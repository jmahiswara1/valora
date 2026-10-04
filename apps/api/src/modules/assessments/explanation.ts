import { type AssessmentDto, type ExplanationDto, explanationSchema } from '@valora/contracts';

export interface ExplanationProvider { explain(assessment: AssessmentDto): Promise<ExplanationDto> }

export const templateVersion = 'assessment-template-v1';

const components = { condition: 'Kondisi', repairability: 'Kemungkinan perbaikan', economicValue: 'Nilai ekonomi', reusePotential: 'Potensi penggunaan ulang' } as const;

const reasons: Record<string, string> = { NO_REPORTED_ISSUE: 'Tidak ada masalah yang dilaporkan.', NO_REPAIR_NEEDED: 'Perbaikan tidak diperlukan menurut laporan pemilik.', REPAIR_POSSIBLE: 'Komponen perbaikan memenuhi batas 50.', REPAIRABILITY_BELOW_50: 'Komponen perbaikan berada di bawah 50.', CONDITION_BELOW_50: 'Komponen kondisi berada di bawah 50.', ECONOMIC_BELOW_50: 'Komponen ekonomi berada di bawah 50.', THRESHOLD_MET: 'Komponen kondisi dan ekonomi memenuhi batas Resell.', REUSE_POTENTIAL_MET: 'Potensi penggunaan ulang memenuhi batas 50.', REUSE_BELOW_50: 'Potensi penggunaan ulang berada di bawah 50.' };

export function templateExplanation(a: AssessmentDto): ExplanationDto {
  const strengths: string[] = []; const limitations: string[] = [];
  for (const [key, name] of Object.entries(components)) {
    const score = a[key as keyof typeof components];
    if (score !== null && score >= 70) strengths.push(name + ' tercatat ' + score + '/100.');
    else if (score !== null) limitations.push(name + ' tercatat ' + score + '/100.');
  }
  if (a.status !== 'COMPLETE') limitations.push('Score dan label keseluruhan belum tersedia karena penilaian belum lengkap.');
  if (!a.isCurrent) limitations.push('Penilaian ini historis; buat penilaian terkini sebelum memulai kesepakatan baru.');
  if (a.safetyFlags.length) limitations.push('Ada deklarasi keselamatan yang memengaruhi kelayakan tindakan.');
  const missingNames: Record<string, string> = { function: 'fungsi utama', physical: 'kondisi fisik', completeness: 'kelengkapan', repairMethod: 'metode perbaikan', repairSupport: 'dukungan perbaikan', reuse: 'penggunaan ulang', hasIssue: 'masalah barang', repairNeeded: 'kebutuhan perbaikan', contextAnswer: 'konteks barang', estimatedResaleValue: 'estimasi nilai jual', estimatedRepairCost: 'estimasi biaya perbaikan', comparableReplacementPrice: 'harga pembanding' };
  const reason = (code: string) => reasons[code] ?? (code.startsWith('PROHIBITED:') ? 'Deklarasi keselamatan melarang transfer.' : code.startsWith('safety:') ? 'Jawaban keselamatan masih diperlukan.' : 'Lengkapi informasi tentang ' + (missingNames[code] ?? 'kondisi barang') + '.');
  return explanationSchema.parse({ source: 'TEMPLATE', templateVersion, assessmentId: a.id, historical: !a.isCurrent, summary: a.status === 'COMPLETE' && a.score === null ? 'Penilaian ini dibatalkan dan disimpan sebagai riwayat. Score tidak dipakai untuk tindakan baru.' : a.status === 'COMPLETE' ? 'Penilaian mencatat Score ' + a.score + '/100 (' + a.label + ') dari laporan pengguna. Hasil ini mengikuti rubrik ' + a.ruleVersion + '.' : a.status === 'PARTIAL_ECONOMIC' ? 'Kondisi, perbaikan, dan penggunaan ulang telah dinilai. Data ekonomi masih perlu dilengkapi.' : 'Beberapa jawaban penilaian masih perlu dilengkapi.', strengths, limitations, actions: a.recommendations.map((r) => ({ action: r.action, status: r.status, reasons: r.reasons.map(reason) })), nextSteps: [...(!a.isCurrent ? ['Buat penilaian baru sesuai kondisi dan rubrik aktif.'] : []), ...(a.missingFields.length ? ['Lengkapi data yang ditandai pada penilaian.'] : ['Tinjau pilihan tindakan yang memenuhi syarat.']), 'Periksa kondisi fisik dan ungkapkan masalah sebelum serah terima.'] });
}
