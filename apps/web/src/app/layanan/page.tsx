import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { PublicShell } from '@/components/layout/public-shell';
import { RecordItemLink } from '@/components/ui/public-actions';

export const metadata: Metadata = {
  title: 'Layanan',
  description: 'Kenali Valora Passport, penilaian kondisi, catatan perawatan, serta pilihan jual kembali, tukar, dan donasi barang.',
};

const services = [
  {
    id: 'passport', title: 'Valora Passport',
    description: 'Satu identitas untuk menyimpan perjalanan barang. Riwayat penilaian, perbaikan, dan transfer yang tercatat tetap terhubung dengan barang, termasuk ketika pemiliknya berganti.',
    detail: 'Akses riwayat mengikuti visibilitas barang. Catatan privat tetap dikelola melalui akun pemilik.',
    href: '/cara-kerja#passport', link: 'Kenali perjalanan barang',
  },
  {
    id: 'penilaian', title: 'Penilaian kondisi',
    description: 'Kenali kondisi barang melalui penilaian sesuai kategorinya. Valora Score dan rekomendasi membantu kamu memahami potensi sirkular berdasarkan rubrik serta informasi yang kamu berikan.',
    detail: 'Penilaian ini bukan sertifikat kondisi fisik atau jaminan harga jual. Periksa detail barang sebelum membuat kesepakatan.',
    href: '/cara-kerja#penilaian', link: 'Pelajari cara penilaian',
  },
  {
    id: 'perawatan', title: 'Catatan perawatan',
    description: 'Simpan catatan perbaikan agar perjalanan perawatan barang mudah ditelusuri. Catatan yang tersimpan melengkapi riwayat barang dan membantu kamu memahami apa yang sudah dikerjakan.',
    detail: 'Fitur ini membantu mencatat perawatan yang dilakukan. Perbaikan fisik diatur sendiri oleh pemilik barang.',
    href: '/cara-kerja#pilih', link: 'Pelajari langkah merawat',
  },
  {
    id: 'jual-tukar-donasi', title: 'Jual, tukar & donasi',
    description: 'Temukan kesempatan berikutnya untuk barang yang masih dapat digunakan. Ajukan Listing untuk jual kembali, tukar, atau donasi sesuai kondisi barang dan kelengkapan penilaiannya.',
    detail: 'Verifikasi email diperlukan sebelum membuat Listing atau mengajukan penawaran. Listing ditinjau sebelum tampil; pembayaran dan serah terima disepakati oleh para pihak.',
    href: '/market', link: 'Jelajahi Market',
  },
];

export default function LayananPage() {
  return <PublicShell>
    <main id="main-content" className="container public-information public-guide">
      <header className="information-hero">
        <div>
          <h1>Layanan untuk menjaga nilai barang.</h1>
          <p>Dari mengenali kondisi hingga menemukan pemilik berikutnya. Valora membantu kamu mencatat dan menentukan langkah untuk barang sehari-hari.</p>
          <div className="information-hero-actions">
            <RecordItemLink>Mulai mencatat</RecordItemLink>
            <Link className="editorial-link" href="/market">Jelajahi Market <ArrowUpRight size={18} aria-hidden="true" /></Link>
          </div>
        </div>
        <div className="information-hero-photo"><Image src="/images/editorial/care-chair.png" width={1260} height={1260} sizes="(max-width: 639px) calc(100vw - 32px), 43vw" alt="Ilustrasi kursi kayu yang dapat dirawat dan digunakan kembali" /></div>
      </header>
      <div className="service-sections">
        {services.map(service => <section id={service.id} key={service.id} className="service-section" aria-labelledby={`${service.id}-heading`}>
          <h2 id={`${service.id}-heading`}>{service.title}</h2>
          <div>
            <p>{service.description}</p>
            <p className="service-detail">{service.detail}</p>
            <Link href={service.href} className="editorial-link">{service.link}<ArrowUpRight size={18} aria-hidden="true" /></Link>
          </div>
        </section>)}
      </div>
      <section className="public-closing" aria-labelledby="services-closing-heading">
        <div><h2 id="services-closing-heading">Mulai dari yang sudah kamu punya.</h2><p>Satu barang, satu catatan, lalu tentukan langkah berikutnya.</p></div>
        <RecordItemLink>Mulai mencatat</RecordItemLink>
      </section>
    </main>
  </PublicShell>;
}
