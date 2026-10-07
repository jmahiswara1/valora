# Passport QR — perluasan setelah MVP

**Tanggal:** 6 Oktober 2026. Kontrak API menjadi OpenAPI 1.10.0. Tidak ada
migrasi database, token berbagi, atau perubahan kebijakan akses Passport.

## Akses dan perilaku

Tombol **QR Passport** tersedia pada detail barang pemilik, Passport pemilik,
dan Passport publik yang dapat diakses. Dialog menampilkan QR, Item ID,
status akses publik, tautan yang dapat dipilih, salin tautan, unduh PNG, serta
tautan membuka Passport publik di tab baru.

Pemilik dapat menyimpan QR sejak barang didaftarkan. QR menyimpan hanya URL
`/passport/{itemId}`; identitas pemilik, catatan privat, token sesi, dan snapshot
transaksi tidak masuk ke QR maupun PNG. Pergantian pemilik mempertahankan URL
selama domain aplikasi tetap sama. Membagikan QR tidak memublikasikan barang.

QR dibuat di browser dengan `qrcode`, dimuat saat diperlukan. PNG berukuran
1024 × 1024, warna forest di atas putih, margin empat modul, error correction
M, tanpa logo menutupi modul. Nama file `valora-passport-{itemId}.png`.

## Kontrak dan privasi

`GET /api/v1/items/{id}/passport` dan `GET /api/v1/passport/{id}` menambahkan
`share: { url: string, access: 'PUBLIC' | 'LIMITED' | 'UNAVAILABLE' }`.
Status dihitung bersama proyeksi dalam transaksi pembacaan yang sama:

| Kondisi | Status berbagi | Hasil publik |
| --- | --- | --- |
| Listing ACTIVE/RESERVED atau transaksi COMPLETED, visibilitas PUBLIC | PUBLIC | Proyeksi publik yang sudah ada |
| Layak publik dan visibilitas LIMITED | LIMITED | Status pembatasan; tanpa timeline/foto/judul privat |
| Belum layak publik atau HIDDEN | UNAVAILABLE | 404 netral; pemilik tetap mendapat proyeksinya |

URL kanonis memakai origin `APP_BASE_URL`, bukan Host request atau URL
browser. Path/query/fragment dan kredensial pada base URL tidak diteruskan.
HTTP/HTTPS wajib. Konfigurasi lokal default memakai `http://localhost:3000`.
Dialog menjelaskan bahwa alamat loopback tidak dapat dibuka dari ponsel lain.
Saat deployment, atur `APP_BASE_URL` ke domain publik. QR yang diunduh sebelum
domain berubah perlu dibuat ulang. Tidak ada redirect otomatis dari domain
lama maupun pemindai kamera di dalam aplikasi pada tahap ini.

## State dan aksesibilitas

Dialog menggunakan native `showModal`, posisi tengah viewport, batas tinggi
dan scroll internal, penguncian scroll halaman, fokus awal tombol tutup,
Escape, serta pengembalian fokus ke pemicu. Kontrol minimal 44 px.

Pembukaan dialog menunggu pembacaan Passport baru; data cache lama tidak
ditampilkan saat refresh gagal. Cache pemilik mencakup identitas akun dan
mengikuti reset cache sesi. Pergantian akun/logout menutup dialog dan
mengembalikan scroll halaman.

Kegagalan API menyediakan retry. Kegagalan pembuatan QR menonaktifkan unduhan,
sementara salin tautan tetap tersedia. Jika clipboard ditolak/tidak tersedia,
tautan dipilih dan difokuskan untuk salin manual. PNG hanya tersedia setelah
QR berhasil dibuat; pesan hasil salin memakai live region.

## Verifikasi

Smoke operasi memeriksa metadata draft, aktif, reserved, ditarik, selesai,
owner lama/baru, LIMITED/HIDDEN, dan privasi proyeksi. Browser memeriksa dialog,
salin/fallback, download yang didecode kembali ke URL, retry API/QR, keyboard,
reset akun/logout, serta viewport 320/390/430/768/1440 px.

Hasil akhir, 6 Oktober 2026:

| Pemeriksaan | Hasil |
| --- | --- |
| `pnpm test` | 6 tes formula dan seluruh 8 smoke suite API lulus |
| Playwright QR/operasi/Favorit/publik/notifikasi | 88 skenario desktop/mobile lulus (3,2 menit) |
| PNG unduhan | Decode kembali menghasilkan URL kanonis yang tepat; 1024 × 1024 dan latar putih |
| `pnpm typecheck`, `pnpm lint` | Lulus |
| Aplikasi lokal aktual | QR publik di localhost:3000 terbuka; URL sesuai API; tanpa browser pageerror |
| Pemeriksaan visual | Screenshot dialog desktop/mobile ditinjau; viewport 320–1440 px tidak overflow |

Regresi juga memperbaiki batas lebar grid form admin (`.app-main`) dan input
file agar halaman moderasi/koreksi Passport tidak melebar di mobile. Batas ini
tidak mengubah tindakan atau izin admin.

Bukti lokal yang diabaikan Git: `.local/passport-qr/`,
`.local/passport-qr-api.log`, `.local/passport-qr-browser-final.log`, serta
log typecheck/lint. Screenshot hanya memuat fixture sintetis atau data publik.
