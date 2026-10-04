# Tambahan cakupan tahap 6 — auth dan session management

**Status:** cakupan yang disetujui, diimplementasikan, dan terverifikasi, 2 Oktober 2026. Dokumen ini mempertahankan baseline serta kriteria rencana. Perubahan kode dan bukti verifikasi dicatat pada [implementasi tahap 6](21-stage6-implementation.md).

Kebijakan implementasi: sesi tetap tujuh hari, pembuktian password 15 menit per sesi, dan grant kasus lima menit. Aktivitas tidak memperpanjang sesi.

## Baseline yang akan diperkuat

API sudah memakai sesi opak dalam cookie HttpOnly, hash token di database, kedaluwarsa server, proteksi CSRF, serta pemeriksaan status akun pada `SessionGuard`. Reset kata sandi mencabut seluruh sesi; perubahan kata sandi mencabut sesi lain; penutupan/penangguhan akun juga mencabut sesi. Model Session mempunyai `createdAt`, `lastSeenAt`, `expiresAt`, dan `revokedAt`.

Web memakai `useMe` dan AppShell untuk halaman `/app`. Pemeriksaan akun mempunyai stale time 30 detik; refetch saat fokus tab dinonaktifkan. Logout saat ini hanya menghapus query `me` dan mengalihkan ke login melalui `finally`. Login selalu menuju `/app`. Halaman admin belum mempunyai guard peran bersama pada layout tersendiri. Baseline ini belum membuktikan perilaku yang konsisten pada setiap rute, semua cache privat, respons yang masih berjalan, atau tab lain.

## Kebijakan setiap kelompok halaman

Inventaris seluruh `apps/web/src/app/**/page.tsx` menjadi daftar pemeriksaan tahap 6. Setiap rute mempunyai klasifikasi akses dan hasil untuk Guest, User, Admin, email belum terverifikasi, akun tidak aktif, sesi kedaluwarsa/dicabut, dan gangguan jaringan. Satu rute contoh tidak menggantikan pemeriksaan seluruh kelompok.

| Kelompok | Rute saat ini | Perilaku yang ditargetkan |
| --- | --- | --- |
| Publik | `/`, `/cara-kerja`, `/market`, `/market/[listingId]`, `/passport/[id]`, `/impact` | Guest tetap bisa membaca data publik. Header dan CTA mengikuti sesi yang diketahui; status sesi tidak menampilkan informasi pengguna lama. Aksi yang membutuhkan login membawa tujuan kembali yang aman. |
| Masuk dan daftar | `/masuk`, `/daftar` | Pengguna dengan sesi aktif diarahkan ke tujuan internal yang diizinkan atau `/app`. Saat pemeriksaan sesi berlangsung, form tidak menampilkan keadaan yang keliru. Kegagalan koneksi mempunyai retry. |
| Pemulihan dan verifikasi | `/lupa-kata-sandi`, `/reset-password`, `/verifikasi-email` | Tautan/token diproses sesuai tujuan, termasuk ketika browser sudah mempunyai sesi. Reset memperbarui state sesi browser/tab lain; verifikasi memperbarui kemampuan akun tanpa harus memuat ulang secara manual. Respons tidak membocorkan keberadaan akun. |
| Pengguna | Seluruh `/app/**` selain halaman admin | Sesi diperiksa sebelum konten privat dirender atau query privat dijalankan. Guest/sesi kedaluwarsa diarahkan ke login dengan pemberitahuan dan tujuan kembali. Akun tidak aktif mendapat state yang jelas. |
| Admin | Seluruh `/app/admin/**`, termasuk halaman detail dinamis | Guard sesi dan peran berlaku pada layout bersama serta API. User biasa mendapat state tidak berhak tanpa memuat query/admin content. Grant kasus tetap diperiksa pada setiap baca/tindakan terkait dan mempunyai masa berlaku sendiri. |
| Resource privat | Item/Assessment/Repair, Listing milik pengguna, Offer, chat, transaksi, kasus, serta Impact pribadi | Sesi valid tetap diikuti pemeriksaan owner/peserta/penugasan. Forbidden, not found, grant kedaluwarsa, dan sesi kedaluwarsa mempunyai respons UI berbeda sesuai kontrak. |

## State sesi bersama

Satu pengelola sesi untuk seluruh aplikasi menyediakan keadaan sedang diperiksa, Guest, terautentikasi, akun dibatasi, dan layanan sesi tidak dapat dijangkau. Status email belum terverifikasi menjadi kemampuan akun, sehingga pengguna tetap dapat menyimpan Item sesuai aturan produk.

Pemeriksaan dilakukan saat aplikasi dibuka, navigasi ke rute privat, tab kembali aktif, dan koneksi pulih. Permintaan berdekatan digabung dan dibatasi agar tidak melakukan polling agresif pada semua komponen. Kedaluwarsa berdasarkan waktu server; aktivitas UI tidak otomatis memperpanjang masa sesi.

Penanganan global membedakan:

- `401 UNAUTHENTICATED`: hentikan query/mutasi privat, hapus data privat yang terlihat, dan tawarkan masuk kembali.
- Akun CLOSED/SUSPENDED atau status tidak aktif: tampilkan alasan penggunaan dibatasi dan hentikan interaksi privat.
- `403` izin resource, grant kasus, email belum terverifikasi, atau CSRF: tampilkan penanganan sesuai penyebab; jangan mengubahnya menjadi logout umum.
- Offline, timeout, atau `5xx`: tampilkan status koneksi/retry tanpa menyatakan sesi sudah berakhir.

