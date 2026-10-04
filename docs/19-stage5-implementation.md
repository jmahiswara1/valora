# Implementasi tahap 5 — jejak dan operasi

**Status:** selesai untuk baseline lokal MVP, 2 Oktober 2026. Tahap ini melanjutkan transaksi tahap 4 dan menerapkan Passport, Impact, koreksi, operasi admin, rubrik/acuan, retensi, serta penjelasan Assessment. Hardening menyeluruh tahap 6 dan keputusan operasi publik O11 tetap menjadi tahap berikutnya.

## Keputusan implementasi

- Penjelasan Assessment menggunakan **template terlebih dahulu**, sesuai keputusan pengguna. Tidak memerlukan API key atau mengirim data ke penyedia AI. Interface provider, skema keluaran, cache, serta pembatasan permintaan sudah tersedia untuk integrasi selanjutnya.
- Koreksi kepemilikan memakai **satu admin yang ditugaskan**, bukti terkait, alasan, versi, grant beralasan, dan audit. Tidak ada syarat persetujuan admin kedua.
- Fixture dan bukti uji bersifat sintetis. Skrip demo menambahkan data baru tanpa mereset database atau mengubah transaksi lama.

## Passport dan ledger

Pembuatan Item, Assessment, Repair, dan persetujuan Listing mencatat event dalam transaksi database yang sama dengan sumbernya. Event `REGISTERED`, `ASSESSMENT_CREATED`, `REPAIR_RECORDED`, `LISTED`, event transfer tahap 4, dan `CORRECTION` memiliki kunci sumber unik. Ledger Passport/Impact dilindungi trigger terhadap UPDATE/DELETE; koreksi menambahkan event/delta baru dengan referensi ke catatan asal.

Backfill baseline berjalan saat startup, tercatat sebagai `STAGE5_LEDGER_BACKFILL` pada `MaintenanceRun`. `LedgerService.backfill` dapat diulang tanpa kontribusi ganda. Waktu sumber historis tetap dipakai, termasuk waktu sebelum koreksi Repair; publikasi Listing memakai waktu keputusan APPROVE.

Passport publik tersedia jika Item mempunyai Listing ACTIVE/RESERVED atau pernah masuk transaksi COMPLETED. Judul, deskripsi, foto, dan hasil penilaian publik berasal dari revisi Listing yang disetujui. Edit privat Item tidak langsung menjadi publik. Item penukar yang belum pernah dipublikasikan hanya menampilkan ID/kategori dan event yang aman; judul serta snapshot privat transaksi Exchange tidak disalin.

Biaya/catatan/foto Repair privat, identitas, kontak, pesan, harga kesepakatan, dan alasan kasus tidak muncul pada Passport publik. Repair publik dibaca ulang berdasarkan status dan pilihan sharing terkini. Owner memperoleh proyeksi tersendiri; data privat milik owner lama tetap mengikuti kebijakan Assessment/Repair, bukan diperluas melalui Passport.

`LIMITED` menampilkan identitas minimum dan pemberitahuan pembatasan tanpa timeline. `HIDDEN` menghasilkan 404 untuk publik. Pembatasan/pemulihan memerlukan kasus terkait, penugasan, alasan, versi Passport, serta audit. Akses foto memeriksa ulang hak baca setiap permintaan dan memakai `Cache-Control: no-store`.

## Lima metrik Impact

| Metrik | Kontribusi dan atribusi |
| --- | --- |
| `ITEMS_REVALUED` | Satu per Item berdasarkan Assessment COMPLETE valid pertama; pengguna yang membuat Assessment pertama mendapat kredit. Assessment tambahan tidak menggandakan kredit. Pembatalan/pemulihan sumber menyesuaikan kredit. |
| `REPAIRS_RECORDED` | Satu untuk setiap Repair valid yang dilaporkan, kepada pembuatnya; VOID/RESTORE menambahkan delta. Ini merupakan laporan perbaikan, bukan sertifikasi hasil fisik. |
| `COMPLETED_TRANSFERS` | Platform satu per transaksi selesai; masing-masing peserta satu. Exchange tetap satu transaksi pada platform. Pembalikan mengurangi kontribusi. |
| `ESTIMATED_TRANSFER_WEIGHT` | Berat diketahui per Item yang ditransfer, diatribusikan kepada pengirim. Exchange mencakup kedua Item. Nilai tanpa data tetap kosong dan ditampilkan bersama coverage Item dengan berat diketahui. |
| `CONFIRMED_SALE_VALUE` | Harga final Resell yang disepakati, kepada penjual; tidak menyatakan pembayaran telah diterima. Donate/Exchange tidak menghasilkan nilai jual. |

