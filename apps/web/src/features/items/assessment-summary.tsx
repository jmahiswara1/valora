import Link from 'next/link';
import type { AssessmentDto } from '@valora/contracts';
import { ArrowUpRight } from 'lucide-react';
import { AccountError } from '@/features/account/error';

export function ItemAssessmentSummary({ itemId, assessments, loading, error, reserved, retry }: { itemId: string; assessments?: AssessmentDto[]; loading: boolean; error: boolean; reserved: boolean; retry: () => void }) {
  const current = assessments?.find(entry => entry.isCurrent);
  const historical = Boolean(assessments?.length && !current);
  const historyHref = `/app/barang/${itemId}/penilaian`;
  return <section className="item-assessment-summary" aria-labelledby="item-assessment-title">
    <div className="item-assessment-heading"><h2 id="item-assessment-title">Valora Score</h2>{!loading && !error && current && <span className="item-assessment-status">Terkini</span>}</div>
    {loading ? <div className="item-assessment-loading" role="status" aria-label="Memuat penilaian"><div /><div /><div /></div>
      : error ? <AccountError retry={retry}>Status penilaian gagal dimuat.</AccountError>
        : <>
          {current ? current.score !== null ? <><p className="item-assessment-value"><strong>{current.score}</strong><span>/ 100</span></p>{current.label && <p className="item-assessment-label">{current.label}</p>}<p className="item-assessment-description">Berdasarkan jawaban pemilik dan rubrik yang tercatat.</p></>
            : <><h3>{current.status === 'PARTIAL_ECONOMIC' ? 'Nilai ekonomi belum lengkap' : 'Penilaian belum lengkap'}</h3><p className="item-assessment-description">Score total belum tersedia. Lihat hasil untuk memeriksa data yang perlu dilengkapi.</p></>
            : <><h3>{historical ? 'Penilaian perlu diperbarui' : 'Barang ini belum dinilai'}</h3><p className="item-assessment-description">{historical ? 'Penilaian sebelumnya sudah historis. Buat penilaian baru untuk kondisi barang saat ini.' : 'Catat kondisi barang untuk mengetahui potensi sirkularnya.'}</p></>}
          <div className="item-assessment-actions">
            {current ? <Link className="button button-primary" href={`${historyHref}/${current.id}`}>Lihat hasil <ArrowUpRight size={16} aria-hidden="true" /></Link>
              : !reserved && <Link className="button button-primary" href={`${historyHref}/baru`}>{historical ? 'Buat penilaian baru' : 'Mulai penilaian'}<ArrowUpRight size={16} aria-hidden="true" /></Link>}
            <Link className="item-assessment-history" href={historyHref}>Riwayat penilaian <ArrowUpRight size={15} aria-hidden="true" /></Link>
          </div>
        </>}
  </section>;
}
