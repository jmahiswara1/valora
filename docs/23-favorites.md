# Favorit — perluasan setelah MVP

**Tanggal:** 4 Oktober 2026. Favorit merupakan fitur pasca-MVP, terpisah dari
cakupan wajib tahap 1–6. Kontrak API bertambah menjadi OpenAPI 1.8.0.

## Perilaku

- Favorit tersimpan privat di akun, termasuk akun aktif yang emailnya belum
  diverifikasi. Guest diarahkan ke login, kembali ke detail listing, lalu dapat
  menekan hati untuk menyimpan. URL tidak menjalankan penyimpanan otomatis.
- Tombol hati tersedia pada katalog Market, preview Beranda, barang terkait,
  dan detail. Tombol merupakan saudara tautan kartu, bukan tombol di dalam link.
- Ikon hati navbar publik tersedia pada desktop/mobile; notifikasi dan cart
  tetap tersembunyi di mobile. Toolbar akun, sidebar, dan drawer menyediakan
  akses ke `/app/favorit`.
- Hati terisi hanya setelah server mengonfirmasi. Selama status tidak diketahui
  atau mutasi berjalan, kontrol tidak mengklaim barang belum disimpan dan tidak
  menerima mutasi berulang. Kegagalan memakai retry/status reconciliation.
- Daftar diurutkan dari waktu simpan terbaru, dengan empat kolom desktop dan
  dua kolom di bawah 1024 px. Halaman memuat 20 entri, menyediakan “Muat lebih
  banyak”, serta mempertahankan hasil saat halaman berikutnya gagal.
- Penghapusan tidak membutuhkan dialog. Fokus dipindahkan setelah kartu hilang
  dari DOM; hasil diumumkan melalui status. Error tetap tersedia di halaman
  ketika respons penghapusan terputus dan hasil akhirnya diperiksa ulang.

## Data dan privasi

`Favorite` memiliki `userId`, `listingId`, `savedTitle`, dan `createdAt`.
Pasangan user–listing menjadi primary key; indeks user/waktu/listing mendukung
pagination stabil. Relasi memakai cascade bila user/listing benar-benar dihapus.
Penutupan akun menghapus seluruh Favorit dalam transaksi penutupan yang sama.
Migrasi `20261004180000_favorites` bersifat aditif dan tidak memerlukan reset.

Favorit mengikuti listing, bukan Item yang berpindah owner. Penyimpanan pertama
merekam **judul publik saat disimpan**. Retry tidak mengganti judul/waktu tersebut;
hapus lalu simpan kembali membuat entri baru.

Listing `ACTIVE` memakai proyeksi publik terkini, termasuk revisi/foto/harga
terbaru. Listing `RESERVED` hanya menampilkan nama saat disimpan dan “Sedang
dalam kesepakatan”, dengan tautan ke status publik terbatas. Status lainnya
ditampilkan sebagai “Tidak tersedia”. Tidak ada snapshot foto, harga, alamat,
deskripsi, atau detail pemilik lama. Nama historis diberi label “Nama saat
disimpan”; tidak diklaim sebagai judul terbaru setelah listing ditarik.

## API

Semua endpoint menggunakan `SessionGuard`, identitas dari sesi, dan envelope
existing. Mutasi memakai CSRF dan helper transaksi yang memeriksa ulang sesi.

| Endpoint | Kontrak |
| --- | --- |
| `GET /api/v1/me/favorites` | `FavoriteDto[]`, `meta.nextCursor`; limit 1–50, default 20. Cursor berisi waktu/UUID sehingga penghapusan baris boundary tidak merusak pagination. |
| `GET /api/v1/me/favorites/status?listingIds=…` | 1–100 UUID unik dipisah koma; `FavoriteStatusDto[]` untuk akun saat ini. |
| `PUT /api/v1/me/favorites/:listingId` | Simpan listing aktif; pengulangan entri existing tetap berhasil, termasuk setelah listing tidak tersedia. |
| `DELETE /api/v1/me/favorites/:listingId` | Hapus entri akun; tidak ada atau sudah dihapus tetap berhasil. |

`FavoriteDto` berisi `listingId`, `savedAt`, `savedTitle`, `availability`
(`ACTIVE`, `RESERVED`, `UNAVAILABLE`), dan `listing`. Hanya `ACTIVE` membawa
detail publik; cabang lainnya membawa `listing: null`. `FavoriteStatusDto`
berisi `listingId` dan `isFavorite`.

Query status dipanggil dalam batch per kumpulan kartu (maksimum 100 ID per
request). TanStack Query memisahkan cache berdasarkan akun, menyinkronkan
mutasi di seluruh tampilan, dan memperbarui data ketika jendela kembali aktif.
SessionProvider existing membatalkan request serta membersihkan cache saat
logout/pergantian akun. API Market publik tidak diberi atribut personal.

## Verifikasi

Smoke `scripts/smoke/favorites.mjs` menggunakan database `_test` dan mengikuti
runner API existing. Skenario mencakup sesi/CSRF, akun belum terverifikasi,
isolasi antar akun, validasi UUID/batch/cursor/limit, idempotensi serentak,
pagination dengan timestamp sama/boundary terhapus, revisi terkini, seluruh
status nonpublik, akses foto yang ditutup, revokasi, penutupan akun, dan OpenAPI.

Playwright `tests/e2e/favorites.spec.mjs` memakai fixture API yang diintersep
untuk memeriksa guest/login, batch status, simpan/hapus, keyboard, sinkronisasi
detail, reload, error/retry, respons terputus, kartu tidak tersedia, pagination,
cache antar akun/logout, dan viewport 320/390/430/768/1440 px. Pemeriksaan UI
ini terpisah dari smoke API yang menguji database nyata; reload fixture browser
bukan bukti persistensi database. Screenshot berada di `.local/wishlist`.

Hasil verifikasi pada 4 Oktober 2026:

- `pnpm test`: enam tes formula dan seluruh tujuh suite smoke API lulus.
- `pnpm typecheck` dan `pnpm lint`: lulus.
- Playwright `favorites.spec.mjs` bersama `public.spec.mjs`: 38 pemeriksaan
  desktop/mobile lulus. Screenshot akhir 1440 px dan 320 px diperiksa secara
  visual; grid masing-masing menampilkan empat dan dua kolom.
- Migrasi aditif berhasil diterapkan pada database development dan `_test`
  tanpa reset. `git diff --check` tidak menemukan masalah whitespace.

Koleksi bernama, saved search, price alert, dan daftar Favorit publik belum
termasuk dalam fitur ini.
