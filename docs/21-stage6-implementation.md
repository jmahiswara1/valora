# Implementasi tahap 6 — hardening dan auth/session management

**Status:** tahap 6 selesai dan terverifikasi, 2 Oktober 2026. Target adalah demo lokal MVP, sesuai O11.

## Kebijakan sesi yang disepakati

- Sesi opak tujuh hari sejak login. Aktivitas tidak memperpanjang expiry; tidak ada expiry karena idle.
- Login mencabut sesi browser sebelumnya, mempertahankan sesi perangkat lain. Logout dapat diulang sesudah expiry/revokasi.
- Pembuktian password berlaku 15 menit per sesi untuk perubahan email, penutupan akun, pencabutan sesi lain, pembalikan kepemilikan, dan publikasi rubrik. Login baru dihitung sebagai pembuktian. Ganti password tetap memakai password saat ini.
- Grant CHAT/EVIDENCE/operasi kasus tetap terpisah, lima menit. Kebutuhan reautentikasi tidak menggantikan izin kasus.
- Metadata sesi sendiri: waktu dibuat, aktivitas, expiry, ID dan penanda sesi saat ini. Tidak ada token/hash atau klaim lokasi/perangkat.

## Perubahan implementasi

### Backend

`auth.ts` memakai resolusi sesi bersama, pembaruan `lastSeenAt` maksimal sekali setiap lima menit, endpoint metadata/reauth/sesi/status tindakan, serta rate limit PostgreSQL. SQL rate limit memakai UTC secara eksplisit; pemeriksaan dua proses menemukan dan memperbaiki perbandingan timezone database.

`request-context.ts` membawa aktor yang telah diverifikasi ke transaksi. `serial` memeriksa sesi/status/peran kembali sebelum menjalankan mutasi. Login/reset/ganti password/revokasi/close memakai jalur transaksi yang sama. Password diverifikasi sebelum lock, lalu hash/status diperiksa kembali di dalam transaksi. Token verifikasi/reset tidak memutasi akun nonaktif.

Untuk demo lokal, satu advisory transaction gate mengurutkan mutasi domain, perubahan kebijakan, dan retention hold. Lock User/resource yang sudah ada tetap berlaku. Isolation READ COMMITTED memberi pembacaan baru setelah menunggu gate; snapshot izin yang diambil sebelum menunggu tidak dipakai. Pendekatan ini membatasi throughput penulisan; sebelum operasi publik/multi-instance berskala besar, ganti dengan koordinasi per aktor/resource dan uji ulang urutan lock.

Replay idempotensi memeriksa izin resource, peran, penugasan, dan grant terkini sebelum mengembalikan salinan respons privat. Mutasi yang sudah tercatat tidak dijalankan ulang karena versi lama. Registry contracts menyatukan operation frontend/backend; Repair dan moderasi lama ikut dipetakan pada status pemulihan. Status hanya mengembalikan metadata hasil, bukan bukti/pesan/kontak privat.

Approval Listing memeriksa kategori/subkategori aktif dan Assessment yang masih valid. SSE memeriksa sesi sebelum setiap event dan setiap sepuluh detik; revokasi menutup stream. Reconnect UI memuat pesan terbaru dan polling tetap tersedia.

### Frontend

`SessionProvider` menyediakan CHECKING, GUEST, AUTHENTICATED, RESTRICTED, UNAVAILABLE, LOGOUT_PENDING. `useMe` membaca sumber yang sama. AppShell memeriksa pathname terverifikasi sebelum memasang halaman privat, termasuk seluruh halaman admin dan peran. Header publik mengikuti sesi; login/daftar menunggu pemeriksaan awal agar form tidak hilang ketika pengguna mulai mengetik.

Pemeriksaan dilakukan pada navigasi, pemulihan history, fokus/online, dan heartbeat 30 detik pada tab terlihat dengan sesi aktif. BroadcastChannel/storage event hanya mengirim pemberitahuan perubahan; tab mengonfirmasi server. Cache QueryClient terpisah menurut generasi sesi, permintaan lama dibatalkan, respons terlambat ditolak, komponen privat/draft/SSE dilepas saat identitas berubah. `next` hanya menerima pathname rute internal yang terdaftar dan sesuai peran.

