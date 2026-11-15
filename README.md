# Valora

*Keep Things Valuable*

Platform sirkular untuk merawat, menilai, menjual, menukar, dan mendonasikan barang. Valora menyediakan Passport riwayat barang, pencatatan Impact, koordinasi serah terima melalui chat, dan bantuan AI opsional.

## Setup lokal

Siapkan **Node.js 24.15+**, **pnpm 11.28.0**, dan **PostgreSQL** yang berjalan di `127.0.0.1:5432`. Gunakan akun admin PostgreSQL yang dapat membuat role dan database. Bila pnpm belum terpasang:

```sh
npm install --global pnpm@11.28.0
```

Ekstrak atau clone project, buka terminal pada folder yang berisi `package.json`, lalu jalankan berurutan:

```sh
pnpm install --frozen-lockfile
node apps/api/scripts/database/setup.mjs
pnpm --filter @valora/contracts build
pnpm db:deploy
pnpm db:seed
pnpm dev
```

Setup database meminta password admin PostgreSQL (user default `postgres`; input tidak ditampilkan). Skrip membuat role `valora_app`, database `valora_dev` dan `valora_test`, serta konfigurasi dan kunci acak di `apps/api/.env.local`. Jika konfigurasi tersebut sudah ada, setup melewatinya. Template variabel tersedia di [apps/api/.env.example](apps/api/.env.example).

| Layanan | Alamat |
| --- | --- |
| Aplikasi | http://localhost:3000 |
| API | http://127.0.0.1:4000/api/v1 |
| Swagger | http://127.0.0.1:4000/api/docs |

Biarkan terminal `pnpm dev` berjalan. Hentikan dengan `Ctrl+C`. Pada pemakaian berikutnya cukup jalankan `pnpm dev`; setelah pembaruan schema, jalankan `pnpm db:deploy` terlebih dahulu.

## Akun dan alur demo

Seed membuat akun berikut. Kata sandi bersama dihasilkan saat seed dan tersimpan pada `.local/demo-credentials.json` di komputer yang menjalankan setup.

| Peran | Email |
| --- | --- |
| Pemilik barang | `owner.demo@valora.local` |
| Anggota | `member.demo@valora.local` |
| Pembeli | `buyer.demo@valora.local` |
| Admin | `admin.demo@valora.local` |

Untuk mengisi Market dengan 40 Listing sintetis, jalankan pada terminal lain dari root project:

```sh
pnpm demo:items
```

Alur singkat: jelajahi Market → masuk sebagai pembeli → kirim penawaran → masuk sebagai pemilik pada browser/profil terpisah untuk menerima → buka transaksi → usulkan jadwal melalui formulir/chat → setujui sebagai pihak lain → konfirmasikan serah terima. Pemilik Listing terlihat pada detail barang; gunakan akun tersebut untuk menanggapi. Akun admin dapat meninjau moderasi dan laporan.

**Batas demo:** pembayaran hanya simulasi QRIS; jangan melakukan transfer uang sungguhan. Pengiriman mencatat kurir dan resi secara manual, tanpa pemesanan atau pelacakan kurir langsung. Metode COD/pengiriman mengikuti Listing. Data dan foto katalog demo bersifat simulasi.

## Konfigurasi opsional

Setup dasar tidak memerlukan layanan eksternal. Foto disimpan di `.local/media`, dan email verifikasi/pemulihan lokal tersedia di `.local/mail`.

- **AI:** isi `AI_BASE_URL`, `AI_MODEL`, dan `AI_API_KEY` pada `apps/api/.env.local`, lalu aktifkan `AI_EXPLAINER_ENABLED` atau `AI_PHOTO_ANALYSIS_ENABLED` sesuai fitur. Analisis foto memerlukan model multimodal; gunakan gateway yang kompatibel dengan integrasi aplikasi.
- **Panduan perawatan:** aktifkan `REPAIR_TUTORIALS_ENABLED`; aktifkan `AI_REPAIR_TUTORIAL_ENABLED` bila layanan AI sudah dikonfigurasi.
- **Cloudinary:** isi `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, dan `CLOUDINARY_API_SECRET` bersama untuk penyimpanan foto profil melalui Cloudinary.

Restart `pnpm dev` setelah mengubah konfigurasi. Simpan semua kunci di `.env.local` dan tetap gunakan `APP_ENV=local` untuk demo ini.

## Struktur project

```text
apps/
  web/                 Next.js + React (halaman, fitur, komponen, styles, E2E)
  api/                 NestJS + Prisma (API, schema/migrasi, seed, skrip demo)
packages/
  contracts/           Tipe dan validasi bersama web/API
README.md              Panduan setup dan demo
CONTRIBUTING.md        Panduan pengembangan singkat
```

Folder source dikelompokkan per fitur. Dependency, hasil build, kredensial, upload, dan catatan pengembangan lokal tidak termasuk source yang dibagikan.

## Pemeriksaan

```sh
pnpm typecheck
pnpm lint
pnpm build
pnpm test
pnpm test:e2e
```

Pengujian API dan E2E menggunakan `valora_test`; jalankan bergantian. E2E memerlukan Google Chrome lokal serta port `3002` dan `4001` yang kosong.

Jika koneksi database gagal, pastikan PostgreSQL aktif dan password admin benar. Jika pnpm tidak dikenali setelah instalasi, buka ulang terminal. Jika akun demo belum tersedia, pastikan `APP_ENV=local` lalu ulangi `pnpm db:seed`. Jika Market kosong, jalankan `pnpm demo:items` setelah seed. Periksa proses lain bila port aplikasi sudah digunakan.
