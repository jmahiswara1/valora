import type { ReactNode } from 'react';
import { SiteHeader } from './header';
import { SiteFooter } from './footer';

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="valora-surface">
      <a className="public-skip-link" href="#main-content">Langsung ke konten</a>
      <SiteHeader appearance="renewed" />
      {children}
      <SiteFooter appearance="renewed" />
    </div>
  );
}
