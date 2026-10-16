# Alur pengguna dan status produk

Dokumen ini merinci [PRD](PRD.md) tanpa mengubah cakupan MVP. Cabang status yang sebelumnya terbuka pada O04 kini mengikuti [K01](10-mvp-implementation-decisions.md#o04--siklus-listing-dan-pembatalan).

## Aktor dan batas akses

| Aktor | Area | Aksi utama |
| --- | --- | --- |
| Guest | Landing, Market, detail Listing, Passport publik yang memenuhi aturan visibilitas | Mencari dan membaca informasi publik. Login diperlukan untuk chat dan Offer. |
| User aktif | Dashboard, Item, Assessment, Repair, Listing, Inbox, Offer, Transaction, Passport, Impact, Report, Profil | Mengelola Item miliknya dan bertransaksi dengan pengguna lain. |
| Admin | Dashboard operasional, moderasi, laporan, sengketa, pengguna, kategori/rubrik, audit | Memutuskan moderasi melalui alasan dan jejak tindakan. Akses chat hanya bila terkait laporan/sengketa dan dicatat. |

UI menyembunyikan aksi yang tidak tersedia, tetapi API selalu memeriksa peran, owner terkini, status akun, dan status entitas. User tidak bisa menawar atau membuka percakapan dengan dirinya sendiri.

## Alur umum dari Item ke tindakan

1. User mendaftar/login, mengisi profil minimum dan kota di Indonesia. Kota adalah lokasi paling rinci yang boleh tampil publik.
2. User membuat Item dan mengunggah foto; Item tetap dapat disimpan sebagai draft.
3. Sistem menilai kelengkapan data dan keselamatan berdasarkan kategori.
4. Assessment `COMPLETE` menghasilkan empat komponen, Score total, label, dan status rekomendasi. `PARTIAL_ECONOMIC` menghasilkan tiga komponen dan rekomendasi yang tidak bergantung pada ekonomi; Score total/label kosong. `INCOMPLETE` menampilkan data yang masih perlu diisi.
5. User mencatat Repair atau mengajukan Listing untuk jenis yang berstatus `ELIGIBLE`. Semua Listing melewati peninjauan admin sebelum `ACTIVE`.
6. Pengunjung melihat Listing `ACTIVE`, lalu User lain dapat membuka chat dan mengirim Offer/permintaan.
7. Penerimaan satu Offer mereservasi Item terkait dan membuat Transaction secara atomik.
8. Para pihak berkoordinasi di chat, melakukan pembayaran bila Resell dan serah terima di luar Valora, kemudian mengonfirmasi tindakan yang benar-benar mereka lakukan.
9. Setelah konfirmasi lengkap, sistem menyelesaikan Transaction, memindahkan owner, menutup Listing, serta menulis Passport dan Impact dalam satu transaksi data.

## Empat jalur

| Jalur | Syarat utama | Kesepakatan formal | Penyelesaian |
| --- | --- | --- | --- |
| Repair | Owner aktif; Item tersimpan. Assessment lengkap tidak wajib untuk mencatat Repair. | RepairRecord berisi tindakan, tanggal, biaya aktual/estimasi, hasil, kondisi setelahnya, dan asal klaim. | Tidak mengubah owner. Perubahan input penilaian membuat Assessment lama tidak lagi terkini; Passport mencatat klaim pemilik. |
| Resell | Assessment `COMPLETE`, `Condition ≥ 50`, `Economic Value ≥ 50`, lolos keselamatan, Listing disetujui admin. | Offer harga atau Counteroffer dengan revisi nominal yang tercatat; penerima revisi menyetujuinya secara eksplisit. | Penjual konfirmasi menyerahkan; pembeli konfirmasi menerima. Harga final adalah snapshot Transaction, bukan bukti pembayaran. |
| Exchange | Kedua Item memiliki Assessment terkini `COMPLETE` atau `PARTIAL_ECONOMIC`, `Reuse Potential ≥ 50`, dan lolos keselamatan. Item penawar tidak berada dalam Listing aktif atau reservasi lain. | Offer memilih tepat satu Item penawar untuk satu Item pada Listing, tanpa tambahan uang. | Kedua pihak masing-masing konfirmasi menyerahkan Item miliknya dan menerima Item lawan. Dua owner bertukar secara atomik. |
| Donate | Assessment terkini `COMPLETE` atau `PARTIAL_ECONOMIC`, `Reuse Potential ≥ 50`, lolos keselamatan. | Pemohon mengirim permintaan; alasan bersifat opsional. Pemberi memilih satu permintaan. | Pemberi konfirmasi menyerahkan; penerima konfirmasi menerima. Tidak ada harga jual atau `Confirmed Sale Value`. |

## Status Assessment dan informasi yang ditampilkan

| Status | Kondisi | Tampilan/aksi |
| --- | --- | --- |
| `INCOMPLETE` | Data wajib non-ekonomi atau pemeriksaan keselamatan belum lengkap. | Daftar pertanyaan yang belum terjawab; tidak ada Listing baru. |
| `PARTIAL_ECONOMIC` | Hanya data `Economic Value` yang kurang; tiga komponen lain dan keselamatan lengkap. | Tampilkan tiga komponen, sumber data, serta “Score total belum tersedia”. Repair, Exchange, dan Donate dapat dinilai; Resell `NEEDS_DATA`. |
| `COMPLETE` | Empat komponen dan keselamatan lengkap. | Tampilkan Score, label, empat komponen, alasan, sumber, versi, dan tindakan yang layak. |

Ketika kategori, fungsi, kerusakan, kelengkapan, atau data material penilaian berubah, Assessment lama tetap historis tetapi tidak boleh dipakai sebagai dasar Listing baru. Listing aktif yang terdampak harus berhenti tampil sebagai penawaran aktif sampai evaluasi dan peninjauan yang diperlukan selesai.

## State machine Listing

| Transisi | Pemicu dan guard | Efek |
| --- | --- | --- |
| `DRAFT → PENDING_REVIEW` | Owner mengirim Listing dengan Assessment terkini dan tipe yang `ELIGIBLE`. | Snapshot Item, Assessment, foto, lokasi umum, dan syarat serah terima dibekukan untuk review. |
| `PENDING_REVIEW → ACTIVE/REJECTED` | Admin memeriksa dan menulis alasan. | Listing terbit atau alasan penolakan dikirim ke owner. |
| `ACTIVE → RESERVED` | Satu Offer diterima dan Transaction dibuat dalam operasi atomik. | Listing tidak dapat menerima kesepakatan lain. |
| `RESERVED → CLOSED` | Transaction selesai. | Listing historis tetap dapat dirujuk dari Passport/Transaction. |
| `RESERVED → ACTIVE/PAUSED/SUSPENDED` | Transaction batal; kedua reservasi dilepas bila Exchange. | Validasi ulang owner, Assessment, revisi, akun, serta moderasi. `ACTIVE` hanya jika semua tetap sah; jika tidak `PAUSED` atau `SUSPENDED`. Offer kedaluwarsa tidak hidup kembali. |
| `ACTIVE → WITHDRAWN/SUSPENDED` | Owner menarik Listing, atau admin menangguhkan dengan alasan. | Listing tidak dapat ditemukan/ditawar; histori dan audit tetap ada. |
| `ACTIVE → PAUSED` | Input material berubah, Assessment tidak lagi berlaku, atau konten publik Listing dikoreksi. | Listing hilang dari Market aktif; Offer revisi lama berakhir. Perubahan material memerlukan Assessment baru; semua revisi menunggu moderasi ulang. |

Paling banyak satu Listing `ACTIVE` atau `RESERVED` untuk satu Item; aturan penguncian juga berlaku pada Item penawar Exchange. Cabang lain ada pada tabel berikut dan [K01](10-mvp-implementation-decisions.md#o04--siklus-listing-dan-pembatalan).

## Siklus perubahan Listing (K01)

Alur `ACTIVE → PAUSED → PENDING_REVIEW → ACTIVE` untuk perubahan material dan berakhirnya Offer revisi lama telah disepakati. Cabang lain ditetapkan sebagai baseline implementasi K01. Setiap Offer merujuk revisi Listing yang dilihat penawar.

| Perubahan | Hasil | Status |
| --- | --- | --- |
| Owner mengubah kategori, fungsi, kerusakan, kelengkapan, atau informasi material lain pada Item dengan Listing `ACTIVE` | Listing menjadi `PAUSED` dan hilang dari Market aktif. Offer revisi lama menjadi `EXPIRED` dengan alasan `LISTING_REVISED`; chat historis tetap dapat dibaca peserta. | Disepakati |
| Owner menyesuaikan Listing `PAUSED` | Buat revisi snapshot Listing, lalu kirim `PAUSED → PENDING_REVIEW`. Perubahan material membutuhkan Assessment baru; koreksi ejaan non-fakta boleh memakai Assessment terkini. Admin menilai informasi baru sebelum `ACTIVE`. | D11/K01 |
| Listing `REJECTED` diperbaiki | Owner membuat revisi baru sebagai `DRAFT`, lalu mengajukan ke `PENDING_REVIEW`; alasan penolakan dan snapshot lama tetap ada. | K01 |
| Owner menarik Listing `ACTIVE` | `WITHDRAWN` terminal. Penawaran berikutnya memakai Listing baru; Offer tertunda berakhir dengan `LISTING_WITHDRAWN`. | K01 |
| Admin menangguhkan Listing | `SUSPENDED` hanya untuk moderasi dengan alasan/audit. Setelah masalah selesai, admin mengirim ke `PENDING_REVIEW` atau menutup; tidak langsung aktif. | K01 |
| Transaction dari Listing `RESERVED` dibatalkan | Kembali `ACTIVE` hanya bila seluruh guard tetap valid; jika tidak, `PAUSED` atau `SUSPENDED`. Kedua reservasi Exchange dilepas atomik. | K01 |

Listing maupun Item yang terkait `RESERVED` tidak dapat diubah secara material atau ditarik sepihak karena para pihak sudah berkoordinasi. Perubahan yang diperlukan diajukan melalui pembatalan bersama atau sengketa sesuai kebijakan Transaction. Detail tampilan Offer yang berakhir karena revisi perlu disampaikan dengan alasan yang jelas kepada penawar.

## Offer, chat, dan Transaction

Offer dimulai `PENDING`. Penawar dapat menariknya; pemilik dapat menolak atau menerima. Pada Resell, Counteroffer adalah revisi nominal dan pihak yang harus merespons harus tercatat; pesan chat tidak pernah menjadi Counteroffer. `ACCEPTED` hanya ditulis bila reservasi dan Transaction berhasil bersama. Offer lain pada Item yang sudah reserved tidak dapat diterima. Tenggat dan tindak lanjutnya ditetapkan pada kebijakan di bawah.

Satu Conversation terikat pada pasangan pengguna dan Listing; histori tetap tersedia untuk peserta saat Listing `RESERVED` dan selama Transaction. Conversation dapat menampilkan konteks Offer/Transaction. Aksi block/report tidak boleh menghapus bukti sengketa. Bila block terjadi pada Transaction aktif, jalur konfirmasi dan pelaporan tetap tersedia tanpa membuka pesan baru.

| Jenis | Data konfirmasi minimum | Syarat `COMPLETED` |
| --- | --- | --- |
| Resell | `sellerHandedOverAt`, `buyerReceivedAt` | Keduanya terisi dan Transaction tidak dalam sengketa. |
| Donate | `donorHandedOverAt`, `recipientReceivedAt` | Keduanya terisi dan Transaction tidak dalam sengketa. |
| Exchange | `partyAHandedOverAt`, `partyAReceivedAt`, `partyBHandedOverAt`, `partyBReceivedAt` | Keempatnya terisi dan Transaction tidak dalam sengketa. |

Status agregat Transaction adalah `AWAITING_HANDOVER`, `ONE_SIDE_CONFIRMED`, lalu `COMPLETED`; sebelum selesai dapat menjadi `CANCELLED` atau `DISPUTED`. `ONE_SIDE_CONFIRMED` pada Exchange berarti ada konfirmasi, tetapi belum keempatnya. Pembatalan, tenggat, dan putusan admin mengikuti kebijakan di bawah. Admin tidak boleh mengganti `currentOwnerId` melalui edit Item biasa.

## Kebijakan tenggat, pembatalan, dan sengketa

Kebijakan berikut telah disepakati untuk MVP. Detail format bukti dan tindakan admin akan diturunkan ke kontrak API serta prosedur operasional.

| Situasi | Perilaku |
| --- | --- |
| Offer baru atau Counteroffer | Berlaku 7 hari sejak dibuat/revisi terakhir. Waktu habis mengubahnya menjadi `EXPIRED`; tidak bisa diterima lagi tanpa Offer baru. |
| Listing menjadi `RESERVED` | Offer lain tidak dapat diterima; masa berlakunya tetap berjalan. Bila Transaction batal dan Listing kembali `ACTIVE`, Offer yang belum kedaluwarsa harus divalidasi ulang sebelum dapat diterima. |
| Transaction diterima | Tampilkan target serah terima 14 hari. Kirim pengingat di aplikasi pada hari ke-7 dan ke-12 kepada kedua pihak. |
| Target serah terima lewat | Tandai `overdueAt` dan masukkan ke antrean tindak lanjut admin. Jangan otomatis mengubah owner, menyelesaikan, atau membatalkan Transaction; barang mungkin sudah dalam perjalanan. |
| Belum ada konfirmasi dan satu pihak ingin batal | Pihak tersebut mengajukan permintaan pembatalan dengan alasan. Bila pihak lain setuju, Transaction menjadi `CANCELLED` dan reservasi dilepas setelah pemeriksaan kelayakan Item. Bila tidak setuju atau tidak merespons, buka sengketa/antrean admin. |
| Sudah ada setidaknya satu konfirmasi | Pembatalan tidak boleh menjadi aksi sepihak instan. Kedua pihak dapat menyetujui pembatalan formal atau salah satu membuka sengketa. Konfirmasi yang salah dikoreksi melalui alur sengketa, bukan dihapus. |
| Sengketa dibuka | Status menjadi `DISPUTED`, penyelesaian otomatis dibekukan, bukti dan alasan tersimpan. Admin hanya mengakses chat yang terkait kasus dan mencatat alasan akses. |
| Putusan admin | Dengan alasan dan bukti yang dirujuk, admin dapat melanjutkan proses konfirmasi, membatalkan serta melepas reservasi, atau menyelesaikan melalui prosedur transfer terotorisasi yang menulis Passport/Impact dan audit secara konsisten. |

Admin harus membedakan “kedua pihak mengonfirmasi” dari “diselesaikan melalui putusan admin” pada jejak Transaction dan Passport. Setelah `COMPLETED`, keluhan baru masuk Report dan koreksi terotorisasi; `currentOwnerId` tidak diedit langsung. Karena pembayaran di luar Valora, keputusan pembatalan atau sengketa tidak boleh menjanjikan pengembalian dana oleh platform.

## Copy yang perlu muncul pada alur transaksi

- Pada Resell sebelum konfirmasi: “Pembayaran dilakukan langsung antar pengguna. Valora tidak memverifikasi pembayaran atau menyediakan pengembalian dana.”
- Pada semua jenis sebelum konfirmasi: “Konfirmasikan hanya setelah Anda benar-benar menyerahkan atau menerima barang.”
- Pada Assessment parsial: “Score total belum tersedia karena perkiraan nilai ekonomi belum diisi. Informasi kondisi dan keselamatan tetap diperiksa untuk Exchange/Donate.”
- Pada chat: “Kesepakatan harga dan transaksi hanya berlaku setelah dikonfirmasi melalui Offer dan Transaction.”

Copy final perlu diuji pada layar 390 px. Pesan kegagalan jaringan tidak boleh menyiratkan bahwa konfirmasi atau transfer telah berhasil bila status server belum diketahui.

## Penegasan implementasi tahap 4

Penerima pada `OfferRevision.respondsById` menerima revisi final dan langsung membuat Transaction, termasuk Counteroffer. Permintaan pembatalan yang masih menunggu tetap mengizinkan konfirmasi; jika serah terima selesai lebih dahulu, permintaan ditutup dengan `TRANSACTION_COMPLETED`. Sengketa menahan konfirmasi. Bukti privat berupa catatan, pesan terkait, dan foto, dengan penugasan serta akses admin beralasan. Rincian aktual ada pada [tahap 4](18-stage4-implementation.md).