Redirect login memakai tujuan internal yang divalidasi. URL eksternal, protocol-relative URL, tujuan yang menyebabkan loop login, dan rute admin bagi User ditolak. Setelah login, tujuan divalidasi ulang terhadap aktor dan izin resource; fallback adalah `/app`.

## Logout, perpindahan akun, dan cache

Login, logout, perubahan aktor, revokasi, dan sesi berakhir harus memperbarui state sesi bersama. Query privat dipisahkan menurut aktor atau dikeluarkan dari cache secara menyeluruh saat identitas berubah. Permintaan lama dibatalkan atau responsnya diabaikan agar tidak mengisi kembali cache setelah logout/pergantian akun.

Pembersihan mencakup data akun/Item, percakapan/unread/SSE, transaksi, bukti kasus, grant admin, hasil penjelasan privat, draft berisi data privat, dan payload tindakan yang disimpan browser. Tombol Back/Forward serta pemulihan halaman browser juga memeriksa sesi sebelum menampilkan data privat lagi.

Sinkronisasi login/logout/perubahan akun antartab memakai notifikasi perubahan state dan validasi ulang server. Token sesi atau isi privat tidak dikirim melalui notifikasi tersebut. Tab yang kembali dari background mengonfirmasi sesi dan aktor sebelum melanjutkan kerja privat.

Logout gagal karena jaringan tidak boleh ditampilkan sebagai logout server yang telah dikonfirmasi. Data privat lokal disembunyikan, tindakan privat dihentikan, dan pengguna memperoleh status belum pasti serta pilihan retry. Logout ulang pada sesi yang sudah dicabut harus berakhir secara aman dan membersihkan cookie.

Untuk tindakan kritis yang hasilnya belum pasti, perpindahan akun tidak boleh melanjutkan payload aktor terdahulu. Setelah masuk kembali sebagai aktor yang sama, UI memeriksa status server/idempotensi dan meminta tindakan pengguna secara eksplisit; tidak mengirim ulang mutasi otomatis. Payload privat dibersihkan, sedangkan informasi pemulihan minimum yang dipertahankan harus dibatasi kepada aktor asal dan tidak berisi token/chat/bukti privat.

## Pengelolaan sesi aktif

Profil menyediakan daftar sesi akun sendiri, tanda sesi saat ini, waktu dibuat/aktivitas terakhir, masa berlaku, aksi mencabut sesi tertentu, dan aksi keluar dari sesi lain. Sesi kedaluwarsa/dicabut tidak ditampilkan sebagai aktif. Metadata tidak memuat token atau hash token, tidak mengungkap sesi pengguna lain, dan tidak mengklaim lokasi/perangkat yang belum diketahui.

Backend memperbarui aktivitas terakhir secara terbatas, memberi metadata sesi saat ini yang aman, memeriksa kepemilikan sesi pada daftar/revokasi, dan memproteksi mutasi dengan CSRF. Aksi pencabutan dapat diulang tanpa hasil ganda. Pencabutan sesi sendiri memperbarui state aplikasi sebagaimana logout; pencabutan sesi lain mempertahankan sesi saat ini.

Pemeriksaan juga mencakup cookie sesi, kebocoran credential di URL/storage/log, token verifikasi/reset sekali pakai, CSRF yang kedaluwarsa, dan validasi akun/sesi pada tindakan penting yang bersaing dengan revokasi. Kontrak endpoint pengelolaan sesi dikunci dalam kontrak API dan OpenAPI saat implementasi tahap 6.

## Urutan pekerjaan

1. Inventaris setiap rute dan query privat; petakan pemeriksaan sesi, peran, owner/peserta, verifikasi email, serta grant kasus.
2. Terapkan state sesi bersama, penanganan error terpusat, guard halaman/layout, dan tujuan kembali setelah login.
3. Tangani logout, revokasi, pembersihan cache/storage, respons lama, SSE, dan sinkronisasi antartab.
4. Tambahkan pengelolaan sesi aktif pada API serta profil, beserta metadata aman dan pembaruan aktivitas.
5. Jalankan matriks auth/sesi pada desktop/mobile dan lanjutkan pemeriksaan hardening lain pada [rencana teknis](05-technical-plan.md).

## Kriteria selesai

Seluruh rute yang diinventaris mempunyai kebijakan akses dan bukti verifikasi. Konten privat tidak sempat tampil bagi Guest atau aktor yang salah. Login kembali membawa pengguna ke tujuan yang sah. Logout, revokasi, reset kata sandi, dan perubahan akun konsisten pada seluruh halaman serta tab, termasuk respons lama dan browser history. Gangguan jaringan tidak disamakan dengan sesi berakhir.

Daftar/revokasi sesi hanya berlaku untuk akun sendiri. Tidak ada token atau payload privat lintas akun di cache/storage. Aksi penting yang terputus tidak dikirim ulang otomatis, dan akses admin/resource tetap divalidasi server. Matriks penerimaan rinci ditambahkan pada [skenario demo](13-acceptance-and-demo.md#tambahan-penerimaan-tahap-6--auth-dan-session-management).
