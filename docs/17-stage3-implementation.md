# Implementasi tahap 3 — Pasar dan interaksi

**Status:** selesai untuk tahap 3 pada 30 September 2026, sebagai bagian dari karya INSYFEST 2026. Market, Listing, moderasi awal/ulang, negosiasi Offer, chat, block, dan laporan telah diterapkan. Tahap ini belum menyelesaikan seluruh MVP: penerimaan Offer, reservasi, Transaction, Passport, Impact, dan alur konfirmasi belum dibuat. Tidak ada pemrosesan pembayaran atau verifikasi serah terima fisik.

Dokumen ini mencatat perilaku yang benar-benar berjalan, bukan seluruh target PRD. Aturan produk dan alur lengkap tetap mengacu pada [PRD](PRD.md), [keputusan produk](01-product-decisions.md), [model data](11-data-model.md), [kontrak API](12-api-contract.md), serta [matriks penerimaan MVP](13-acceptance-and-demo.md). Kanvas Pencil tidak diubah; layar web diselaraskan saat implementasi.

## Perilaku yang sudah berjalan

### Market dan Listing

- Market publik mendukung kata kunci, kategori, tipe, kota, kondisi, rentang harga Resell, pengurutan, cursor, dan limit. Urutan: terbaru, harga naik/turun untuk Resell, atau Score tertinggi dengan nilai kosong di akhir. Cursor mempertahankan filter dan pemutus seri agar halaman tidak mengulang data.
- Detail publik hanya memuat snapshot aktif dan identitas pemilik berupa nama tampilan serta kota. Foto publik hanya dapat dibaca jika masih ada di revisi terkini Listing `ACTIVE`; foto kembali `404` ketika Listing dijeda atau direvisi.
- Owner terverifikasi membuat Listing Resell, Exchange, atau Donate dari Item dan Assessment terkini. Resell perlu Assessment lengkap dan harga; Exchange perlu preferensi pertukaran; Donate dapat tanpa data ekonomi lengkap bila keselamatan dan aturan kategori mengizinkan.
- Submit mengulang pemeriksaan status akun, kepemilikan, revisi Item/Assessment/rubrik, rekomendasi, keselamatan, foto, dan kota. Listing masuk `PENDING_REVIEW`; antrean dan detail admin menampilkan foto melalui URL privat bertanda tangan yang hanya diberikan untuk review tertunda.
- Keputusan moderator menyimpan alasan, risiko, versi kebijakan, reviewer, dan kunci idempotensi. Approve membuat Listing aktif. `REQUEST_CHANGES` dan `REJECT` saat ini sama-sama menyimpan status Listing `REJECTED`; owner memperbaiki dengan revisi baru lalu mengirim ulang.
- Perubahan pada Item mem-pause Listing aktif dan mengakhiri Offer terbuka dengan alasan `LISTING_REVISED`. Perubahan Listing aktif juga mem-pause Listing dan mengakhiri Offer lama. Admin dapat menangguhkan Listing dari laporan, lalu melepasnya hanya ke review ulang atau menariknya. Review ulang menambah baris audit baru walau masih memakai revisi Listing yang sama.

### Offer dan percakapan

- Offer menyimpan revisi Listing yang ditawar, versi, hash request, dan `clientRequestId` unik untuk retry. Offer Resell membawa harga; Exchange membawa satu Item penawar yang memenuhi syarat; Donate tidak membawa harga atau Item tukar.
- Offer terbuka kedaluwarsa tujuh hari setelah dibuat. Counteroffer Resell membuat revisi append-only, mengubah pihak yang harus merespons, dan memperbarui tenggat. Pihak berhak dapat menolak atau penawar dapat menarik Offer.
- Endpoint penerimaan Offer belum tersedia. Status `ACCEPTED` ada dalam enum data agar skema siap untuk tahap lanjutan, tetapi belum dapat dicapai melalui alur produk. Offer saat ini adalah negosiasi dan bukan persetujuan formal atau reservasi.
- Satu percakapan dibuat per pasangan peserta pada Listing. Pesan teks memiliki ID kirim client dan sequence agar retry tidak menggandakan pesan; cursor baca menghasilkan unread count. Histori hanya terbuka untuk peserta.
- SSE mengirim metadata percakapan, bukan isi pesan. API menyimpan pesan di PostgreSQL dan UI menggunakan polling REST bila SSE terputus. Event SSE saat ini berada di memori proses; beberapa instance memerlukan transport/pub-sub bersama.
- Block mencegah pesan dan interaksi Offer baru antar pihak yang diblokir. Laporan dapat menargetkan Listing, pesan, atau akun. Antrean admin tidak memuat isi pesan; tindakan memiliki alasan dan catatan audit.

## Route aplikasi web

