# Perbaikan P1/P2 audit developer

Perbaikan ini menindaklanjuti audit baseline `83fc3ff` pada 2 November 2026. Kontrak request/response tetap kompatibel dan tidak ada migrasi database baru.

## Email dan outbox

`MailService` mendukung SMTP melalui Nodemailer. Konfigurasi pengirim, host, port, TLS, dan pasangan kredensial divalidasi ketika service dibuat. Adapter berkas lokal dibatasi untuk `APP_ENV=local`. Konfigurasi lengkap tersedia pada [panduan pengembangan](development.md#email-produksi).

Registrasi, permintaan reset, dan perubahan email menyimpan pesan terenkripsi bersama operasi akun. Pada produksi, worker yang melakukan pengiriman; kegagalan SMTP tidak mengubah request yang sudah commit menjadi respons gagal. Worker mempertahankan pesan yang gagal, mencatat percobaan dan waktu retry, serta membersihkan token kedaluwarsa tanpa mengirimkannya. Message-ID stabil membantu mengenali retry, tetapi pengiriman tetap mempunyai semantik at-least-once.

Tes pengiriman memakai transport simulasi. Runner API/E2E selalu menggunakan adapter lokal. Pengiriman nyata memerlukan konfigurasi SMTP, pengirim/domain yang disetujui provider, dan pemeriksaan delivery pada lingkungan deployment.

## Penutupan akun

Dalam transaksi penutupan akun, listing yang masih dapat ditawarkan ditarik dan offer masuk maupun keluar yang masih tertunda diakhiri dengan alasan `ACCOUNT_CLOSED`. Listing yang direservasi tetap terkait dengan transaksi/kasus yang perlu diselesaikan.

Query daftar/detail/foto Market dan proyeksi Favorit memeriksa status pemilik. Pemeriksaan ini juga melindungi data lama yang memiliki listing ACTIVE milik akun nonaktif. Pencocokan notifikasi pencarian memakai predicate Market yang sama. Regresi memeriksa kondisi normal serta data lama yang sengaja disimulasikan berstatus ACTIVE setelah pemilik CLOSED.

## Pemulihan foto

Upload mengikat tiket pada key berisi hash foto hasil normalisasi sebelum melakukan I/O storage. File ditulis sementara dan dipublikasikan secara atomik. Retry foto identik dapat melanjutkan commit atau membaca hasil upload yang sudah selesai; foto berbeda memerlukan tiket baru. Retry konkuren tidak menghapus file yang dipakai upload lain.

Jika proses berhenti sebelum finalisasi, tiket tetap merekam key untuk pembersihan orphan. Maintenance juga membersihkan file sementara berumur lebih dari 24 jam. Penghapusan foto barang mencatat tombstone dan antrean penghapusan dalam transaksi yang sama, sehingga kegagalan storage dapat dicoba ulang oleh worker.

Nama key adalah rincian internal. Fixture pengujian membaca `storageKey` dari tiket, tanpa menyusun nama file sendiri. Implementasi penyimpanan ini menggunakan filesystem yang mendukung hard link dalam direktori media yang sama.

## Pembacaan publik dan penguncian

Passport publik, Impact platform, serta profil/ulasan/listing publik memakai transaksi `REPEATABLE READ` dan `READ ONLY`. Proyeksi melihat visibilitas dan isi pada snapshot yang konsisten, tanpa mengambil advisory lock mutasi global.

Jalur mutasi dan pembacaan privat yang memerlukan pemeriksaan sesi tetap menggunakan mekanisme otorisasi yang ada. Regresi PostgreSQL menahan kunci mutasi, membuktikan pembacaan publik tetap selesai, memastikan perubahan visibilitas terlihat pada request berikutnya, dan membuktikan transaksi baca menolak penulisan.

Kontensi antarmutasi masih memakai kunci global. Peningkatan paralelisme mutasi memerlukan pengukuran beban dan perubahan kunci per aggregate dengan pengujian race tersendiri.

## Test harness

Factory maintenance/retensi dikompilasi bersama API sehingga perubahan constructor memicu kesalahan tipe. Smoke menggunakan dependensi lengkap dari factory tersebut. Runner unit test menemukan seluruh file test secara otomatis, dan smoke hardening dijalankan oleh perintah test resmi.

Matriks sesi browser menemukan seluruh rute dari source dan tetap memeriksa akses untuk setiap rute/peran; ia tidak lagi gagal hanya karena jumlah halaman bertambah. Tes dialog memeriksa fokus awal pada judul dan tombol konfirmasi yang nonaktif sebelum persetujuan, sesuai perilaku komponen.

## Verifikasi

- Lint dan typecheck seluruh monorepo lulus.
- Build produksi contracts, API, dan web lulus.
- 39 unit test lulus, termasuk 11 regresi email, upload, dan storage yang baru.
- Seluruh 14 smoke API lulus pada `valora_test`, termasuk sesi, retensi, transaksi, serta hardening penutupan akun dan snapshot publik.
- Delapan skenario E2E desktop lulus. Dua ekspektasi test lama diperbaiki dan diuji ulang: matriks berisi 495 kombinasi dari 55 rute dan sembilan kondisi sesi, serta alur Exchange dengan pemulihan jaringan dan putusan admin.

Log pemeriksaan lokal berada di `.local/p1-p2-*.log`.
