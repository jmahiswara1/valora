# Profil publik dan ulasan — perluasan setelah MVP

**Tanggal:** 6 Oktober 2026. OpenAPI 1.12.0. Fitur ini memperluas identitas
publik Market dan pengalaman transaksi dengan migrasi aditif.

## Profil publik dan privasi

Setiap akun ACTIVE memiliki `/profil/:id`. Halaman menampilkan nama, kota,
bulan/tahun bergabung, rata-rata rating beserta jumlah ulasan, dan tab Barang
atau Ulasan. Barang menjadi default; `?tab=ulasan` mempertahankan pilihan saat
refresh dan navigasi. Barang aktif memakai empat kartu per baris di desktop dan
dua di mobile. Daftar barang dan ulasan menggunakan cursor, 20 entri per halaman.

Pemilik listing dan penulis ulasan memiliki tautan profil. Pengguna dapat membuka
profil publik sendiri dari `/app/profil`. Foto publik dinonaktifkan secara default
melalui `profilePhotoPublic: false`; checkbox harus dikonfirmasi server sebelum
UI mengubah statusnya. Nama dan kota tetap menjadi identitas publik dasar.

Foto publik memakai `/api/v1/profiles/:id/photo`, respons WEBP dengan `no-store`.
Server memeriksa akun aktif, opt-in dan aset saat ini sebelum mengirim gambar;
akses dinonaktifkan segera setelah opt-out. Cloudinary diakses server dengan URL
bertanda tangan, sehingga kredensial dan URL aset privat tidak dikirim publik.
Akses foto akun/chat tetap memakai mekanisme privat yang sudah ada.

Profil akun nonaktif tidak tersedia (404). Proyeksi publik mengecualikan email,
alamat, ID transaksi, harga kesepakatan, snapshot barang privat, chat, dan bukti.
Komentar/balasan dirender sebagai teks, bukan HTML.

## Kelayakan ulasan

| Jalur | Penulis | Penerima |
| --- | --- | --- |
| Resell | Pembeli | Penjual |
| Donate | Penerima barang | Donor |
| Exchange | Kedua peserta, masing-masing sekali | Peserta lainnya |

Akun aktif dengan email terverifikasi dapat mengulas transaksi COMPLETED hingga
sebelum `completedAt + 30×24 jam`. Pada batas tepat 30 hari, akses sudah berakhir.
Rating berupa integer 1–5 wajib; komentar opsional, di-trim, maksimal 1.000
karakter. Tanpa komentar tetap menghasilkan rating. Ulasan langsung tampil dan
tidak dapat diedit atau dihapus oleh penulis. Database membatasi satu ulasan per
`transactionId/authorId`; target ditentukan server dari peserta transaksi.

Koreksi OPEN, IN_REVIEW atau BLOCKED menahan ulasan baru. Ulasan yang sudah ada
tetap tampil selama peninjauan. Pembalikan ownership yang mengisi `correctedAt`
mengeluarkannya dari proyeksi publik dan agregasi rating. Ulasan dari/untuk akun
nonaktif, konten yang disembunyikan dan konten yang telah dibersihkan juga tidak
masuk proyeksi publik atau agregasi.

Penerima ulasan dengan email terverifikasi dapat mengirim satu balasan final
1–1.000 karakter saat ulasan masih tersedia. Balasan tidak memiliki tenggat
30 hari dan tidak dapat diedit. Konten balasan tersembunyi tidak dikirim publik;
metadata keberadaan balasan mencegah UI menawarkan balasan kedua.

## Pemulihan tindakan dan notifikasi

Ulasan dan balasan memakai version guard, CSRF, `Idempotency-Key`, serta mekanisme
status tindakan existing. Respons yang terputus diperiksa kembali sebelum
pengguna mengulangi tindakan. Review dan notifikasinya ditulis dalam transaksi
atomik; kegagalan notifikasi membatalkan penulisan review.

