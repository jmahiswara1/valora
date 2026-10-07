# Dokumentasi Valora

**Status:** spesifikasi MVP dan implementasi tahap 1–6 karya INSYFEST 2026, 2 Oktober 2026. O04–O09 telah ditutup sebagai baseline rancangan K01–K06; O11 tetap khusus sebelum operasi publik. Perbedaan Pencil diselesaikan saat implementasi UI sesuai PRD/docs. [Status kode tahap 6](21-stage6-implementation.md) memisahkan fitur yang telah berjalan dari kontrak tahap berikutnya.

Dokumen ini menerjemahkan [PRD v1.24](../PRD.md) menjadi keputusan, alur, aturan, model data, kontrak API, dan skenario penerimaan yang dapat diperiksa sebelum implementasi. Valora disiapkan untuk lomba INSYFEST 2026; PRD menjadi acuan perilaku produk. Kanvas Pencil Valora menjadi referensi visual; perbedaan atau kekosongan desain dicatat dalam audit dan diselesaikan langsung dalam UI yang dikodekan.

| Dokumen | Isi |
| --- | --- |
| [00 — Konteks INSYFEST 2026](00-competition-context.md) | Fakta yang sudah diketahui, rincian lomba yang perlu panduan resmi, dan rencana demonstrasi sementara. |
| [01 — Keputusan produk](01-product-decisions.md) | Keputusan pengguna D01–D20 dan D22, baseline K01–K06, serta O11 untuk operasi publik. |
| [02 — Alur dan status](02-flows-and-states.md) | Alur empat jalur, aktor, konfirmasi, dan rancangan state machine. |
| [03 — Domain dan penilaian](03-domain-and-scoring.md) | Data, aturan Score, Assessment parsial, Passport, Impact, serta privasi. |
| [04 — Audit desain Pencil](04-pencil-design-review.md) | Inventaris layar, token visual, kecocokan dengan PRD, dan pekerjaan desain. |
| [05 — Rencana teknis](05-technical-plan.md) | Batas modul, konsistensi data, tahapan implementasi, dan verifikasi. |
| [06 — Rubrik kategori MVP](06-category-rubric-draft.md) | Enam indikator, pilihan lima tingkat, sembilan kategori/subkategori, keselamatan, dan contoh batas. |
| [07 — Privasi Passport](07-passport-privacy-draft.md) | Proyeksi event dan hak baca publik, owner, peserta transaksi, serta admin kasus. |
| [08 — Design system MVP](08-design-system.md) | Token dari layar Pencil, hasil pemeriksaan kontras, komponen, dan state UI yang perlu dilengkapi. |
| [09 — Moderasi MVP](09-moderation-policy-draft.md) | Gerbang keselamatan kategori, review Listing, penangguhan, laporan, dan audit. |
| [10 — Keputusan rincian MVP](10-mvp-implementation-decisions.md) | Penutupan O04–O09: status, ekonomi, rubrik, Passport, akun/data, koreksi. |
| [11 — Model data](11-data-model.md) | Entitas, relasi, kendala unik, dan transaksi atomik. |
| [12 — Kontrak API](12-api-contract.md) | Endpoint, hak akses, payload, idempotensi, dan error. |
| [13 — Penerimaan dan demo](13-acceptance-and-demo.md) | Fixture dan skenario yang harus lulus untuk empat jalur MVP. |
| [14 — Audit Graphify](14-graphify-audit.md) | Temuan peta awal hubungan PRD/docs, keputusan yang dipengaruhi, dan batas ekstraksi. |
| [15 — Implementasi tahap 1](15-stage1-implementation.md) | Fitur yang sudah berjalan, keputusan teknis, pengujian, dan batas tahap. |
| [16 — Implementasi tahap 2](16-stage2-implementation.md) | Rubrik, Assessment, rekomendasi, Repair, privasi foto bukti, UI, dan bukti uji. |
| [17 — Implementasi tahap 3](17-stage3-implementation.md) | Market, Listing, moderasi, Offer, percakapan, laporan, rute UI, batas tahap, dan bukti verifikasi. |
| [18 — Implementasi tahap 4](18-stage4-implementation.md) | Reservasi, konfirmasi, transfer atomik, sengketa/bukti privat, admin, pengingat, fixture, dan verifikasi. |
| [19 — Implementasi tahap 5](19-stage5-implementation.md) | Passport, lima metrik Impact, koreksi, operasi admin, rubrik/acuan, penjelasan template, retensi, fixture, dan verifikasi. |
| [20 — Cakupan auth dan sesi tahap 6](20-stage6-auth-session-plan.md) | Penguatan auth/session management pada setiap halaman, redirect, logout/cache, antartab, sesi aktif, dan kriteria penerimaan. |
| [21 — Implementasi tahap 6](21-stage6-implementation.md) | Auth/sesi seluruh 45 halaman, reautentikasi, pemulihan tindakan, konkurensi, jobs, pagination, serta bukti verifikasi. |
| [Graphify — laporan dan graph](../graphify-out/GRAPH_REPORT.md) | Laporan awal dan tautan ke graph interaktif untuk menelusuri dependensi lintas modul. |

