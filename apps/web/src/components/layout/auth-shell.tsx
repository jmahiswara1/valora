'use client';

import Image from 'next/image';
import { SiteHeader } from './header';

export function AuthShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <div className="valora-surface auth-surface">
    <a className="public-skip-link" href="#auth-main">Ke formulir akun</a>
    <SiteHeader appearance="renewed" />
    <div className="container auth-layout">
      <aside className="auth-story" aria-label="Tentang akun Valora">
        <Image src="/images/editorial/valora-hero-v2.png" fill sizes="(max-width: 700px) 1px, (max-width: 1023px) 200vw, 100vw" alt="Kursi, buku, lampu, keyboard, dan headphone di ruang kerja" className="auth-story-photo" />
        <div className="auth-story-copy">
          <h2>Satu tempat untuk barang yang kamu miliki.</h2>
          <p>Catat kondisinya, rawat nilainya, dan temukan kesempatan berikutnya bersama Valora.</p>
        </div>
      </aside>
      <main id="auth-main" className="auth-main" tabIndex={-1}>
        <div className="auth-panel">
          <h1>{title}</h1>
          <p>{description}</p>
          {children}
        </div>
      </main>
    </div>
  </div>;
}