`REVIEW_RECEIVED` mengabari penerima ulasan; `REVIEW_REPLY_RECEIVED` mengabari
penulisnya. Keduanya masuk kategori Transaksi dan menuju detail transaksi privat.
Notifikasi tidak menyalin komentar/balasan. Event key unik mencegah duplikasi.

## Laporan, moderasi dan retensi

Pengguna terverifikasi dapat melaporkan ulasan/balasan pengguna lain melalui
laporan privat dengan alasan. Laporan sendiri ditolak; laporan aktif yang sama
dipakai kembali. Admin memerlukan penugasan laporan dan grant akses lima menit
untuk membaca atau mengubah visibilitas target tersebut. Hide/restore memerlukan
versi konten dan alasan, lalu dicatat pada audit. Grant target lain atau admin
lain tidak mengizinkan tindakan. Laporan yang telah diputuskan tetap dapat
menjadi konteks pemulihan konten melalui akses yang diperbarui.

Menyembunyikan review mengeluarkannya dari rating. Menyembunyikan balasan hanya
mengubah visibilitas balasan. Konten yang sudah dibersihkan tidak dapat dipulihkan.
Penutupan akun langsung menghilangkan profil/ulasan publik. Setelah 30 hari,
retensi akun membersihkan komentar dan balasan yang ditulis akun tersebut;
laporan aktif atau retention hold menahan pembersihan. Retensi percakapan yang
terkait juga mempertimbangkan laporan review/balasan.

## API dan data

| Method | Route | Akses |
| --- | --- | --- |
| GET | `/profiles/:id` | Publik; identitas dan rating |
| GET | `/profiles/:id/listings` | Publik; listing aktif |
| GET | `/profiles/:id/reviews` | Publik; ulasan tersedia |
| GET | `/profiles/:id/photo` | Publik hanya saat opt-in |
| GET | `/transactions/:id/reviews` | Peserta; kelayakan dan riwayat |
| POST | `/transactions/:id/reviews` | Peserta yang memenuhi kelayakan |
| POST | `/reviews/:id/reply` | Penerima ulasan |
| POST | `/admin/reviews/:id/visibility` | Admin dengan akses laporan terkait |
| POST | `/admin/review-replies/:id/visibility` | Admin dengan akses laporan terkait |

`PATCH /me` menerima boolean `profilePhotoPublic`. `POST /reports` menerima
`REVIEW` dan `REVIEW_REPLY`. Listing publik menambahkan `owner.id` untuk tautan
profil. Contracts menjadi sumber validasi dan DTO, termasuk spesifikasi OpenAPI.

Migrasi `20261007010000_public_profiles_reviews` menambah tabel Review/ReviewReply,
preferensi foto publik, target laporan, foreign keys, unique constraint dan check
rating/visibility. Migrasi telah diterapkan pada database dev dan test tanpa reset
atau menghapus data sebelumnya. Tidak ada backfill ulasan historis.

## Verifikasi

Sepuluh suite API dan enam uji rumus lulus. Suite baru mencakup seluruh jalur
transaksi, tenggat, akun/role/CSRF, version dan idempotency, concurrency, rollback
notifikasi, proyeksi publik, foto opt-in/opt-out, koreksi, hide/restore, laporan,
dan retensi dengan hold. Typecheck, lint dan build produksi lulus.

140 skenario browser regresi/fitur lulus pada desktop dan mobile, termasuk dua
alur dengan API nyata. Setelah koreksi kontras inisial avatar dan tautan kembali,
26 pengujian konfirmasi fitur juga lulus. Skenario mencakup tab URL, grid 4/2,
ulasan teks biasa, error/retry/404,
radio keyboard, komentar opsional, batas input, pemulihan respons terputus,
balasan, modal laporan, preferensi foto dan lebar 320 px. Pengujian API nyata
menyelesaikan transaksi, menerbitkan rating, membalas dan membuka notifikasi.

Bio, media sosial profil, follow, foto ulasan, badge reputasi dan perubahan ulasan
setelah terbit berada di luar cakupan fitur ini.
