import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Minus, Plus } from 'lucide-react';
import { PublicShell } from '@/components/layout/public-shell';

export const metadata: Metadata = {
  title: 'Tentang kami',
  description: 'Kenali Valora, platform untuk menjaga nilai dan memperpanjang usia pakai barang. Temukan misi, prinsip, dan jawaban pertanyaan umum.',
};

const principles = [
  { title: 'Berangkat dari kondisi yang tercatat.', text: 'Informasi barang dan riwayatnya membantu pengguna memahami kondisi sebelum menentukan langkah berikutnya.' },
  { title: 'Buka lebih banyak kemungkinan.', text: 'Perawatan, jual kembali, tukar, dan donasi memberi pilihan untuk melanjutkan penggunaan barang.' },
  { title: 'Jelaskan kontribusi dengan data.', text: 'Valora Impact menampilkan aktivitas yang memenuhi kriteria dan sudah tercatat, bersama penjelasan sumber serta batasannya.' },
];

const questions = [
  {
    question: 'Apakah saya perlu memverifikasi email?',
    answer: 'Kamu dapat membuat akun dan menyimpan catatan barang privat. Verifikasi email diperlukan sebelum membuat Listing atau mengajukan penawaran. Setelah mendaftar, periksa kotak masuk dan ikuti tautan verifikasi.',
  },
  {
    question: 'Bagaimana mulai mencatat barang?',
    answer: 'Buat akun, pilih kabupaten atau kota, lalu tambahkan foto, kategori, nama, dan kondisi barang melalui akunmu. Catatan barang tersimpan privat dan dapat diperbarui oleh pemilik.',
  },
  {
    question: 'Apa arti Valora Score?',
    answer: 'Valora Score membantu menjelaskan potensi sirkular barang berdasarkan rubrik kategori dan informasi yang diberikan pemilik. Score bukan sertifikat kondisi fisik atau jaminan harga jual.',
  },
  {
    question: 'Bagaimana barang tampil di Market?',
    answer: 'Lengkapi catatan dan penilaian barang, lalu ajukan Listing untuk jual kembali, tukar, atau donasi sesuai pilihan yang tersedia. Listing ditinjau sebelum tampil. Pengguna dapat menanyakan detail melalui percakapan dan mengajukan penawaran.',
  },
  {
    question: 'Bagaimana pembayaran dan serah terima dilakukan?',
    answer: 'Pembayaran dan serah terima diatur oleh para pihak setelah mencapai kesepakatan. Kesepakatan formal tercatat melalui penawaran dan transaksi di Valora. Transfer barang selesai setelah konfirmasi serah terima yang diperlukan tercatat.',
  },
];

export default function TentangKamiPage() {
  return <PublicShell>
    <main id="main-content" className="container public-information public-guide">
      <header id="valora" className="information-hero">
        <div>
          <h1>Kenali Valora.</h1>
          <p>Valora membantu menjaga nilai dan memperpanjang usia pakai barang melalui pencatatan, penilaian kondisi, perawatan, jual kembali, tukar, dan donasi.</p>
          <p>Identitas barang dan riwayatnya memberi tempat bagi setiap langkah yang tercatat. Valora merupakan karya INSYFEST 2026.</p>
          <div className="information-hero-actions"><Link href="/cara-kerja" className="button button-primary">Pelajari cara kerja<ArrowUpRight size={18} aria-hidden="true" /></Link></div>
        </div>
        <div className="information-hero-photo"><Image src="/images/editorial/passport-books.png" width={1260} height={1260} sizes="(max-width: 639px) calc(100vw - 32px), 43vw" alt="Ilustrasi buku yang dapat digunakan dan diteruskan kepada pemilik berikutnya" /></div>
      </header>
      <section id="misi" className="about-mission" aria-labelledby="mission-heading">
        <div className="public-section-heading"><h2 id="mission-heading">Lebih lama dipakai.<br />Lebih banyak kemungkinan.</h2><p>Kami ingin membantu pengguna memahami barang yang dimiliki dan memilih cara untuk melanjutkan usia pakainya.</p><Link href="/impact" className="editorial-link">Lihat catatan Impact<ArrowUpRight size={18} aria-hidden="true" /></Link></div>
        <ul className="about-principles">{principles.map(principle => <li key={principle.title}><h3>{principle.title}</h3><p>{principle.text}</p></li>)}</ul>
      </section>
      <section id="faq" className="about-faq" aria-labelledby="faq-heading">
        <div className="public-section-heading"><h2 id="faq-heading">Pertanyaan umum.</h2><p>Hal yang perlu kamu ketahui sebelum mulai memakai Valora.</p></div>
        <div className="faq-list">{questions.map(item => <details key={item.question} name="valora-faq" className="faq-item"><summary><span>{item.question}</span><Plus className="faq-expand" size={20} strokeWidth={1.6} aria-hidden="true" /><Minus className="faq-collapse" size={20} strokeWidth={1.6} aria-hidden="true" /></summary><p>{item.answer}</p></details>)}</div>
      </section>
      <section className="public-closing" aria-labelledby="about-closing-heading"><div><h2 id="about-closing-heading">Kenali pilihan untuk barangmu.</h2><p>Lihat bagaimana setiap layanan membantu langkah berikutnya.</p></div><Link href="/layanan" className="button button-primary">Lihat layanan<ArrowUpRight size={18} aria-hidden="true" /></Link></section>
    </main>
  </PublicShell>;
}