API mengirim bilangan bulat sebagai string desimal dari BigInt. Koreksi berat/harga/transfer memakai periode kejadian asli, bukan periode saat admin memperbaikinya. API menerima UTC `[from,to)`; UI menyediakan 30 hari, 90 hari, dan seluruh waktu dengan batas hari Asia/Jakarta. Coverage menghitung Item transfer yang belum dibalik, termasuk perbedaan data berat diketahui/tidak diketahui.

## Koreksi dan operasi admin

`CorrectionCase` terpisah dari `DisputeCase`. Peserta atau admin dapat membuka kasus pada transaksi COMPLETED. Antrean menampilkan metadata; detail bukti memerlukan hak peserta atau penugasan admin dengan grant lima menit. Foto koreksi memakai `CorrectionAttachment` tersendiri sehingga tidak masuk galeri Item/Listing.

Pembalikan memeriksa owner penerima asli, reservasi baru, arsip, dan transfer berikutnya. Guard gagal menutup kasus sebagai BLOCKED tanpa perubahan owner/ledger. Resell/Donate mengembalikan satu Item; Exchange mengembalikan keduanya secara atomik. Listing terkait ditarik dan Offer kedaluwarsa. Transaksi asli tetap COMPLETED dengan `correctedAt`; OwnershipTransfer asal tetap ada dan delta Impact membatalkan kontribusi bersihnya.

Koreksi berat/harga memerlukan versi transaksi dan kasus yang ditugaskan. Pembatalan/pemulihan Assessment atau Repair memerlukan versi sumber dan bukti kasus; Assessment berikutnya yang valid dapat mengambil kredit pertama ketika sumber awal dibatalkan. Listing yang memakai sumber terdampak dijeda dan Offer terkait berakhir. Kesepakatan diterima tetap mempunyai snapshot historisnya.

Dashboard admin memuat antrean moderasi, laporan, sengketa, koreksi, dan transaksi melewati target. Halaman pengguna/transaksi menyediakan pencarian, filter, dan cursor. Penangguhan akun mencabut sesi, mengakhiri interaksi/Offer, dan membuka sengketa untuk kesepakatan aktif. Pemulihan akun tidak otomatis mengaktifkan Listing. Akun CLOSED tidak dapat dipulihkan melalui aksi ini.

Laporan TRANSACTION hanya dapat dibuat peserta. Antrean laporan tidak mengirim isi pesan atau detail bebas. Claim, grant beralasan, keputusan berversi, dan idempotensi melindungi tindakan admin. Audit umum hanya metadata. Detail audit REPORT/CORRECTION/DISPUTE harus terkait dengan grant kasus; sengketa menggunakan grant EVIDENCE tahap 4. Audit tindakan Listing yang merujuk laporan sama dapat dibaca dalam konteks REPORT tersebut.

Analitik menampilkan definisi, pembilang, dan penyebut: penyelesaian transaksi berdasarkan kohor `acceptedAt`, serta APPROVE dibagi seluruh keputusan moderasi pada periode. Transaksi yang dibalik tidak dihitung sebagai penyelesaian bersih. Penyebut nol menghasilkan nilai kosong.

## Rubrik dan acuan ekonomi

Draft dapat menyalin versi terbit dan mengedit prompt, label, konteks, serta kebijakan keselamatan. Enam indikator, lima nilai tingkat, dan formula score-v1 tetap. Kebijakan keselamatan baseline tidak dapat dihapus atau dilemahkan. Tujuh fixture publikasi memeriksa struktur, COMPLETE, PARTIAL_ECONOMIC, keselamatan belum diketahui, kebijakan keselamatan, batas ekonomi, dan pembulatan.

