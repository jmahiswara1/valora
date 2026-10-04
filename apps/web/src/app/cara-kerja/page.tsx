import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { PublicShell } from '@/components/layout/public-shell';
import { RecordItemLink } from '@/components/ui/public-actions';

export const metadata: Metadata = {
  title: 'Cara kerja',
  description: 'Catat barang, pahami kondisinya, lalu rawat, jual kembali, tukar, atau donasikan melalui Valora.',
};

const steps = [
  { id: 'catat', title: 'Mulai dari satu barang.', text: 'Buat akun, pilih kota, lalu tambahkan foto, kategori, nama, dan kondisi barang. Catatan barang tersimpan privat di akunmu dan bisa diperbarui kapan saja.', note: 'Verifikasi email diperlukan sebelum membuat Listing atau mengajukan penawaran.' },
  { id: 'penilaian', title: 'Kenali kondisinya.', text: 'Lengkapi penilaian sesuai kategori barang. Valora Score dan rekomendasi membantu kamu memahami potensi sirkular berdasarkan rubrik serta informasi yang kamu berikan.', note: 'Penilaian ini bukan sertifikat kondisi fisik atau jaminan harga jual.' },
  { id: 'pilih', title: 'Tentukan langkah berikutnya.', text: 'Catat perbaikan untuk merawat barang, atau ajukan Listing untuk jual kembali, tukar, dan donasi. Listing ditinjau sebelum tampil di Market.', note: 'Pilihan yang tersedia mengikuti kondisi barang dan kelengkapan penilaiannya.' },
  { id: 'lanjutkan', title: 'Sepakati cerita berikutnya.', text: 'Tanyakan detail melalui percakapan dan ajukan penawaran. Setelah sepakat, atur pembayaran serta serah terima dengan pihak lain. Transfer selesai setelah konfirmasi serah terima yang diperlukan tercatat.', note: 'Kesepakatan formal tercatat melalui penawaran dan transaksi di Valora.' },
];

export default function CaraKerja() {
  return <PublicShell>
    <main id="main-content" className="container public-information">
      <header className="information-hero">
        <div><h1>Mulai dari barang<br />yang kamu punya.</h1><p>Catat, pahami kondisinya, lalu pilih kesempatan berikutnya. Barangmu punya lebih dari satu jalan.</p><div className="information-hero-actions"><RecordItemLink /><Link className="editorial-link" href="/market">Jelajahi Market <ArrowUpRight size={18} aria-hidden="true" /></Link></div></div>
        <div className="information-hero-photo"><Image src="/images/editorial/care-chair.png" alt="Ilustrasi kursi kayu yang dapat dirawat dan digunakan kembali" width={1260} height={1260} sizes="(max-width: 639px) calc(100vw - 32px), (max-width: 1023px) calc(42.554vw - 34.04px), calc(42.554vw - 44.26px)" /></div>
      </header>
      <section className="how-it-works" aria-labelledby="how-heading">
        <div className="public-section-heading"><h2 id="how-heading">Empat langkah,<br />banyak kemungkinan.</h2><p>Kamu menentukan jalannya. Valora membantu menyimpan kondisi dan setiap langkah yang tercatat.</p></div>
        <ol className="how-steps">{steps.map((step, index) => <li id={step.id} key={step.id}><span className="process-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><div><h3>{step.title}</h3><p>{step.text}</p><small>{step.note}</small>{step.id === 'pilih' && <div className="journey-options" aria-label="Pilihan tindakan"><span>Rawat</span><span>Jual kembali</span><span>Tukar</span><span>Donasi</span></div>}</div></li>)}</ol>
      </section>
      <section id="passport" className="passport-explanation" aria-labelledby="passport-heading">
        <Image src="/images/editorial/passport-books.png" width={1260} height={1260} sizes="(max-width: 639px) calc(100vw - 76px), (max-width: 1023px) calc(42.858vw - 53.15px), calc(42.858vw - 65.15px)" alt="Ilustrasi buku yang dapat melanjutkan cerita bersama pemilik berikutnya" />
        <div><h2 id="passport-heading">Pemilik bisa berganti.<br />Ceritanya berlanjut.</h2><p>Valora Passport menyimpan riwayat penilaian, perbaikan, dan transfer barang yang tercatat. Riwayat ini berlanjut bersama identitas barang, dengan akses sesuai visibilitasnya.</p><p>Aktivitas yang memenuhi kriteria juga masuk ke Valora Impact, supaya kamu bisa melihat kontribusi yang tercatat.</p><Link className="editorial-link" href="/impact">Lihat catatan Impact <ArrowRight size={18} aria-hidden="true" /></Link></div>
      </section>
      <section className="public-closing" aria-labelledby="how-closing-heading"><div><h2 id="how-closing-heading">Sudah punya barang pertama?</h2><p>Mulai dengan satu foto dan cerita singkat.</p></div><RecordItemLink /></section>
    </main>
  </PublicShell>;
}