| Tujuan | Route |
| --- | --- |
| Jelajahi Market dan detail Listing | `/market`, `/market/[listingId]` |
| Kelola Listing sendiri | `/app/listings`, `/app/listings/new`, `/app/listings/[id]` |
| Lihat dan tanggapi Offer | `/app/penawaran` |
| Daftar percakapan dan chat | `/app/pesan`, `/app/pesan/[id]` |
| Review Listing | `/app/admin/moderasi`, `/app/admin/moderasi/[revisionId]` |
| Kelola laporan | `/app/admin/laporan` |

Navigasi app-shell dan header publik menautkan fitur yang berhak dilihat aktor. UI menangani pemuatan, kosong, gagal, dan tidak berhak pada layar utama. Keputusan desain mengacu pada token `v1`; implementasi responsif memakai struktur yang tersedia di proyek.

## Data dan migrasi

Tahap 3 menambahkan model Prisma `Listing`, `ListingRevision`, `ListingRevisionMedia`, `ModerationReview`, `Offer`, `OfferRevision`, `Conversation`, `Message`, `UserBlock`, `Report`, dan `AdminAction`, beserta enum statusnya.

- `20260929183129_stage3_market` menambahkan tabel dan relasi pasar.
- `20260930101500_stage3_integrity_constraints` menambahkan indeks unik parsial satu Listing `ACTIVE`/`RESERVED` per Item dan check constraint urutan peserta, sequence pesan, cursor baca, serta blokir diri sendiri.
- `20260930103000_stage3_review_replay` mengubah indeks review per revisi menjadi non-unik supaya review ulang tidak menimpa audit.

Migrasi diterapkan secara additive; seed demo tetap dipakai. Penyimpanan foto dan email masih lokal sesuai setup tahap 1. Tidak ada rahasia atau kredensial demo yang didokumentasikan di sini.

## Endpoint API inti

Prefix endpoint adalah `/api/v1`; daftar lengkap beserta hak akses ada di [kontrak API tahap 3](12-api-contract.md#kontrak-tahap-3-yang-berjalan). Route yang tersedia:

- Market: `GET /market`, `GET /market/{listingId}`, `GET /market/{listingId}/media/{mediaId}`.
- Listing owner: `POST /items/{itemId}/listings`, `GET /listings/mine`, `GET /listings/{id}`, `PATCH /listings/{id}`, `POST /listings/{id}/submit`, `POST /listings/{id}/withdraw`.
- Moderasi admin: `GET /admin/listing-reviews`, `GET /admin/listing-reviews/{revisionId}`, `POST /admin/listing-reviews/{revisionId}/decide`, `POST /admin/listings/{id}/suspend`, `POST /admin/listings/{id}/release`.
- Offer: `POST /listings/{listingId}/offers`, `GET /offers/mine`, `GET /offers/{id}`, `POST /offers/{id}/counter`, `/reject`, dan `/withdraw`.
- Percakapan: `POST /listings/{listingId}/conversations`, `GET /conversations`, `/conversations/unread-count`, `/conversations/stream`, `GET /conversations/{id}/messages`, `POST /conversations/{id}/messages`, dan `/conversations/{id}/read`.
- Block dan laporan: `POST /blocks`, `DELETE /blocks/{userId}`, `POST /reports`, `GET /admin/reports`, `POST /admin/reports/{id}/resolve`.

Endpoint penerimaan Offer dan route Transaction belum didaftarkan di OpenAPI; lihat [Tahap 4 pada rencana teknis](05-technical-plan.md#urutan-pengerjaan-hingga-mvp-lengkap).

## Verifikasi

Migrasi lokal dan test memakai PostgreSQL `valora_dev`/`valora_test`. Jalankan dari root workspace setelah PostgreSQL tersedia:

```powershell
corepack pnpm db:deploy
corepack pnpm db:seed
corepack pnpm test
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm build
```

Pada verifikasi tahap 3, `corepack pnpm test` lulus: enam uji mesin Assessment, smoke API tahap 1, tahap 2, dan tahap 3. Smoke tahap 3 mencakup Market dan cursor harga, tiga jenis Listing, foto admin pada review dan foto publik saat aktif, suspend/release/review ulang pada revisi sama, retry Offer, counteroffer dua arah, privasi Offer/chat, unread, laporan, dan auto-pause/expiry saat Item berubah.

## Batas dan pekerjaan berikutnya

- Tahap 4: penerimaan Offer yang idempoten, reservasi Item/Listing, Transaction, konfirmasi serah terima, pembatalan, dan sengketa.
- Tahap 5: Passport, Impact, audit serta operasi admin yang lebih lengkap, dan AI Explainer beserta fallback.
- Tahap 6: hardening menyeluruh, termasuk konkurensi, privasi, aksesibilitas, dan uji end-to-end antartahap.
- Expiry Offer diperiksa saat baca/tindakan; worker expiry terjadwal belum dibuat. Pembatas laju chat sekarang berada di proses API lokal dan bukan penyimpanan bersama.
- Uji otomatis tahap 3 belum mencakup navigasi browser end-to-end pada ukuran 390 px dan 1440 px. Matriks demo penuh tetap menjadi target penerimaan setelah tahap 4–6.