**Asal keputusan:** D01–D20 dan D22 berasal dari PRD/diskusi pengguna. K01–K06 adalah baseline rancangan pra-kode yang diturunkan untuk menutup celah; dapat direvisi bersama tanpa mengubah snapshot historis diam-diam. O11 menunggu keputusan saat menyiapkan operasi publik, bukan prasyarat dokumen MVP lomba.

## Pintu masuk implementasi

Rubrik, moderasi Passport, retensi demo, model data, kontrak API, dan matriks penerimaan terdokumentasi. Tahap 1–6 memakai token `v1`, memperbaiki Landing mobile, dan menyediakan OpenAPI mesin untuk endpoint yang sudah berjalan. Kanvas Pencil tetap referensi dan tidak diedit. Tahap 6 melengkapi auth/sesi, retensi, konkurensi, dan hardening dalam [rencana teknis](05-technical-plan.md); target MVP tetap mencakup seluruh fitur pada PRD. Pengoperasian publik untuk transaksi nyata memerlukan keputusan O11 tersendiri.

## Struktur source terkini

[22 — Struktur source dan pemetaan file](22-file-organization.md) mencatat perapihan frontend/backend/contracts, skrip dan test. Catatan tahap sebelumnya tetap menjadi bukti historis.

## Perluasan setelah MVP

[23 — Favorit](23-favorites.md) mencatat penyimpanan privat akun, tombol hati,
daftar dashboard, kontrak OpenAPI 1.8.0, dan skenario verifikasi.

[24 — Pusat Notifikasi](24-notification-center.md) mencatat sumber aktivitas,
preview lonceng, riwayat/filter, penandaan dibaca, dan OpenAPI 1.9.0.

[25 — Passport QR](25-passport-qr.md) mencatat QR sejak barang didaftarkan,
tautan kanonis, unduhan PNG, privasi, konfigurasi domain, dan OpenAPI 1.10.0.

[26 — Pencarian Tersimpan](26-saved-searches.md) mencatat filter URL Market,
pengelolaan privat, notifikasi publikasi pertama, worker/checkpoint, watermark
aktivasi, migrasi historis, dan OpenAPI 1.11.0.

[27 — Profil Publik dan Ulasan](27-public-profiles-reviews.md) mencatat profil
Market, rating dari transaksi selesai, foto opt-in, balasan, moderasi/retensi
dan kontrak OpenAPI 1.12.0.

[28 — Peningkatan Chat](28-chat-enhancements.md) mencatat foto privat, cursor
baca, SSE bersama, notifikasi percakapan, bukti kasus dan kontrak OpenAPI 1.13.0.

[29 — Koordinasi Serah Terima](29-handover-coordination.md) mencatat usulan jadwal, alamat privat, resi per barang, linimasa, pengingat, akses admin dan retensi. Kontrak OpenAPI terkini 1.14.0.
