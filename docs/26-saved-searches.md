# Pencarian Tersimpan — perluasan setelah MVP

**Tanggal:** 6 Oktober 2026. OpenAPI **1.11.0**.

## Alur dan akses

Pengguna menyimpan kriteria Market yang sudah diterapkan, termasuk ketika
belum ada hasil. Kata kunci yang masih diketik dan filter yang belum diterapkan
tidak ikut tersimpan. Minimal satu kata kunci/filter; urutan tampilan saja
tidak memenuhi syarat. Kriteria mencakup kategori, jenis, kota, kondisi, dan
rentang harga dengan aturan yang sama seperti katalog publik.

Dialog terpusat menyediakan nama otomatis yang dapat diedit (1–80 karakter)
dan pilihan notifikasi, aktif secara default. Maksimum 10 pencarian privat per
akun aktif, termasuk akun yang belum memverifikasi email. Nama dan pengaturan
existing dipertahankan ketika pencarian yang sama disimpan kembali. Duplikasi
mengabaikan urutan tampilan serta perbedaan kapitalisasi kata kunci, sesuai
pencocokan Market. Harga dinormalisasi menjadi angka.

Tombol guest menuju `/masuk?next=...`; tujuan kembali adalah URL Market kanonis
dengan kriteria dan urutan yang tervalidasi. Setelah masuk pengguna menekan
Simpan kembali. `safeNext` tetap membatasi tujuan ke route lokal yang dikenal.
URL menjadi sumber filter terapan dan mendukung refresh serta Back/Forward.
Parameter invalid menampilkan pesan dan Reset filter, tanpa meminta katalog
dengan filter invalid. Label kota dipulihkan dari katalog kota existing.

`/app/pencarian` tersedia pada sidebar/drawer Aktivitas Market. Pengelolaan
mencakup Lihat hasil, ubah nama, toggle notifikasi, dan hapus dengan konfirmasi.
Kriteria baru disimpan melalui Market. Penghapusan mengembalikan fokus ke
hasil berikutnya atau heading. Native dialog mendukung Escape, Tab/Shift+Tab,
pengembalian fokus, body scroll lock, dan scroll internal pada layar pendek.

## API

Prefix `/api/v1`, sesi/CSRF dan pemeriksaan izin ulang mengikuti mekanisme
existing. Pengaturan mutasi menunggu hasil server; respons tidak pasti
memicu pemeriksaan ulang daftar. Cache dipisahkan berdasarkan akun dan
dibersihkan saat identitas sesi berubah.

| Endpoint | Hasil |
| --- | --- |
| `GET /me/saved-searches` | Semua pencarian akun, terbaru dahulu, maksimum 10. |
| `POST /me/saved-searches` | Nama, filters, sort, alertsEnabled; menghasilkan DTO atau entri existing untuk kriteria setara. |
| `PATCH /me/saved-searches/:id` | Nama/status notifikasi dan expectedVersion; perubahan usang ditolak 409. |
| `DELETE /me/saved-searches/:id` | Penghapusan idempoten, hanya record milik akun itu. |

`SavedSearchDto`: id, name, filters, sort, alertsEnabled, version, createdAt.
DTO tidak mengirim userId, fingerprint, atau watermark internal. Batas akun
menghasilkan `SAVED_SEARCH_LIMIT`; pencarian duplikat tetap bisa dibuka ketika
kuota penuh. Kategori/kota baru yang disimpan harus aktif dan tersedia.

## Publikasi dan notifikasi

Notifikasi mengikuti **publikasi pertama setiap listing**, melalui persetujuan
moderasi. Perubahan harga, koreksi revisi, atau pengaktifan ulang listing yang
sama tidak menghasilkan kejadian publikasi pertama lagi. Listing baru dengan
ID berbeda memiliki siklus publikasinya sendiri.

Migrasi aditif `20261006180000_saved_searches` menambahkan SavedSearch,
SearchPublication, dan Listing.firstPublishedAt. Penanda historis diisi dari
review APPROVE paling awal, dengan publishedAt sebagai fallback, sehingga
listing lama tidak dianggap baru setelah penerapan fitur. Persetujuan,
penanda pertama, dan record antrean ditulis dalam transaksi domain yang sama.

