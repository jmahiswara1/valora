# Rencana teknis dan urutan implementasi

Dokumen ini adalah rencana bertahap untuk karya [INSYFEST 2026](00-competition-context.md). Implementasi tahap 1–6 dicatat pada [tahap 1](15-stage1-implementation.md), [tahap 2](16-stage2-implementation.md), [tahap 3](17-stage3-implementation.md), [tahap 4](18-stage4-implementation.md), [tahap 5](19-stage5-implementation.md), dan [tahap 6](21-stage6-implementation.md). Stack mengikuti arah [PRD](../PRD.md): Next.js/TypeScript, NestJS/TypeScript, PostgreSQL, Prisma, REST/OpenAPI, TanStack Query, React Hook Form/Zod, Tailwind/shadcn-ui, dan Cloudinary untuk deployment nanti. Tahap lokal memakai penyimpanan media lokal dan email lokal. Kontrak auth dan data MVP ada pada [K05](10-mvp-implementation-decisions.md#o08--akun-unggahan-dan-retensi-demo), [model data](11-data-model.md), dan [API](12-api-contract.md). Hosting, transport realtime terdistribusi, serta penyedia AI dipilih saat menyiapkan lingkungan demo; operasi publik tetap O11. Panduan lomba tidak menjadi penghambat.

## Batas sistem

| Bagian | Tanggung jawab |
| --- | --- |
| Web publik | Landing, Market, detail Listing, Passport publik, halaman akun; data publik tidak memuat identitas/riwayat privat. |
| Web pengguna | Item, Assessment, Repair, Listing, Offer, chat, Transaction, Passport, Impact, laporan. Menunjukkan guard dan status, tetapi tidak menjadi satu-satunya lapisan otorisasi. |
| Web admin | Moderasi, sengketa, rubrik, analytics, dan audit. Akses isi chat memerlukan konteks kasus serta alasan. |
| API | Validasi DTO, autentikasi, otorisasi per resource, state machine, idempotensi, dan OpenAPI. Modul mengikuti batas domain PRD. |
| PostgreSQL | Sumber kebenaran owner, status, Assessment berversi, event Passport/Impact, dan audit. Transaksi database menjaga operasi lintas entitas. |
| Media | Foto Item/Listing dengan pembatasan tipe/ukuran, pembersihan metadata yang tidak diperlukan, dan kontrol akses sesuai konteks. |
| AI Explainer | Layanan backend yang hanya menerima snapshot terstruktur, menghasilkan keluaran tervalidasi, dibatasi frekuensinya, dan selalu punya fallback template. |

## Data dan operasi yang perlu dilindungi

- `Assessment.score` nullable untuk `INCOMPLETE` dan `PARTIAL_ECONOMIC`; komponen kosong tidak disamakan dengan nol. Snapshot jawaban, sumber, `ruleVersion`, dan hasil rekomendasi disimpan agar hasil historis dapat dijelaskan.
- Nominal harga, biaya, dan pembanding disimpan sebagai bilangan bulat rupiah, bukan floating point; format `Rp` diterapkan pada presentasi. Lokasi publik berhenti pada kota, sedangkan detail serah terima hanya berada dalam konteks privat yang diizinkan.
- Indeks unik parsial membatasi satu Listing `ACTIVE`/`RESERVED` per Item. Penerimaan Offer dan penyelesaian Transaction memakai transaksi database serta lock/versi baris untuk mencegah dua pemenang.
- `OfferRevision` menyimpan nominal, pengusul, penerima yang harus merespons, timestamp, dan alasan berakhir. Transaction mengambil revisi yang disetujui sebagai harga final.
- `ListingRevision` menyimpan snapshot yang dilihat penawar; Offer merujuk revisi tersebut. Perubahan material mengakhiri Offer atas revisi lama dengan alasan yang tercatat agar tidak dapat diterima setelah isi Listing berubah.
- `HandoverConfirmation` menyimpan pihak, Item, jenis aksi (menyerahkan/menerima), waktu, dan sumber permintaan. Status Transaction dihitung dari konfirmasi yang sah.
- `OwnershipTransfer`, `PassportEvent`, `ImpactEvent`, dan `AdminAction` memiliki kunci sumber yang unik serta tidak dihapus diam-diam. Koreksi membuat catatan/penyesuaian baru.
- Chat mempunyai histori berhalaman melalui API dan SSE metadata perubahan; isi tetap diambil lewat REST. Implementasi lokal memakai event per proses, dengan polling UI sebagai fallback. Transport/pub-sub terdistribusi perlu dipilih bila aplikasi berjalan di beberapa instance.
- Pencarian/filter Market hanya mengembalikan Listing yang boleh dilihat publik. Parameter awal: kata kunci, kategori, tipe, kota, kondisi, rentang harga untuk Resell, dan urutan; detail filter/ranking perlu dikunci pada kontrak API.

## Kontrak API

Tabel ini ringkasan modul. Method, path, DTO, status, otorisasi, dan error terkunci dalam [kontrak API v1](12-api-contract.md); skema logisnya ada pada [model data](11-data-model.md). Dokumen OpenAPI mesin diturunkan dari kontrak ini saat scaffolding tanpa mengubah perilaku yang disepakati.

| Kelompok | Operasi inti |
| --- | --- |
| Auth/User | Daftar, login, logout, profil, status akun, otorisasi peran. |
| Item/Media | Buat/edit Item milik sendiri, unggah/hapus foto, daftar Item, detail Item. |
| Assessment/Repair | Kirim jawaban, baca status dan komponen, riwayat Assessment, catat/koreksi Repair. |
| Market/Listing | Cari Listing publik, detail publik, buat/edit/kirim review, tarik/pause Listing. |
| Offer | Buat/lihat/tarik/tolak Offer, Counteroffer, terima revisi final; penerimaan harus atomik dengan reservasi dan pembuatan Transaction. |
| Chat | Buka Conversation, daftar, histori berhalaman, kirim pesan, unread count, report/block. |
| Transaction | Detail, konfirmasi per pihak/Item, buka sengketa, lihat hasil; setiap aksi mutasi memakai idempotency key. |
| Passport/Impact | Tampilan publik dan owner sesuai field policy; metrik dengan sumber/periode yang jelas. |
| Admin | Review Listing, laporan, sengketa, pengguna, kategori/rubrik, transaksi, analytics, audit. Semua mutasi penting memerlukan alasan. |
| AI | Minta penjelasan Assessment, validasi keluaran, cache, dan fallback template. |

Respons mutasi membedakan `FORBIDDEN`, `STALE_ASSESSMENT`, `ASSESSMENT_INCOMPLETE`, `ACTION_NEEDS_DATA`, `ITEM_RESERVED`, `OFFER_EXPIRED`, `STATE_CONFLICT`, dan kegagalan layanan eksternal sesuai [tabel error](12-api-contract.md#kode-error-dan-http). Pesan UI harus menyatakan apakah aksi berhasil, gagal, atau statusnya belum dapat dipastikan karena jaringan. Retry memakai idempotency key dan pengecekan status.

## Urutan pengerjaan hingga MVP lengkap

| Tahap | Hasil yang harus bisa didemonstrasikan |
| --- | --- |
| 0 — Spesifikasi | **Selesai.** K01–K06, rubrik sembilan kategori/subkategori, kebijakan moderasi, alur, model data, kontrak API, serta skenario penerimaan terdokumentasi. Pencil tetap menjadi referensi komposisi; tidak ada syarat mengedit kanvas. OpenAPI mesin diturunkan dari kontrak API saat scaffolding. O11 untuk operasi publik tetap terpisah. |
| 1 — Fondasi | **Selesai.** Auth/peran, profil, Item, foto, akses publik/privat, kerangka navigasi desktop/mobile. Token `v1` dan perbaikan layout Landing mobile diterapkan langsung dalam kode. |
| 2 — Nilai Item | **Selesai.** Assessment deterministik `INCOMPLETE`/`PARTIAL_ECONOMIC`/`COMPLETE`, empat komponen, rekomendasi, Repair, dan riwayat penilaian sudah diterapkan; state Score yang belum lengkap ditangani di UI. |
| 3 — Pasar | **Selesai.** Market, Listing tiga tipe, moderasi dan review ulang, Offer/Counteroffer tanpa penerimaan formal, chat/unread, laporan, jeda saat Item berubah, dan UI terkait. Detail serta batasnya ada pada [tahap 3](17-stage3-implementation.md). |
| 4 — Kesepakatan | **Selesai.** Penerimaan revisi Offer, reservasi, Transaction, empat konfirmasi Exchange, pembatalan/sengketa, transfer atomik, ledger, pengingat, dan UI peserta/admin. Detail serta batasnya ada pada [tahap 4](18-stage4-implementation.md). |
| 5 — Jejak dan operasi | **Selesai.** Passport publik/owner, lima metrik Impact, koreksi, laporan, dashboard/operasi admin, rubrik/acuan, audit/retensi, dan Explainer template. Integrasi AI eksternal ditunda sesuai keputusan pengguna. Detail ada pada [tahap 5](19-stage5-implementation.md). |
| 6 — Hardening | **Selesai untuk demo lokal MVP.** Auth dan session management diperkuat pada seluruh halaman, termasuk guard rute, sesi kedaluwarsa, logout, cache privat, sinkronisasi antartab, serta pengelolaan sesi aktif. Privasi, akses admin, konkurensi, idempotensi, mobile, aksesibilitas, kegagalan jaringan/realtime/AI/upload, dan alur ujung ke ujung diverifikasi pada UI yang dikodekan. Rincian auth ada pada [rencana tahap 6](20-stage6-auth-session-plan.md) dan [catatan implementasinya](21-stage6-implementation.md). |

Tahap-tahap itu adalah urutan dependensi, bukan pengurangan cakupan MVP. [Matriks penerimaan](13-acceptance-and-demo.md) memberi fixture dan hasil yang harus bisa diulang. Karya lomba siap didemonstrasikan setelah kriteria penerimaan PRD berjalan untuk seluruh jalur; pengoperasian transaksi nyata memiliki keputusan operasional tambahan di O11.

Spesifikasi tahap 0 dan implementasi tahap 1–6 untuk baseline MVP lokal telah selesai; cakupan serta hasil verifikasi dicatat di catatan implementasi masing-masing. Tahap 3 memakai Assessment terkini dan penanda keselamatan dari tahap 2 sebagai gerbang Listing. Bukti hardening dan regresi/browser tahap 6 ada pada [implementasi tahap 6](21-stage6-implementation.md). O11 tetap berlaku sebelum operasi publik.

## Verifikasi paling berisiko

1. Input dan versi aturan yang sama menghasilkan komponen/Score/rekomendasi yang sama; nilai ekonomi kosong tidak berubah menjadi nol. Donate/Exchange parsial berjalan, Resell parsial terblokir dengan alasan yang tepat.
2. Dua Offer untuk satu Item diterima hampir bersamaan: tepat satu berhasil. Item penawar Exchange yang dipakai di dua transaksi juga tidak dapat direservasi ganda.
3. Permintaan penyelesaian berulang menghasilkan satu transfer per Item, satu PassportEvent terkait, dan satu kontribusi Impact; kegagalan di tengah Exchange meninggalkan kedua owner seperti semula.
4. Konfirmasi satu pihak, pembatalan, sengketa, dan putusan admin mengikuti state machine yang disepakati dan meninggalkan audit yang lengkap.
5. User lain tidak dapat membaca Item privat, chat, alamat rinci, biaya Repair privat, atau detail pemilik terdahulu. Admin hanya dapat membuka chat kasus terkait dengan alasan tercatat.
6. AI tidak bisa mengubah Score/status atau menyimpulkan fakta yang hilang; fallback tetap memberi penjelasan saat AI gagal.
7. Pada 390 px dan 1440 px, tugas inti dapat diselesaikan tanpa teks terpotong, horizontal scroll, atau klaim status yang hanya bergantung pada warna.

## Keputusan infrastruktur yang masih terbuka

Kebutuhan hosting untuk demo, batas layanan AI, dan cara juri mengakses karya ditentukan dari kebutuhan demonstrasi Valora; panduan lomba dapat dipakai untuk menyesuaikannya bila diberikan kemudian. Pilihan hosting frontend/backend/database untuk operasi publik, penyimpanan rahasia, email verifikasi/pemulihan, backup, retensi data, dan target latensi ditentukan sebelum platform melayani transaksi nyata. Nilai spesifik belum ditambahkan karena belum ada kebutuhan operasional yang disetujui.
