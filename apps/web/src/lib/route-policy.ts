// Route inventory is generated from the 47 page entry points.
export const routePatterns = ["/", "/app", "/cara-kerja", "/layanan", "/tentang-kami", "/daftar", "/impact", "/lupa-kata-sandi", "/market", "/masuk", "/reset-password", "/verifikasi-email", "/passport/[id]", "/market/[listingId]", "/app/admin", "/app/barang", "/app/impact", "/app/listings", "/app/penawaran", "/app/pesan", "/app/profil", "/app/transaksi", "/app/transaksi/[id]", "/app/pesan/[id]", "/app/listings/new", "/app/listings/[id]", "/app/koreksi/[id]", "/app/barang/baru", "/app/barang/[id]", "/app/barang/[id]/edit", "/app/barang/[id]/passport", "/app/barang/[id]/penilaian", "/app/barang/[id]/perbaikan", "/app/barang/[id]/penilaian/baru", "/app/barang/[id]/penilaian/[assessmentId]", "/app/admin/analitik", "/app/admin/audit", "/app/admin/laporan", "/app/admin/moderasi", "/app/admin/pengguna", "/app/admin/rubrik", "/app/admin/sengketa", "/app/admin/transaksi", "/app/admin/sengketa/[id]", "/app/admin/moderasi/[revisionId]", "/app/admin/laporan/[id]", "/app/admin/koreksi/[id]"] as const;
export function safeNext(value: string | null, role?: string) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\x00-\x20%]/.test(value)) return '/app';
  const pathname = value.split(/[?#]/)[0];
  const marketPath = pathname === '/market' || /^\/market\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pathname);
  if (marketPath) return pathname;
  if (!pathname.startsWith('/app') || (pathname.startsWith('/app/admin') && role !== 'ADMIN')) return '/app';
  const known = routePatterns.some((pattern) => new RegExp('^' + pattern.replace(/\[[^\]]+\]/g, '[^/]+') + '$').test(pathname));
  return known ? pathname : '/app';
}