Antrean memiliki sequence monoton. Penyimpanan/aktivasi notifikasi mencatat
sequence terakhir yang sudah committed. Watermark ini melewati publikasi
existing, termasuk publikasi yang antreannya belum diproses; tidak bergantung
pada ketepatan jam atau perbedaan milidetik. Mengubah nama tidak mereset
watermark. Aktif kembali mengikuti publikasi sesudah aktivasi itu.

Worker berjalan saat startup dan setiap 60 detik, menggunakan advisory lock
`saved-search-alerts` pada dedicated connection. Maksimum 10 batch per putaran,
100 pencarian per transaksi, dengan cursor pencarian tersimpan. Notifikasi
dan checkpoint committed bersama; kegagalan diproses lagi pada putaran
berikutnya. Log kegagalan mencatat jenis error tanpa kriteria privat.

Sebelum setiap batch, listing harus masih ACTIVE dengan revisi dan timestamp
publik yang sama. Listing yang ditarik, reserved, atau berubah proyeksi publik
dilewati. Penerima harus aktif, pencarian aktif, serta bukan pemilik listing.
Pencocokan memakai predicate Market yang sama, termasuk kondisi berdasarkan
rentang skor kondisi dan pencarian teks case-insensitive pada judul,
deskripsi, nama kategori, atau kota.

`SAVED_SEARCH_MATCH` masuk kategori `market`, target `LISTING`, menuju
`/market/:listingId`. Payload berisi judul publik dan ID listing; tidak
menyalin foto, harga, identitas pemilik, nama pencarian, atau kriterianya.
Kunci pengguna–listing mempertahankan satu notifikasi pada overlap, retry,
dan restart tanpa mengubah readAt atau createdAt existing. Menonaktifkan atau
menghapus pencarian menghentikan pengiriman berikutnya dan mempertahankan
notifikasi yang sudah diterima. Penutupan akun menghapus pencarian/notifikasi.

Pusat notifikasi, preview lonceng, badge, dashboard, penandaan dibaca, dan
polling existing mendukung kategori baru. Target waktu tampil sekitar 60–90
detik pada antrean normal dan tab terlihat. Detail tujuan tetap memakai
proyeksi publik terkini bila listing kemudian tidak tersedia.

## Verifikasi

API smoke mencakup validasi, kuota/duplikasi/concurrency, sesi/CSRF/isolasi,
versi usang, gabungan kriteria, overlap, pengecualian pemilik, watermark,
publikasi ulang, rollback moderasi/notifikasi, worker lock, checkpoint/restart
di atas 100 pencarian, dan penutupan akun.

Browser memeriksa filter URL/draft, login kembali, hasil kosong, kuota,
rename/toggle/delete, loading/error/retry, respons terputus, pergantian akun
selama CSRF tertunda, kategori Market, dialog terpusat/fokus, serta viewport
320/390/1440 px. Alur live memakai akun sintetis pada database test dan worker
berjadwal untuk menghubungkan penyimpanan, persetujuan, notifikasi, dan detail.

Bukti lokal diabaikan Git: `.local/searches-*.log`,
`.local/searches-detector.json`, dan `.impeccable/review/searches/`.

Hasil akhir, 6 Oktober 2026:

| Pemeriksaan | Hasil |
| --- | --- |
| `pnpm test` | 6 tes formula dan 9 smoke suite API lulus |
| Browser regresi + fitur | 112 skenario desktop/mobile lulus |
| Browser API nyata + worker berjadwal | 2 alur desktop/mobile lulus; publikasi sampai notifikasi dan detail |
| Konfirmasi setelah perbaikan visual | 24 skenario fitur lulus kembali |
| `pnpm typecheck`, `pnpm lint` | Lulus |
| Detector desain | Tidak ada temuan mekanis |
| Review visual | Ship; lebar tautan hasil dan warna tombol hapus dikonfirmasi pada desktop/mobile |

Regresi mencakup Market publik, Favorit, pusat notifikasi, Passport QR,
dan operasi akun. Migrasi sudah diterapkan secara aditif pada database lokal
dan database test.