Offline/timeout/5xx tidak dinyatakan sebagai logout. Timeout REST 15 detik tersedia. Logout belum terkonfirmasi menyembunyikan data privat dan menyediakan retry sesudah permintaan sebelumnya selesai. Tombol dinonaktifkan selama permintaan berjalan agar tidak terjadi dua upaya bersamaan. Password salah/izin resource/email belum terverifikasi/grant berakhir tidak menyebabkan logout global. Verifikasi email memperbarui kemampuan akun antartab; reset password mengonfirmasi sesi server, membersihkan cache/tab lain, lalu menuju login dengan pemberitahuan keberhasilan.

Tindakan kritis hanya menyimpan aktor, operation, dan key di sessionStorage. Payload legacy dibersihkan. Sesudah koneksi/login pulih, UI memeriksa metadata hasil tanpa mengirim ulang mutasi. `NOT_FOUND` tetap belum pasti; pengguna dapat menutup pemeriksaan secara eksplisit setelah memeriksa resource. Bukti admin ditutup dan cache dibersihkan saat grant berakhir atau server menolak akses.

### Operasi, privasi, dan performa

- Maintenance, mail, retention, dan storage drain memakai advisory session lock pada koneksi PostgreSQL khusus; proses kedua melewati job yang masih berjalan.
- Antrean penghapusan durable mendukung MEDIA/MAIL. Email lokal yang kedaluwarsa dan berumur minimal 24 jam dihapus bersama outbox melalui antrean tersebut.
- Purge memeriksa hold/kasus/status kembali dalam transaksi; hitungan tidak menghitung konteks yang sudah dihapus. Pembacaan kandidat dan pencarian respons idempotensi memakai filter database.
- Antrean laporan/koreksi/hold berhalaman 30 baris. Detail metadata mempunyai endpoint tersendiri, sehingga URL langsung tidak tergantung halaman pertama antrean.
- Semua respons API `no-store`; log error hanya event/request ID/status/jenis, tanpa input privat.
- Bug bentuk envelope pada antrean moderasi ditemukan oleh matriks rute dan diperbaiki. Dialog tetap native, menggunakan label/fokus dan konfirmasi eksplisit.

## Migrasi dan kontrak

