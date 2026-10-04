'use client';

import Link from 'next/link';
import { Instagram, Mail, Youtube } from 'lucide-react';

export function SiteFooter({ appearance = 'classic' }: { appearance?: 'classic' | 'renewed' } = {}) {
  return <footer className={`site-footer${appearance === 'renewed' ? ' site-footer-renewed' : ''}`}>
    <div className="container">
      <div className="footer-top">
        <div className="footer-brand">
          <Link className="wordmark" href="/">valora</Link>
          <div className="footer-social-icons" role="group" aria-label="Ikon sosial dan kontak">
            <span className="footer-social-mark" role="img" aria-label="Instagram" title="Instagram"><Instagram size={19} strokeWidth={1.6} aria-hidden="true" /></span>
            <span className="footer-social-mark" role="img" aria-label="TikTok" title="TikTok"><TikTokIcon /></span>
            <span className="footer-social-mark" role="img" aria-label="Gmail" title="Gmail"><Mail size={19} strokeWidth={1.6} aria-hidden="true" /></span>
            <span className="footer-social-mark" role="img" aria-label="YouTube" title="YouTube"><Youtube size={19} strokeWidth={1.6} aria-hidden="true" /></span>
          </div>
        </div>
        <div className="footer-navigation">
          <nav className="footer-nav-group" aria-label="Jelajahi">
            <span className="footer-nav-heading">Jelajahi</span>
            <Link href="/market">Market</Link><Link href="/cara-kerja">Cara kerja</Link><Link href="/impact">Impact</Link>
          </nav>
          <nav className="footer-nav-group" aria-label="Layanan">
            <span className="footer-nav-heading">Layanan</span>
            <Link href="/layanan#passport">Valora Passport</Link>
            <Link href="/layanan#penilaian">Penilaian kondisi</Link>
            <Link href="/layanan#perawatan">Catatan perawatan</Link>
            <Link href="/layanan#jual-tukar-donasi">Jual, tukar &amp; donasi</Link>
          </nav>
          <nav className="footer-nav-group" aria-label="Tentang kami">
            <span className="footer-nav-heading">Tentang kami</span>
            <Link href="/tentang-kami#valora">Tentang Valora</Link>
            <Link href="/tentang-kami#misi">Misi &amp; nilai</Link>
            <Link href="/tentang-kami#faq">Pertanyaan umum</Link>
          </nav>
          <nav className="footer-nav-group" aria-label="Akun">
            <span className="footer-nav-heading">Akun</span>
            <Link href="/daftar">Daftar</Link><Link href="/masuk">Masuk</Link>
          </nav>
        </div>
      </div>
      <div className="footer-bottom"><span>Valora · INSYFEST 2026</span><span>Barang baik punya cerita berikutnya.</span></div>
    </div>
  </footer>;
}

function TikTokIcon() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.14V2h-3.7v13.26a2.9 2.9 0 1 1-2.9-2.9 2.8 2.8 0 0 1 .88.14V8.72a6.6 6.6 0 1 0 5.72 6.54V9.04a8.45 8.45 0 0 0 4.94 1.58V6.93a4.8 4.8 0 0 1-1.17-.24Z" /></svg>;
}
