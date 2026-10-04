# Pemeriksaan dokumentasi koreksi kanvas publik

Tanggal: 3 Oktober 2026. Cakupan: koreksi kanvas Beranda, Cara Kerja, Impact publik, serta header/footer bersama.

Pemeriksaan ini mengikuti referensi `impeccable/reference/document.md` untuk perubahan sistem yang sudah ada. Tidak ditemukan ketidaksesuaian dokumentasi yang material dalam koreksi yang disetujui. `DESIGN.md` dan `.impeccable/design.json` dipertahankan tanpa perubahan oleh documenter.

- [DESIGN.md](../../../DESIGN.md) mencatat shell `0px`, kanvas `width: 100%` dan `min-height: 100dvh`, margin/border/radius luar 0, isi tanpa batas maksimum, serta gutter 24px pada desktop/tablet dan 16px hingga 639px.
- [Stylesheet publik](../../../src/app/public.css) menerapkan geometri tersebut, termasuk `max-width: none` untuk menghapus batas kelas container Tailwind. Header/footer memakai radius 0; garis pemisah footer tetap tercatat sebagai detail komponen.
- [Sidecar](../../design.json) memakai schema 2. Overview, karakteristik, dan The Canvas Rule selaras dengan Markdown. Seluruh sepuluh preview komponen serta token primitif frontmatter tetap tersedia; radius hero, foto, kartu, dan kontrol tetap mengikuti perannya.
- [Kontrak publik](../../briefs/public.md), [PRD v1.16](../../../../../PRD.md), dan [catatan sistem desain](../../../../../docs/08-design-system.md) selaras pada batas tahap dan koreksi kanvas. Lima atribut Image `sizes` dalam dua halaman publik mengikuti lebar gambar baru.
- [Catatan verifikasi](verification.md), [inspection.json](inspection.json), serta daftar capture final diperiksa sebagai bukti yang sudah tersedia: 20 kasus pada empat viewport, 45 route pada build, dan 12 kombinasi halaman/viewport dengan `validCanvas: true`. Pemeriksaan ini tidak menjalankan ulang browser, build, tes, atau detector dan tidak membuat preview maupun aset.

Catatan format di luar cakupan: metadata warna sidecar yang diwarisi belum memiliki array tonalRamp sebagaimana dijelaskan referensi document. Hal itu tidak mengubah aturan kanvas dan tidak diperbaiki dalam handoff ini.

Pemeriksaan tambahan setelah perbaikan lebar baca Cara Kerja: selector `.how-steps p, .how-steps small, .passport-explanation p` memakai `max-width: 70ch`. Bagian Typography dan The Canvas Rule pada `DESIGN.md`, body The Canvas Rule pada sidecar, serta `docs/08-design-system.md` mencatat batas yang sama; teks aturan Markdown dan sidecar identik. Container halaman tetap `max-width: none`, dengan gutter 24px/16px. Schema 2 dan sepuluh preview komponen tetap tersedia. Hasil ini hanya menambahkan catatan pemeriksaan; dokumen sistem tidak memerlukan perbaikan oleh documenter. Capture final setelah perubahan lebar baca sedang diselesaikan saat pemeriksaan tambahan ini.

Verdict visual menjadi tanggung jawab [finish review koreksi layout](../finish-review-flat.md); pemeriksaan dokumentasi ini tidak menetapkan atau mengantisipasi verdict tersebut.