Publikasi menghasilkan RubricVersion baru yang immutable di database dan langsung berlaku; advisory lock per rubricKey menjaga urutan publikasi. Listing tanpa reservasi yang terdampak dijeda dan Offer kedaluwarsa. Snapshot transaksi yang telah diterima tetap tersimpan.

Admin dapat mengubah nama/status kategori serta membuat, menonaktifkan, dan mengaktifkan acuan ekonomi berversi. Acuan wajib mencantumkan sumber, tanggal, wilayah, dan nominal. Pengguna memilih referensi secara eksplisit pada form Assessment. Server mengambil nominal/sumber/tanggal/wilayah dari referensi aktif dan mengabaikan nilai acuan yang dipalsukan klien. Menonaktifkan acuan tidak mengubah snapshot lama.

## Penjelasan Assessment

`POST /assessments/{id}/explain` mengembalikan keluaran tervalidasi dengan `source: TEMPLATE` dan versi template. Otorisasi dijalankan pada setiap permintaan, termasuk cache hit. Kunci cache mencakup Assessment/version, template, proyeksi pembaca, dan status historis. Batas sepuluh permintaan per menit per pengguna berlaku pada satu proses API lokal.

Template hanya membaca hasil terstruktur. Teks instruksi dalam jawaban pengguna tidak diteruskan sebagai instruksi atau disalin ke penjelasan. PARTIAL_ECONOMIC/INCOMPLETE tidak mendapat Score/label keseluruhan buatan; hasil historis atau dibatalkan diberi penanda. Provider AI eksternal masih ditunda sesuai keputusan pengguna.

## Retensi

| Data | Batas lokal |
| --- | --- |
| Profil akun CLOSED | 30 hari sejak penutupan; akun/profil dianonimkan ketika tidak ada transaksi/kasus/laporan/hold yang menghalangi. |
| Percakapan tanpa transaksi/kasus | 90 hari sejak pesan terakhir atau pembuatan percakapan jika belum ada pesan. |
| Data terkait transaksi/kasus | 180 hari sejak penutupan terminal terakhir transaksi/kasus/laporan terkait. Transaksi/kasus aktif dan hold mencegah purge. |

Hold memerlukan kasus yang ditugaskan, alasan, serta tanggal review paling lama 180 hari. Admin dapat mencabut hold dengan versi/alasan. Hold yang berakhir tidak mengembalikan data yang sudah dibersihkan.

Purge menghapus isi pesan, snapshot pesan pada bukti, catatan/foto bukti, alasan privat, detail laporan, snapshot koordinasi transaksi, salinan identitas peserta, dan field privat pada audit/grant/hold terkait. Retensi akun membersihkan jawaban/sumber privat Assessment, biaya/catatan Repair, salinan koreksi, foto privat yang tidak dibagikan, dan data Item privat tanpa transfer. Riwayat transfer dan ledger tetap ada.

Respons idempotensi yang mengandung salinan data tersebut menjadi tombstone; retry mengembalikan `410 RESPONSE_RETAINED_AS_TOMBSTONE` dan tidak menjalankan mutasi lagi. Storage dibersihkan melalui antrean durable `StorageDeletion` setelah commit, dengan retry/backoff jika gagal. Hasil maintenance disimpan pada `MaintenanceRun`; scheduler lokal berjalan saat startup dan berkala.

## Rute UI

| Rute | Fungsi |
| --- | --- |
| `/passport/[id]`, `/impact` | Passport dan agregat publik. |
| `/app/barang/[id]/passport`, `/app/impact` | Passport owner dan kontribusi pengguna. |
| `/app/koreksi/[id]` | Konteks/bukti kasus koreksi peserta. |
| `/app/admin` | Dashboard operasi dan Impact. |
| `/app/admin/pengguna`, `/app/admin/transaksi` | Pencarian/filter pengguna dan transaksi, antrean koreksi. |
| `/app/admin/laporan/[id]`, `/app/admin/koreksi/[id]` | Claim, akses beralasan, bukti, keputusan, visibilitas, dan hold. |
| `/app/admin/rubrik` | Draft/fixture/publikasi, kategori, dan acuan ekonomi. |
| `/app/admin/analitik`, `/app/admin/audit` | Periode/definisi analitik, metadata audit, hold, dan hasil maintenance. |

