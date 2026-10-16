# Pengembangan lokal

Panduan setup, konfigurasi, pemeriksaan, dan fixture demo Valora. Jalankan perintah dari root repository.

## Kebutuhan lokal

- Node.js 24.15+ dan pnpm 11.28.0. Jika pnpm belum tersedia, pasang sekali dengan `npm install --global pnpm@11.28.0` atau aktifkan shim Corepack lewat `corepack enable pnpm` (mungkin perlu PowerShell administrator bila Node.js terpasang di `Program Files`). Versi proyek dikunci pada `package.json`.
- PostgreSQL yang berjalan di `127.0.0.1:5432` dan role admin yang boleh membuat role serta database.

## Siapkan proyek

```powershell
pnpm install
node apps/api/scripts/database/setup.mjs
pnpm db:deploy
pnpm db:seed
pnpm dev
```

Skrip database meminta password admin lewat stdin tanpa menampilkannya. Ia membuat role aplikasi terbatas serta `valora_dev` dan `valora_test`, lalu menyimpan URL dan kunci acak di `apps/api/.env.local` yang diabaikan Git. Bila role sudah ada dan `.env.local` tersedia, skrip tidak mengganti kredensial. Jalankan skrip dari root proyek.

Foto profil memakai penyimpanan lokal pada lingkungan lokal sampai tiga key Cloudinary di `apps/api/.env.local` diisi: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, dan `CLOUDINARY_API_SECRET`. Cloudinary wajib dikonfigurasi di luar lingkungan lokal. API secret hanya digunakan server. Setelah mengisi key, restart API; foto lokal yang sudah ada akan dimigrasikan otomatis saat pemilik membuka halaman profil.

Web tersedia di `http://localhost:3000`, API di `http://127.0.0.1:4000/api/v1`, dan Swagger lokal di `http://127.0.0.1:4000/api/docs`. Next.js meneruskan `/api/v1` ke API agar cookie dan CSRF satu origin.

Email verifikasi dan pemulihan demo ada di `.local/mail`. Akun demo hasil seed ada di `.local/demo-credentials.json`; berkas tersebut memuat kata sandi demo dan harus tetap lokal. Foto berada di `.local/media`.

## Pemeriksaan

```powershell
pnpm typecheck
pnpm lint
pnpm build
```

`pnpm test` menjalankan enam uji rumus serta smoke API tahap 1–6 pada `valora_test`. `pnpm test:e2e` menjalankan alur transaksi, sengketa, Passport, Impact, dan operasi koreksi, serta matriks auth/sesi 45 rute dengan Chrome lokal pada desktop/mobile. Jalankan keduanya bergantian karena memakai API port 4001 dan database test yang sama.

`pnpm demo:stage4` menyiapkan fixture sintetis Resell, Donate parsial, dan Exchange; rute tersimpan di `.local/stage4-demo-fixtures.json`. Rincian fitur, migrasi, hasil verifikasi, dan batas tahap ada pada [catatan tahap 4](18-stage4-implementation.md). Jika shim pnpm belum aktif, setiap perintah dapat dijalankan melalui `corepack pnpm`.

`pnpm demo:stage5` membuat fixture tambahan pada database dev: tiga transfer selesai, Passport publik dan terbatas, Exchange privat, Repair, kasus koreksi, laporan, draft rubrik, dan hold retensi. Rute tersimpan di `.local/stage5-demo-fixtures.json`. Cakupan dan verifikasi ada pada [catatan tahap 5](19-stage5-implementation.md). Catatan tahap tersebut memuat baseline awal penjelasan template lokal. Konfigurasi AI yang ditambahkan kemudian dijelaskan pada [AI Explainer](30-ai-explainer.md).

`pnpm demo:stage6` menyiapkan empat jalur demo serta metadata sesi tanpa token/hash. Rute tersimpan di `.local/stage6-demo-fixtures.json`. Kebijakan sesi tujuh hari, reautentikasi 15 menit, grant kasus lima menit, dan hasil hardening tercatat pada [catatan tahap 6](21-stage6-implementation.md).

`pnpm demo:items` menambahkan 40 Listing sintetis aktif ke Market lokal memakai lima foto katalog yang dipakai ulang. Perintah ini memerlukan database dan akun demo dari `pnpm db:seed`, serta hanya berjalan ketika `APP_ENV=local`. Manifest item dan rute tersimpan di `.local/demo-items-fixtures.json`; pengulangan memverifikasi fixture yang sama tanpa membuat duplikat.

## Struktur source

Source dikelompokkan per fitur. Lihat [aturan penamaan dan pemetaan file](22-file-organization.md).

## Konfigurasi fitur tambahan

- [Passport QR](25-passport-qr.md): atur `APP_BASE_URL` ke alamat publik sebelum membagikan QR ke perangkat lain.
- [AI Explainer](30-ai-explainer.md) dan [analisis foto](31-ai-photo-analysis.md): konfigurasi gateway 9router dan kunci server pada `apps/api/.env.local`.
- [Panduan perawatan & perbaikan](33-ai-repair-tutorials.md): aktifkan `REPAIR_TUTORIALS_ENABLED` untuk sesi baru, dan `AI_REPAIR_TUTORIAL_ENABLED` jika gateway AI sudah tersedia. Panduan tetap dapat digunakan saat AI tidak tersedia.

Lihat [peta dokumentasi](README.md) untuk rincian fitur dan migrasi.
