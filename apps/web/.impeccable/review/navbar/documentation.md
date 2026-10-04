# Pemeriksaan dokumentasi navbar sticky

Tanggal: 3 Oktober 2026. Cakupan: refinement SiteHeader bersama setelah koreksi kanvas dan lebar baca 70ch.

[DESIGN.md](../../../DESIGN.md) dan [sidecar schema 2](../../design.json) diperbarui secara terbatas berdasarkan [SiteHeader](../../../src/components/site.tsx), [stylesheet bersama](../../../src/app/globals.css), serta [override publik](../../../src/app/public.css).

- Overview memperjelas bahwa navbar berlaku pada seluruh SiteHeader publik, termasuk Market dan halaman akun. Status migrasi isi halaman tetap mengikuti tahap yang disetujui.
- Layout dan Navigation mencatat sticky top 0, z-index 30, latar putih tanpa border/shadow, tinggi area header publik 88px/72px dan classic 72px/62px, serta kompensasi anchor 104px/88px dengan margin target publik 16px.
- Wordmark pada header versi renewed tanpa tagline, dan caption hero “Barang lama. Cerita baru.” dihapus sesuai arahan lanjutan pengguna.
- Pengguna mengonfirmasi dua tautan teks Cara kerja dan Impact. Ketiga ikon memakai hit area 44px, lingkaran visual 34px, SVG 19px dengan stroke 1.6, label akses, serta state hover/active/focus. Hingga 700px, tautan tersedia dalam menu mobile sementara ikon tetap terlihat.
- Tujuan lonceng adalah `/app`, keranjang adalah `/app/penawaran`, dan akun adalah `/masuk` atau `/app/profil` sesuai sesi. Tamu memakai return route `next` pada aktivitas privat; keranjang tetap mewakili fungsi Penawaran yang tersedia.
- Preview Public Navigation yang sudah ada diperbarui dengan SVG inline dari paket Lucide lokal, link tamu, geometri publik, dan state menu tertutup. Perilaku sesi serta buka/tutup menu dijalankan SiteHeader. Referensi preview lama ke button-small dihapus karena CTA tersebut telah diganti oleh ikon.
- Sembilan preview lain dan seluruh ekstensi sidecar identik dengan sebelum refinement. Token primitif frontmatter tidak diubah. Sidecar tetap memiliki sepuluh preview; Overview dan The Canvas Rule cocok dengan Markdown.

[Bukti navbar dari root](verification.md) dan [inspection.json](inspection.json) mencatat 24 observasi: 22 snapshot geometri pada enam route dan lima lebar 320/390/768/1440/1920px, serta dua observasi Escape. Root memeriksa seluruh 22 PNG. Typecheck, lint, dan build 45 route lulus. Documenter membaca bukti tersebut tanpa menjalankan browser, tes, detector, atau membuat capture/aset.

[Review penuh kanvas sebelumnya](../flat-layout/finish-review-initial.md) dan [ship pada satu fix 70ch](../finish-review-flat.md) mempertahankan cakupannya sendiri. Navbar baru mengikuti inspeksi source dan render terfokus root di direktori ini; catatan dokumentasi ini tidak menetapkan verdict visual.
