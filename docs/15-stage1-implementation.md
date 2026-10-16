# Implementasi tahap 1 — fondasi Valora

**Status:** tahap 1 selesai pada lingkungan pengembangan lokal, 29 September 2026. Proyek ini disiapkan untuk INSYFEST 2026. [PRD](PRD.md) tetap acuan perilaku produk; dokumen ini memetakan bagian yang sudah berjalan agar tahap 2 tidak mengira kontrak masa depan telah tersedia.

## Yang sudah dapat dipakai

| Area | Hasil tahap 1 |
| --- | --- |
| Web | Landing, Cara Kerja, daftar, masuk, verifikasi, pemulihan kata sandi, ringkasan akun, daftar/tambah/detail/edit Item, profil, gerbang admin. Layout 1440 px dan 390 px memakai token visual v1. |
| Akun | Sesi cookie opak, Argon2id, CSRF, verifikasi email 30 menit sekali pakai, reset kata sandi, perubahan email dengan verifikasi, logout, penutupan dan anonimisasi terjadwal 30 hari. Akun belum terverifikasi boleh mencatat Item. |
| Katalog | 514 kabupaten/kota dan 7 kategori utama, 3 subkategori Hobi awal. Kategori Hobi lain belum aktif. |
| Item | Item privat owner, pagination cursor, versi edit, 1–8 foto. Foto pertama divalidasi sebelum pembuatan Item. Tidak ada nilai Score palsu di dashboard. |
| Media | Tiket unggah 15 menit, batas 8 MiB per berkas, sniff JPEG/PNG/WebP, proses ulang WebP tanpa metadata asal, URL privat bertanda tangan lima menit, pembersihan tiket yatim setelah 24 jam. |
| Operasi lokal | PostgreSQL `valora_dev`/`valora_test`, migrasi Prisma, seed idempoten, email lokal di `.local/mail`, media di `.local/media`, kredensial demo lokal di `.local/demo-credentials.json`. Semua lokasi tersebut diabaikan Git. |

## Yang belum tersedia

Assessment/Score, Repair, Market/Listing, Offer, chat, Transaction, Passport, Impact, moderasi dan analytics admin, AI Explainer, serta operasional pembayaran/serah terima berada pada tahap 2–6. Halaman publik menyebut fitur berikutnya sebagai rencana, bukan angka atau status nyata. Gerbang admin tahap 1 hanya membuktikan otorisasi peran; belum ada konsol moderasi.

## Keputusan teknis yang terpakai

- Frontend Next.js 16, backend NestJS 12, PostgreSQL dan Prisma 7. Kontrak input dan tipe respons bersama ada di `packages/contracts`; OpenAPI lokal tahap 1 tersedia di `/api/docs` dan `/api/docs-json`, termasuk skema request/response, error, dan keamanan. Modul berikutnya menambahkan endpoint masing-masing.
- Foto awal memakai tiket tanpa `itemId`. Server mengonsumsi tiket dalam transaksi yang sama dengan pembuatan Item; unggahan gagal tidak membuat Item. Foto tambahan baru difinalisasi pada Item milik owner.
- Email lokal ditulis ke berkas untuk demo. Adapter SMTP dan penyimpanan awan dibutuhkan sebelum deployment multi-instance. Secret lokal berada di `apps/api/.env.local`, tidak di source control.
- Snapshot kota tahap 1 berasal dari dataset publik [Wilayah Indonesia API oleh emsifa](https://github.com/emsifa/api-wilayah-indonesia/tree/master/api), diambil 29 September 2026 dan disimpan di `apps/api/prisma/data/cities.json`. Kode wilayah dan label perlu divalidasi lagi terhadap sumber resmi saat deployment publik; jangan menyiratkan bahwa file ini berasal langsung dari BRIN.
- Endpoint Item masih privat. Akses publik hanya pada konten statis dan katalog; proyeksi Listing/Passport baru dirilis setelah kebijakan privasinya diimplementasikan.

## Verifikasi yang sudah dilakukan

Build, pemeriksaan tipe, dan lint web/API lulus. `pnpm test` menjalankan migrasi/seed di `valora_test`, lalu menguji OpenAPI, CSRF, pendaftaran, verifikasi sekali pakai, login, pemulihan kata sandi, syarat foto pertama, validasi isi gambar, unggah dan akses foto, isolasi owner lain, gerbang admin, konflik versi, dan penutupan akun. Pemeriksaan browser pada 1440 px dan 390 px mencakup pendaftaran, masuk, dashboard, formulir Item, pembuatan Item, dan tampilan foto privat; tidak ditemukan galat runtime atau gulir horizontal. Satu Item sintetis berlabel data demo disimpan pada akun contoh lokal untuk peninjauan.

## Menjalankan lokal

Lihat [README proyek](../README.md) untuk persiapan PostgreSQL, migrasi, seed, dan menjalankan web/API. Tidak ada kredensial yang perlu ditaruh dalam file teracak versi Git.
