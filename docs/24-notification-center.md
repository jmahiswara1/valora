# Pusat Notifikasi — perluasan setelah MVP

**Tanggal:** 5 Oktober 2026. Kontrak API menjadi OpenAPI 1.9.0. Fitur ini
memperluas pengingat transaksi existing tanpa mengubah baseline MVP.

## Akses dan tampilan

Pusat notifikasi privat tersedia di `/app/notifikasi`, sidebar/drawer akun,
serta preview lonceng pada navbar publik dan toolbar akun. Lonceng hanya muncul
setelah login, termasuk untuk akun aktif yang belum memverifikasi email.
Lonceng tampil di mobile; cart tetap tersembunyi. Toolbar akun ≤600 px
memindahkan pintasan Market ke drawer agar target 44 px tetap muat.

Preview menampilkan lima aktivitas terbaru dan total belum dibaca, bukan total
yang kebetulan dimuat. Badge maksimum `99+`. Membuka preview tidak menandai
dibaca. Halaman lengkap menyediakan filter Semua/Belum dibaca dan
Semua aktivitas/Penawaran/Transaksi, 20 entri per halaman, dan Muat lebih banyak.

Klik aktivitas membuka detail terkait sekaligus menandai dibaca. Penawaran
memiliki route detail baru `/app/penawaran/:id` yang memakai komponen tindakan
existing; transaksi memakai route detail existing. Satu kegagalan penandaan
tidak menghalangi navigasi. Feedback tetap tersedia setelah berpindah halaman,
dan status diperiksa kembali dari server jika respons terputus.

Penandaan satu/semua mempertahankan riwayat. Server confirmation menentukan
perubahan UI; mutation tidak diulang otomatis. Filter Belum dibaca memindahkan
fokus ke entri berikutnya atau heading setelah baris hilang dari DOM.
Tandai semua juga mencakup entri yang belum dimuat. Preview mendukung Escape,
klik di luar, fokus keyboard, dan pengembalian fokus ke lonceng.

## Kejadian

| Kejadian | Penerima dan tujuan |
| --- | --- |
| Penawaran masuk | Pemilik listing; detail penawaran. |
| Counteroffer | Pengusul revisi sebelumnya; detail penawaran. |
| Ditolak/ditarik | Pihak lain; detail penawaran. |
| Kedaluwarsa karena timeout | Kedua peserta aktif; detail penawaran. |
| Penawaran berakhir karena perubahan domain | Kedua peserta aktif, kecuali pelaku tindakan; detail penawaran. |
| Kesepakatan dimulai | Kedua peserta; detail transaksi. Tidak membuat notifikasi penerimaan kedua. |
| Konfirmasi serah terima | Pihak lain. Konfirmasi terakhir hanya menghasilkan Transaksi selesai. |
| Transaksi selesai/batal | Kedua peserta aktif; detail transaksi. |
| Permintaan pembatalan | Pihak lain; penolakan mengabari pemohon. Penerimaan memakai Transaksi dibatalkan. |
| Sengketa dibuka | Pihak lain bila dibuka peserta; kedua peserta bila dibuka sistem/admin. |
| Putusan lanjut | Kedua peserta, kecuali putusan langsung menyelesaikan transaksi; memakai Transaksi selesai. |
| Pengingat hari ke-7/ke-12 | Kedua peserta aktif, mengikuti kelayakan pengingat existing. |
| Ulasan diterima | Penerima ulasan; detail transaksi privat. |
| Balasan ulasan diterima | Penulis ulasan; detail transaksi privat. |

Helper `expireOffers` dipakai seluruh perubahan penawaran menjadi EXPIRED,
termasuk revisi/penarikan/suspensi listing, pause karena perubahan Item, rubrik,
transfer, koreksi, dan suspensi akun. Tidak mengubah aturan transisi domain.
Job ringan timeout berjalan saat startup dan setiap 60 detik, maksimal 100
penawaran per putaran, dengan advisory lock dedicated connection. Maintenance
serah terima tetap mengikuti jadwal existing.

## Data dan privasi

Gunakan tabel `InAppNotification` existing dengan indeks tambahan
`userId/readAt/createdAt/id`; migrasi `20261005010000_notification_center`
bersifat aditif tanpa reset. Pengingat lama dipertahankan dan tidak ada backfill
aktivitas historis. Notifikasi disimpan dalam transaksi domain yang sama.
`eventKey` unik berasal dari kejadian/revisi/versi dan penerima; retry dan
pengulangan job tidak mengubah waktu/status baca entri existing.

Payload memuat judul barang saat kejadian, referensi penawaran/transaksi,
dan milestone pengingat bila relevan. Tidak menyalin pesan, alasan pembatalan,
alasan sengketa, bukti, alamat, atau kontak. DTO pusat tidak mengirim `userId`,
`eventKey`, atau payload mentah. Route tujuan tetap menjalankan otorisasi domain.
Judul merupakan nama saat kejadian, bukan klaim bahwa listing masih aktif.

Pembentukan notifikasi memeriksa penerima aktif. Penutupan akun menghapus
notifikasi akun itu dalam transaksi penutupan yang sama. Cache dan feedback
dibersihkan ketika sesi berubah atau pengguna logout.

