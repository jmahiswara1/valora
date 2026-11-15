# Valora

*Keep Things Valuable*

## Tentang Valora

Valora adalah platform sirkular untuk membantu pengguna memperpanjang usia pakai barang melalui perawatan, penilaian kondisi, penjualan, pertukaran, dan donasi. Riwayat barang dicatat dalam Passport agar pemilik berikutnya dapat memahami perjalanan barang tersebut.

## Fitur utama

- **Barang dan penilaian kondisi:** catat barang, foto, dan kondisinya untuk memperoleh Valora Score serta rekomendasi tindakan.
- **Market:** jual, tukar, atau donasikan barang; kelola Listing dan simpan barang favorit.
- **Penawaran dan chat:** negosiasikan kesepakatan serta kirim dan tanggapi usulan serah terima melalui percakapan.
- **Transaksi:** atur COD atau pengiriman sesuai Listing, catat kurir/resi, konfirmasikan serah terima, dan laporkan masalah.
- **Passport dan Impact:** lihat riwayat penilaian, perawatan, perpindahan kepemilikan, serta ringkasan aktivitas sirkular.
- **Bantuan AI opsional:** penjelasan penilaian, analisis foto, dan panduan perawatan/perbaikan setelah layanan terkait diaktifkan.

## Setup dan menjalankan lokal

Siapkan **Node.js 24.15+**, **pnpm 11.28.0**, dan **PostgreSQL** yang aktif di `127.0.0.1:5432`. Akun admin PostgreSQL harus dapat membuat role dan database. Jika pnpm belum tersedia:

```sh
npm install --global pnpm@11.28.0
```

Clone atau ekstrak project, lalu buka terminal pada folder root yang berisi `package.json`. Jalankan berurutan:

```sh
pnpm install --frozen-lockfile
node apps/api/scripts/database/setup.mjs
pnpm --filter @valora/contracts build
pnpm db:deploy
pnpm db:seed
pnpm dev
```

Skrip setup meminta password admin PostgreSQL (user default `postgres`; input tidak ditampilkan), membuat role `valora_app` serta database `valora_dev` dan `valora_test`, lalu menyimpan konfigurasi dan kunci acak di `apps/api/.env.local`. Konfigurasi lokal yang sudah ada tidak ditimpa. Referensi variabel tersedia di [apps/api/.env.example](apps/api/.env.example).

| Layanan | Alamat lokal |
| --- | --- |
| Aplikasi | http://localhost:3000 |
| API | http://127.0.0.1:4000/api/v1 |
| Swagger | http://127.0.0.1:4000/api/docs |

Biarkan terminal berjalan selama aplikasi digunakan. Hentikan dengan `Ctrl+C`; pada penggunaan berikutnya cukup jalankan `pnpm dev`. Jalankan `pnpm db:deploy` kembali jika ada migrasi baru.

Setup dasar memakai penyimpanan lokal: foto berada di `.local/media` dan email verifikasi/pemulihan di `.local/mail`. Untuk fitur tambahan, ubah `apps/api/.env.local` sesuai kebutuhan:

- **AI bersama:** floating assistant, AI Explainer, analisis foto, dan AI perawatan memakai konfigurasi yang sama. Pilih salah satu mode berikut.
- **Panduan perawatan:** aktifkan `REPAIR_TUTORIALS_ENABLED`; aktifkan juga `AI_REPAIR_TUTORIAL_ENABLED` jika layanan AI sudah dikonfigurasi.
- **Cloudinary untuk foto profil:** isi `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, dan `CLOUDINARY_API_SECRET` bersama.

Restart `pnpm dev` setelah mengubah konfigurasi. Gunakan `APP_ENV=local` untuk demo dan simpan kunci layanan hanya di `.env.local`.

Gemini langsung: cukup isi `GEMINI_API_KEY`. `GEMINI_MODEL` opsional (default `gemini-2.5-flash`). Jika kunci Gemini terisi, konfigurasi ini diprioritaskan untuk seluruh fitur AI.

```dotenv
GEMINI_API_KEY=isi_kunci_gemini_anda
GEMINI_MODEL=gemini-2.5-flash
```

Untuk gateway kompatibel OpenAI, kosongkan `GEMINI_API_KEY` lalu isi:

```dotenv
GEMINI_API_KEY=
AI_BASE_URL=http://localhost:20128/v1
AI_MODEL=nama_model_di_gateway
AI_API_KEY=isi_kunci_gateway_anda
```

Aktifkan `AI_EXPLAINER_ENABLED` dan/atau `AI_PHOTO_ANALYSIS_ENABLED` sesuai kebutuhan. Analisis foto membutuhkan model multimodal. `AI_PHOTO_MODEL` dan `AI_REPAIR_TUTORIAL_MODEL` boleh dikosongkan agar mengikuti model bersama; limit harian dan timeout mengikuti variabel `AI_*` pada `.env.example`.

## Demo singkat

Setelah setup, isi Market dengan 40 Listing sintetis melalui terminal lain dari root project:

```sh
pnpm demo:items
```

Untuk merapikan database demo yang sudah ada, jalankan `pnpm demo:tidy`. Perintah ini mengganti email akun demo lama dan menyederhanakan nama barang/Listing, dengan salinan nilai sebelumnya di `.local`. ID, kata sandi, kepemilikan, dan riwayat transaksi tetap dipertahankan; akun di luar demo tetap disimpan.

Akun berikut dibuat oleh seed. Kredensial demo pada setup lokal saat ini:

| Peran | Email | Password |
| --- | --- | --- |
| Pemilik barang | `owner@valora.demo` | `QeXwWsAp1U7bqYWD-0IDXxlch50t1lNK` |
| Anggota | `member@valora.demo` | `QeXwWsAp1U7bqYWD-0IDXxlch50t1lNK` |
| Pembeli | `buyer@valora.demo` | `QeXwWsAp1U7bqYWD-0IDXxlch50t1lNK` |
| Admin | `admin@valora.demo` | `QeXwWsAp1U7bqYWD-0IDXxlch50t1lNK` |

Pada setup baru, seed menghasilkan password bersama yang dapat berbeda dari tabel ini. Gunakan nilai di `.local/demo-credentials.json` pada komputer yang menjalankan setup sebagai acuan.

1. Buka Market, masuk sebagai pembeli, pilih barang milik akun lain, lalu kirim penawaran.
2. Buka browser/profil terpisah dan masuk sebagai pemilik Listing untuk meninjau serta menerima penawaran. Periksa nama pemilik pada detail barang.
3. Buka transaksi, usulkan jadwal COD/pengiriman melalui formulir, lalu tanggapi usulan sebagai pihak lain melalui chat atau detail transaksi.
4. Untuk transaksi berbayar, coba simulasi QRIS sebagai pembayar. Konfirmasikan penyerahan dan penerimaan untuk menyelesaikan transaksi, lalu lihat riwayat Passport dan Impact.
5. Masuk sebagai admin untuk meninjau moderasi Listing dan laporan pengguna.

**Batas demo:** pembayaran QRIS hanya simulasi; jangan melakukan transfer uang sungguhan. Kurir dan resi dicatat secara manual, tanpa pemesanan atau pelacakan kurir langsung. Metode serah terima mengikuti Listing. Data dan foto katalog demo bersifat simulasi.

Jika setup gagal, periksa layanan PostgreSQL dan password admin. Jika akun belum tersedia, pastikan `APP_ENV=local` lalu ulangi `pnpm db:seed`. Jika Market kosong, jalankan `pnpm demo:items` setelah seed. Pastikan port aplikasi tidak dipakai proses lain.