Penjelasan muncul pada hasil Assessment; tautan Passport ditambahkan pada Item/detail Listing. Transaksi selesai menampilkan kasus koreksi yang sudah ada atau aksi membuka kasus baru. Form memakai label, validasi, state loading/error/empty/unauthorized, dan dialog konfirmasi native. Retry tindakan ketika respons jaringan hilang tersedia di dalam dialog sehingga tetap dapat dijangkau.

## Migrasi dan fixture

Tiga migrasi aditif tahap 5 sudah diterapkan pada database dev dan test:

- `20261002090000_stage5_operations`: sumber valid/version, visibilitas Passport, kasus/grant/hold, rubrik draft/acuan/cache, storage retry, dan maintenance.
- `20261002100000_stage5_evidence`: lampiran privat terpisah, FK/check/indeks, ledger append-only, serta perbaikan check SQL harga final Resell agar NULL tidak lolos.
- `20261002110000_stage5_immutable_rubrics`: larangan UPDATE/DELETE RubricVersion terbit.

```powershell
corepack pnpm db:deploy
corepack pnpm demo:stage5
```

Manifest `.local/stage5-demo-fixtures.json` mencatat rute tanpa password. Fixture mencakup transfer Resell/Donate parsial/Exchange selesai, Repair bersama ringkasan publik, berat diketahui/tidak diketahui, Item Exchange privat, kasus koreksi, laporan, Passport LIMITED, hold, serta draft rubrik dengan tujuh fixture. Password akun seed tetap berada hanya di `.local/demo-credentials.json`.

## Bukti verifikasi

| Pemeriksaan | Hasil |
| --- | --- |
| `corepack pnpm typecheck` | API, contracts, dan web lulus. |
| `corepack pnpm lint` | API/web lulus tanpa warning ESLint. |
| `corepack pnpm build` | Build produksi API/web lulus. |
| `corepack pnpm test` | Enam uji formula dan smoke tahap 1–5 lulus. |
| `corepack pnpm test:e2e` | Empat skenario/proyek lulus: tahap 4 dan tahap 5 pada 1440×900 serta 390×844. |
| Pemeriksaan screenshot | Passport mobile dan kasus koreksi desktop diperiksa; tidak ada horizontal overflow pada rute yang diuji. |
| `corepack pnpm demo:stage5` | Fixture sintetis dan manifest lokal berhasil dibuat. |

Smoke tahap 5 memeriksa proyeksi privat/publik, atribusi kelima metrik/periode, backfill ulang, koreksi idempotent, rollback terinjeksi Assessment/Repair, pembalikan Exchange, guard reservasi/transfer berikutnya, grant/expiry/foto privat, laporan peserta, otorisasi detail audit sengketa, batas template, rubrik immutable/fixture/publikasi, acuan server, kategori nonaktif, retensi 30/90/180/hold/tombstone/retry storage, dan suspend/release.

E2E tahap 5 menjalankan Passport/Impact/penjelasan, dashboard, claim/detail/resolve laporan, claim/grant/bukti foto koreksi, koreksi berat, LIMITED/pemulihan publik, pembalikan kepemilikan dengan respons jaringan sengaja diputus setelah commit, pemulihan dengan kunci sama, aktivasi/nonaktivasi acuan ekonomi, serta navigasi pengguna/rubrik/analitik/audit. Tidak ditemukan browser pageerror pada skenario tersebut. Screenshot ada di `.local/stage5-evidence`; manifest API test di `.local/stage5-test-fixtures.json`.

## Tahap berikutnya

Baseline lokal tahap 5 sudah dapat didemonstrasikan. Tahap 6 memeriksa seluruh matriks penerimaan lintas modul, aksesibilitas lebih luas, race/failure lintas proses, performa, dan kesiapan lingkungan demo. Storage/email/realtime/rate limit lokal masih memakai adapter atau state satu proses; deployment multi-instance, backup/observability, provider eksternal, serta operasi transaksi publik memerlukan pekerjaan dan keputusan tersendiri.
