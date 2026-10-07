import type { Metadata } from 'next';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/500-italic.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import "../styles/globals.css";
import "../styles/public.css";
import "../styles/auth.css";
import "../styles/information.css";
import "../styles/market.css";
import "../styles/listing-detail.css";
import "../styles/select.css";
import "../styles/favorites.css";
import "../styles/notifications.css";
import { Providers } from '@/components/layout/providers';

export const metadata: Metadata = {
  title: { default: 'Valora - jaga nilai barang', template: '%s | Valora' },
  description: 'Catat barangmu, pahami nilainya, dan beri kesempatan baru melalui Valora.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id" data-scroll-behavior="smooth"><body><Providers>{children}</Providers></body></html>;
}