## API dan sinkronisasi

Prefix seluruh endpoint adalah `/api/v1`. SessionGuard menentukan akun dari
sesi; mutasi memerlukan CSRF dan transaksi yang memeriksa ulang sesi.

| Endpoint | Hasil |
| --- | --- |
| `GET /me/notifications` | `NotificationCenterDto[]`, `meta.nextCursor`. Status all/unread, kategori all/offers/transactions; limit default 20, maksimum 50. |
| `GET /me/notifications/summary` | `NotificationSummaryDto`: unreadCount seluruh akun dan lima recent; snapshot database konsisten. |
| `POST /me/notifications/:id/read` | read dan readAt. Idempotent; mempertahankan waktu baca pertama. |
| `POST /me/notifications/read-all` | read, count, readAt. Memakai gate penulisan domain; notifikasi yang dibuat setelah transaksi tetap belum dibaca. |

Cursor memuat timestamp/UUID serta filter. Urutan terbaru dahulu tetap stabil
pada timestamp sama dan setelah boundary dihapus. Cursor dari filter berbeda
ditolak. Endpoint `/notifications` lama menjadi adapter pengingat saja;
endpoint read lama memakai service idempotent yang sama dan bentuk hasil lama.
Kontrak `NotificationDto` pengingat tetap tersedia.

Frontend memakai cache TanStack Query berdasarkan akun, polling 30 detik ketika
tab terlihat, serta refresh saat preview dibuka, focus, dan reconnect. Semua
tampilan diinvalidasi setelah penandaan berhasil atau responsnya tidak pasti.
Kegagalan count tidak diklaim sebagai nol. Dashboard menampilkan maksimal tiga
aktivitas belum dibaca dari sumber yang sama.

## Verifikasi

Smoke `scripts/smoke/notifications.mjs` memakai database `_test`: penulisan
atomik dengan rollback terinjeksi, retry, penerima, timeout/job, privasi DTO,
sesi/CSRF, akun belum terverifikasi, isolasi akun, cursor/filter/limit, timestamp
sama, boundary terhapus, total di atas 50 entri, read/read-all idempotent,
adapter lama, kabar baru sesudah read-all, dan penutupan akun.

Smoke transaksi existing juga memeriksa jumlah dan penerima notifikasi untuk
konfirmasi, completion, Exchange, sengketa, seluruh putusan admin, overdue,
dan penutupan akun dengan transaksi berjalan.

Playwright `tests/e2e/notifications.spec.mjs` mengintersep API untuk memeriksa
preview, detail, keyboard, filter, focus, sinkronisasi badge, retry, respons
terputus, pagination, pergantian akun/logout, serta viewport
320/390/430/768/1440 px. Screenshot disimpan lokal di `.local/notifications`.
Pengujian browser ini tidak mengklaim persistensi database; smoke API memakai
database nyata. Jalankan juga regresi publik/Favorit, typecheck, dan lint.

### Hasil pada 5 Oktober 2026

- `pnpm test`: enam tes formula dan delapan suite smoke API lulus, termasuk
  suite pusat notifikasi serta pemeriksaan notifikasi pada alur transaksi.
- `pnpm typecheck` dan `pnpm lint`: lulus.
- Playwright `notifications.spec.mjs`, `favorites.spec.mjs`, dan
  `public.spec.mjs`: **62 pemeriksaan desktop/mobile lulus**. Termasuk
  pergantian akun saat CSRF tertunda, error yang hilang setelah retry berhasil,
  dan empty state kategori yang tidak mengklaim seluruh akun sudah dibaca.
- Preview dan halaman diperiksa secara visual pada 320 px dan 1440 px;
  pemeriksaan viewport otomatis juga mencakup 390/430/768 px.
- Migrasi aditif diterapkan pada `valora_dev` dan `valora_test` tanpa reset.
  `git diff --check` lulus; artefak pengujian tetap berada di folder lokal.

Pesan baru, moderasi listing, email/push, preferences, dan penghapusan riwayat
oleh pengguna belum termasuk tahap ini.

## Perluasan pencarian tersimpan

OpenAPI 1.11.0 menambahkan kategori `market`, tipe `SAVED_SEARCH_MATCH`, dan
target `LISTING`. Filter transaksi tetap khusus kejadian transaksi. Preview,
badge, dashboard, dan aturan dibaca memakai pusat yang sama. Sumber kejadian
dan pemrosesan antrean ada pada [Pencarian Tersimpan](26-saved-searches.md).

Perluasan ulasan menambahkan `REVIEW_RECEIVED` dan `REVIEW_REPLY_RECEIVED` ke
kategori Transaksi dengan deduplikasi dan penulisan atomik. Komentar/balasan
tidak disalin ke payload. Lihat [Profil Publik dan Ulasan](27-public-profiles-reviews.md).

## Perluasan pesan

Kategori Pesan dan target percakapan ditambahkan pada OpenAPI 1.13.0. Aturan
pengelompokan, perlindungan cursor baca dan pemisahan tanda dibaca chat dicatat
pada [Peningkatan Chat](28-chat-enhancements.md).
