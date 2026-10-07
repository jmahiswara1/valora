import { parseMarketSearch, marketSearchUrl } from '@valora/contracts';
// Known routes accepted as post-login destinations.
export const routePatterns = ["/profil/[id]", "/", "/app", "/app/pencarian", "/app/favorit", "/app/notifikasi", "/app/penawaran/[id]", "/cara-kerja", "/layanan", "/tentang-kami", "/daftar", "/impact", "/lupa-kata-sandi", "/market", "/masuk", "/reset-password", "/verifikasi-email", "/passport/[id]", "/market/[listingId]", "/app/admin", "/app/barang", "/app/impact", "/app/listings", "/app/penawaran", "/app/pesan", "/app/profil", "/app/transaksi", "/app/transaksi/[id]", "/app/pesan/[id]", "/app/listings/new", "/app/listings/[id]", "/app/koreksi/[id]", "/app/barang/baru", "/app/barang/[id]", "/app/barang/[id]/edit", "/app/barang/[id]/passport", "/app/barang/[id]/penilaian", "/app/barang/[id]/perbaikan", "/app/barang/[id]/penilaian/baru", "/app/barang/[id]/penilaian/[assessmentId]", "/app/admin/analitik", "/app/admin/audit", "/app/admin/laporan", "/app/admin/moderasi", "/app/admin/pengguna", "/app/admin/rubrik", "/app/admin/sengketa", "/app/admin/transaksi", "/app/admin/sengketa/[id]", "/app/admin/moderasi/[revisionId]", "/app/admin/laporan/[id]", "/app/admin/koreksi/[id]"] as const;
export function safeNext(value: string | null, role?: string) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\x00-\x20]/.test(value)) return '/app';
  const pathname = value.split(/[?#]/)[0];
  if (pathname.includes('%')) return '/app';
  const marketPath = pathname === '/market' || /^\/market\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pathname);
  if (marketPath) {
    if (pathname !== '/market') return pathname;
    const parsed = parseMarketSearch(new URL(value, 'https://valora.invalid').searchParams);
    return parsed.success ? marketSearchUrl(parsed.data, parsed.data.sort) : pathname;
  }
  if (/^\/profil\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pathname)) {
    return pathname + (new URL(value, 'https://valora.invalid').searchParams.get('tab') === 'ulasan' ? '?tab=ulasan' : '');
  }
  if (!pathname.startsWith('/app') || (pathname.startsWith('/app/admin') && role !== 'ADMIN')) return '/app';
  const known = routePatterns.some((pattern) => new RegExp('^' + pattern.replace(/\[[^\]]+\]/g, '[^/]+') + '$').test(pathname));
  return known ? pathname : '/app';
}
