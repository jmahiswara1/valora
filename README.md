# Valora

Platform sirkular untuk karya INSYFEST 2026. Tahap 1–6 mencakup akun, Item privat, penilaian/Repair, Market, Offer/chat, transaksi, sengketa, Passport, Impact, koreksi, rubrik, operasi admin, retensi, serta penguatan auth dan sesi pada seluruh halaman. [PRD](PRD.md) serta [peta dokumen](docs/README.md) menjelaskan target MVP lengkap.

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

`pnpm demo:stage4` menyiapkan fixture sintetis Resell, Donate parsial, dan Exchange; rute tersimpan di `.local/stage4-demo-fixtures.json`. Rincian fitur, migrasi, hasil verifikasi, dan batas tahap ada pada [catatan tahap 4](docs/18-stage4-implementation.md). Jika shim pnpm belum aktif, setiap perintah dapat dijalankan melalui `corepack pnpm`.

`pnpm demo:stage5` membuat fixture tambahan pada database dev: tiga transfer selesai, Passport publik dan terbatas, Exchange privat, Repair, kasus koreksi, laporan, draft rubrik, dan hold retensi. Rute tersimpan di `.local/stage5-demo-fixtures.json`. Cakupan dan verifikasi ada pada [catatan tahap 5](docs/19-stage5-implementation.md). Penjelasan Assessment memakai template lokal; penyedia AI eksternal belum diaktifkan.

`pnpm demo:stage6` menyiapkan empat jalur demo serta metadata sesi tanpa token/hash. Rute tersimpan di `.local/stage6-demo-fixtures.json`. Kebijakan sesi tujuh hari, reautentikasi 15 menit, grant kasus lima menit, dan hasil hardening tercatat pada [catatan tahap 6](docs/21-stage6-implementation.md).

`pnpm demo:items` menambahkan 40 Listing sintetis aktif ke Market lokal memakai lima foto katalog yang dipakai ulang. Perintah ini memerlukan database dan akun demo dari `pnpm db:seed`, serta hanya berjalan ketika `APP_ENV=local`. Manifest item dan rute tersimpan di `.local/demo-items-fixtures.json`; pengulangan memverifikasi fixture yang sama tanpa membuat duplikat.

## Struktur source

Source dikelompokkan per fitur. Lihat [aturan penamaan dan pemetaan file](docs/22-file-organization.md).

## Fitur setelah MVP

[Favorit](docs/23-favorites.md) menyimpan listing privat di akun melalui tombol
hati pada Market dan menyediakan daftar di `/app/favorit`. Barang yang tidak
lagi tersedia tetap tercatat tanpa membuka foto atau detail lama.

[Pusat Notifikasi](docs/24-notification-center.md) mengumpulkan kabar penawaran
dan transaksi serta barang baru yang cocok, dengan preview lonceng serta riwayat privat di `/app/notifikasi`.

[Passport QR](docs/25-passport-qr.md) menyediakan tautan publik barang yang
dapat disalin dan diunduh sebagai PNG, mengikuti akses Passport yang berlaku.
Atur `APP_BASE_URL` ke alamat publik sebelum membagikan QR untuk dipindai
dari perangkat lain.

[Pencarian Tersimpan](docs/26-saved-searches.md) menyimpan kriteria Market
dan mengirim kabar publikasi pertama listing yang cocok. Kelola nama dan
notifikasinya di `/app/pencarian`.

[Profil Publik dan Ulasan](docs/27-public-profiles-reviews.md) menampilkan barang
dan pengalaman transaksi pengguna, dengan foto publik opsional, rating, balasan,
laporan, dan moderasi.

## Kontribusi

Lihat [panduan kontribusi](CONTRIBUTING.md) untuk format commit dan aturan file
yang boleh masuk repository. Commit pertama memakai `initial commit`; commit
berikutnya memakai `type: short desc` tanpa scope.

[Peningkatan Chat](docs/28-chat-enhancements.md) menambahkan tiga foto privat,
tanda dibaca, pemulihan kirim dan notifikasi per percakapan. OpenAPI terkini 1.18.0.

[Koordinasi Serah Terima](docs/29-handover-coordination.md) menambahkan jadwal yang disepakati, alamat/lokasi privat, resi manual per barang, linimasa dan pengingat pada detail transaksi. Tenggat tetap 14 hari.

[AI Explainer Penilaian](docs/30-ai-explainer.md) menjelaskan hasil penilaian melalui 9router, dengan validasi, kuota harian, cache dan fallback rubrik.

[Analisis Foto Barang dengan AI](docs/31-ai-photo-analysis.md) membantu mengisi barang baru/edit dengan saran per kolom dari 1–3 foto, berbagi kuota dengan AI Explainer, dan tetap memerlukan tinjauan serta simpan manual.

[Exchange Lanjutan](docs/32-advanced-exchange.md) mendukung 1–3 barang per pihak, counteroffer dan riwayat revisi, serta tambahan uang yang disepakati dan dilaporkan langsung oleh pengguna. Jalankan `pnpm db:deploy` sebelum menjalankan API baru untuk menerapkan migrasi tambahan tanpa reset data.


[Panduan Perawatan & Perbaikan dengan AI](docs/33-ai-repair-tutorials.md) menambahkan enam panduan berversi, progres privat, jeda/lanjut, foto opsional dan tinjauan hasil. Buka `/app/panduan` atau **Barang saya → Lihat panduan**. Aktifkan `REPAIR_TUTORIALS_ENABLED` dan, jika gateway siap, `AI_REPAIR_TUTORIAL_ENABLED` pada `.env.local`. Jalankan `pnpm db:deploy` sebelum API baru. AI yang tidak tersedia tetap mempunyai fallback panduan.