Migrasi `20261002120000_stage6_sessions` bersifat aditif: Session.reauthenticatedAt, AuthRateBucket, StorageDeletion.kind. Sesi lama memakai createdAt untuk stamp reauth. Contracts dan OpenAPI 1.7.0; endpoint rinci pada [kontrak API](12-api-contract.md#tahap-6--sesi-dan-pemulihan-tindakan-openapi-170).

### Foto profil

Migrasi `20261002130000_profile_photos` menambahkan metadata foto dan provider `LOCAL`/`CLOUDINARY`. Foto disimpan sebagai WebP 512 × 512 pada tabel `ProfilePhoto`, terpisah dari foto barang. Unggahan lokal memakai `.local/media/profile-photos`; setelah seluruh key Cloudinary tersedia, halaman profil menjalankan migrasi otomatis dan mempertahankan file lokal bila migrasi gagal. Penggantian, penghapusan, dan penutupan akun memasukkan aset lama ke antrean retensi. Rute lokal foto hanya mengizinkan pemilik atau peserta percakapan, dan DTO hanya menambahkan URL kepada pemilik akun serta peserta chat. Foto tidak ditambahkan ke Market atau Passport.

Isi `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, dan `CLOUDINARY_API_SECRET` pada `apps/api/.env.local`, lalu restart API; jangan menaruh API secret di variabel frontend.

## Inventaris seluruh halaman

| Rute | Klasifikasi akses |
| --- | --- |
| `/` | Publik / proyeksi publik |
| `/app` | User / resource sendiri |
| `/app/admin` | Admin |
| `/app/admin/analitik` | Admin |
| `/app/admin/audit` | Admin |
| `/app/admin/koreksi/[id]` | Admin |
| `/app/admin/laporan` | Admin |
| `/app/admin/laporan/[id]` | Admin |
| `/app/admin/moderasi` | Admin |
| `/app/admin/moderasi/[revisionId]` | Admin |
| `/app/admin/pengguna` | Admin |
| `/app/admin/rubrik` | Admin |
| `/app/admin/sengketa` | Admin |
| `/app/admin/sengketa/[id]` | Admin |
| `/app/admin/transaksi` | Admin |
| `/app/barang` | User / resource sendiri |
| `/app/barang/[id]` | User / resource sendiri |
| `/app/barang/[id]/edit` | User / resource sendiri |
| `/app/barang/[id]/passport` | User / resource sendiri |
| `/app/barang/[id]/penilaian` | User / resource sendiri |
| `/app/barang/[id]/penilaian/[assessmentId]` | User / resource sendiri |
| `/app/barang/[id]/penilaian/baru` | User / resource sendiri |
| `/app/barang/[id]/perbaikan` | User / resource sendiri |
| `/app/barang/baru` | User / resource sendiri |
| `/app/impact` | User / resource sendiri |
| `/app/koreksi/[id]` | User / resource sendiri |
| `/app/listings` | User / resource sendiri |
| `/app/listings/[id]` | User / resource sendiri |
| `/app/listings/new` | User / resource sendiri |
| `/app/penawaran` | User / resource sendiri |
| `/app/pesan` | User / resource sendiri |
| `/app/pesan/[id]` | User / resource sendiri |
| `/app/profil` | User / resource sendiri |
| `/app/transaksi` | User / resource sendiri |
| `/app/transaksi/[id]` | User / resource sendiri |
| `/cara-kerja` | Publik / proyeksi publik |
| `/daftar` | Auth / tujuan tautan |
| `/impact` | Publik / proyeksi publik |
| `/lupa-kata-sandi` | Auth / tujuan tautan |
| `/market` | Publik / proyeksi publik |
| `/market/[listingId]` | Publik / proyeksi publik |
| `/masuk` | Auth / tujuan tautan |
| `/passport/[id]` | Publik / proyeksi publik |
| `/reset-password` | Auth / tujuan tautan |
| `/verifikasi-email` | Auth / tujuan tautan |

Matriks browser menggunakan ID yang tidak ditemukan pada rute dinamis untuk memeriksa guard dan state error. Resource sah diperiksa dalam E2E transaksi/Passport/koreksi dan smoke API. Bukti setiap rute, role/state, dan jenis navigasi disimpan sebagai JSON per viewport.

## Verifikasi

Smoke API tahap 1–6 dan enam uji rumus lulus. Smoke tahap 6 membuktikan 15 kelompok pemeriksaan, termasuk dua proses API pada database yang sama, race revokasi/mutasi, perubahan rubrik/moderasi/Offer, expiry SSE, grant pada replay, pagination melewati 100 baris, lock job, hold/purge, dan penghapusan email durable. Build, typecheck, serta lint lulus. Seluruh 16 E2E desktop/mobile lulus dalam 9,3 menit. Matriks mencakup 45 rute × sembilan status × dua viewport: 810 pemeriksaan URL langsung, 180 refresh, dan 136 pemeriksaan Back/Forward. Pemeriksaan sesi terpisah membuktikan logout antartab, retry offline, next aman, reautentikasi, revokasi/expiry, verifikasi/reset password antartab, expiry grant, serta respons privat terlambat.

Bukti lokal:

- `.local/stage6-verification.json`.
- `.local/stage6-smoke.log` dan `.local/stage6-test-evidence.json`.
- `.local/stage6-e2e.log` dan `.local/stage6-evidence/routes-{desktop,mobile}.json`.
- `.local/stage6-evidence/sessions-{desktop,mobile}.png`.
- `.local/stage6-typecheck.log`, `.local/stage6-web-typecheck.log`, `.local/stage6-lint.log`, `.local/stage6-build.log`, `.local/stage6-web-build.log`.

## Demonstrasi empat jalur

Jalankan `corepack pnpm demo:stage6`, lalu `corepack pnpm dev`. Fixture tambahan dibuat pada database dev tanpa reset ledger; rute disimpan di `.local/stage6-demo-fixtures.json`. Kredensial demo tetap pada `.local/demo-credentials.json`.

1. **Keep/Repair:** owner membuka barang privat, Assessment dan Repair. Lihat penjelasan template, koreksi catatan, dan sharing bukti. Buka profil untuk melihat/cabut sesi.
2. **Resell:** lihat Passport publik, snapshot transaksi selesai, harga kesepakatan dan kontribusi Impact. Harga bukan bukti pembayaran.
3. **Exchange/Donate:** lihat dua arah Exchange dan Passport Item yang belum pernah dilisting; Donate parsial memakai proyeksi terbatas. Verifikasi ledger dan catatan yang tetap tersimpan.
4. **Operasi admin:** buka laporan/koreksi, ambil penugasan, isi alasan grant, tinjau bukti, lalu konfirmasikan tindakan. Tunjukkan reautentikasi untuk reverse/publish, expiry grant, hold retensi, dan audit metadata.

Untuk demo antartab gunakan dua tab browser yang sama. Untuk demo dua akun bersamaan gunakan profil browser/konteks terpisah. Layanan AI/email/storage eksternal dan deployment publik mengikuti O11; transport SSE lintas proses tetap polling fallback pada demo lokal.
