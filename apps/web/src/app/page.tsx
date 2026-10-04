import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, ArrowUpRight, MoveDownRight } from 'lucide-react';
import { PublicShell } from '@/components/layout/public-shell';
import { RecordItemLink } from '@/components/ui/public-actions';
import { LandingMarket } from '@/features/market/landing';
import { PassportStack } from '@/features/passport/stack';

const steps = [
  { title: 'Catat barangmu', text: 'Mulai dari foto, kondisi, dan cerita barang yang kamu miliki.' },
  { title: 'Pahami kondisinya', text: 'Lengkapi penilaian untuk melihat potensi dan pilihan berikutnya.' },
  { title: 'Pilih langkahnya', text: 'Rawat, jual kembali, tukar, atau donasikan. Kamu yang menentukan.' },
  { title: 'Lanjutkan ceritanya', text: 'Penilaian, perbaikan, dan transfer yang tercatat menjadi bagian dari Passport barang.' },
];

export default function Home() {
  return <PublicShell>
    <main id="main-content" className="container public-home">
      <section className="landing-hero" aria-labelledby="home-heading">
        <Image
          className="landing-hero-image"
          src="/images/editorial/valora-hero-v2.png"
          alt="Kursi kayu, buku, keyboard, dan headphone di ruang bernuansa hijau"
          fill
          preload
          sizes="(max-width: 639px) calc(100vw - 32px), calc(100vw - 48px)"
        />
        <div className="landing-hero-content">
          <h1 id="home-heading">Setiap barang punya <span>kesempatan kedua.</span></h1>
          <div className="landing-hero-description"><MoveDownRight size={22} aria-hidden="true" /><p>Temukan barang yang kamu butuhkan. Rawat yang kamu punya. Beri nilai untuk cerita berikutnya.</p></div>
          <div className="landing-hero-actions">
            <Link className="button button-primary" href="/market">Jelajahi Market <ArrowUpRight size={20} aria-hidden="true" /></Link>
            <RecordItemLink className="button button-secondary" />
          </div>
        </div>
      </section>

      <section className="landing-intro" aria-labelledby="intro-heading">
        <div className="public-section-heading public-section-heading-center">
          <h2 id="intro-heading">Masih bernilai. Masih bisa berarti.</h2>
          <p>Dari sudut rumahmu ke keseharian orang lain. Valora membantu kamu memahami kondisi barang, merawatnya, dan menemukan kesempatan baru.</p>
        </div>
        <div className="editorial-panels">
          <article className="editorial-panel editorial-care">
            <Image src="/images/editorial/care-chair.png" width={1260} height={1260} sizes="(max-width: 639px) calc(100vw - 64px), (max-width: 1023px) calc(50vw - 65px), calc(50vw - 76px)" alt="Ilustrasi kursi kayu yang masih memiliki nilai guna" />
            <div className="editorial-panel-copy">
              <h3>Dirawat hari ini,<br />dipakai lebih lama.</h3>
              <p>Kenali kondisinya sebelum menentukan langkah berikutnya.</p>
              <Link className="editorial-link" href="/cara-kerja#penilaian">Kenali penilaian barang <ArrowUpRight size={19} aria-hidden="true" /></Link>
            </div>
          </article>
          <article className="editorial-panel editorial-story">
            <div className="editorial-panel-copy">
              <h3>Setiap barang<br />menyimpan cerita.</h3>
              <p>Dari pertama dicatat, dirawat, hingga menemukan pemilik berikutnya.</p>
            </div>
            <PassportStack />
            <Link className="editorial-link" href="/cara-kerja#passport">Lihat perjalanan barang <ArrowUpRight size={19} aria-hidden="true" /></Link>
          </article>
        </div>
      </section>

      <LandingMarket />

      <section className="landing-process" aria-labelledby="process-heading">
        <div className="public-section-heading"><h2 id="process-heading">Cerita berikutnya<br />dimulai dari kamu.</h2><p>Satu tempat untuk mengenali barang dan menentukan langkah yang paling sesuai.</p></div>
        <ol className="public-process-list">{steps.map((step, index) => <li key={step.title}><span className="process-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><h3>{step.title}</h3><p>{step.text}</p></li>)}</ol>
        <Link className="editorial-link" href="/cara-kerja">Pelajari cara kerja Valora <ArrowRight size={18} aria-hidden="true" /></Link>
      </section>

      <section className="public-closing" aria-labelledby="closing-heading">
        <div><h2 id="closing-heading">Mulai dari satu barang.</h2><p>Barang yang sudah kamu miliki bisa jadi awal cerita yang baru.</p></div>
        <RecordItemLink />
      </section>
    </main>
  </PublicShell>;
}
