# Exchange lanjutan

Perluasan setelah MVP · PRD 1.27 · OpenAPI 1.17.0.

## Alur pengguna

1. Pada detail Market, penawar memilih **1–3 barang miliknya** yang memenuhi syarat Exchange. Barang utama pemilik tetap menjadi satu barang pada Listing; inventaris privat pemilik tidak dibuka kepada penawar.
2. Tambahan uang bersifat opsional. Satu nominal rupiah positif diberikan oleh **pemilik Listing atau penawar**, sesuai kesepakatan. Tidak ada pembayaran melalui Valora.
3. Pemilik dapat menambah barang miliknya melalui counteroffer. Kedua pihak bergantian merespons; masing-masing hanya dapat mengganti paket barangnya sendiri dan tambahan uang. Barang utama Listing selalu disertakan, berada pertama dalam paket pemilik, dan tidak dapat dilepas.
4. Detail penawaran menampilkan dua paket barang, arah tambahan uang, pesan, tenggat dan riwayat revisi. Riwayat menyimpan isi setiap revisi, termasuk barang yang ditambahkan/dilepas dan perubahan tambahan uang.
5. Dialog penerimaan membekukan revisi yang sedang ditinjau. Pengguna meninjau seluruh barang dan tambahan uang, lalu mencentang persetujuan. Backend memeriksa ulang revisi dan seluruh barang sebelum mereservasi semuanya secara atomik.
6. Setiap barang memerlukan laporan **penyerahan oleh pemilik asal** dan **penerimaan oleh pemilik tujuan**. Bila ada tambahan uang, pemberi melaporkan `SENT` dan penerima melaporkan `RECEIVED`. Dua laporan uang dan seluruh laporan barang harus lengkap sebelum penyelesaian biasa memindahkan seluruh kepemilikan.

Maksimum enam barang per transaksi. Nominal tambahan merupakan kesepakatan, bukan estimasi harga barang. Konfirmasi uang adalah `USER_REPORTED`: Valora tidak memeriksa transfer bank, menyediakan escrow, atau melakukan pengembalian dana. Pembatalan menjelaskan bahwa pengembalian uang diatur langsung oleh para pihak.

## Kelayakan dan perubahan barang

- Kedua akun aktif, terverifikasi, dan tidak saling memblokir. Barang harus milik pihak yang menawarkannya, tidak diarsipkan/direservasi, mempunyai foto yang boleh dibagikan dalam kesepakatan, serta Assessment terkini yang layak untuk Exchange.
- Barang tambahan tidak boleh mempunyai Listing `ACTIVE`/`RESERVED`. Pengguna perlu menarik Listing aktifnya terlebih dahulu. Barang utama boleh tetap menggunakan Listing yang sedang ditanggapi.
- Picker hanya mengembalikan inventaris pengguna yang meminta. Barang tidak layak tetap ditampilkan beserta alasan; pilihan dibatasi tiga, dengan pagination, retry dan keadaan kosong.
- Snapshot membekukan judul, deskripsi, kondisi, Assessment, revisi barang, foto, berat yang dilaporkan, dan arah perpindahan. Counteroffer membekukan paket pihak lain dari revisi sebelumnya.
- Penerimaan memeriksa versi Offer, revisi Offer/Listing, hash kesepakatan, ownership, reservasi, Assessment, rubrik dan foto seluruh barang. Perubahan membuat penerimaan gagal tanpa reservasi sebagian.
- Jalur yang mengakhiri Offer akibat perubahan material, penghapusan foto, pergantian pemilik, kebijakan atau moderasi memakai keanggotaan **revisi aktif**. Barang yang hanya ada pada revisi historis tidak ikut mengakhiri kesepakatan terbaru.

## Kontrak API

Semua endpoint berikut memerlukan sesi. Mutasi memakai CSRF. Endpoint penerimaan/konfirmasi memakai `Idempotency-Key`; counteroffer Exchange memakai `clientRequestId` dalam body.

| Endpoint | Fungsi |
| --- | --- |
| `GET /api/v1/listings/{listingId}/exchange-candidates` | Kandidat privat milik pengguna; `limit`/`cursor` mengikuti pagination Item |
| `POST /api/v1/listings/{listingId}/offers` | Membuat Offer dengan `exchangeItemIds` 1–3 UUID unik, `cashAdjustment` opsional/null, dan `clientRequestId` |
| `POST /api/v1/offers/{id}/counter` | `expectedVersion`, paket milik pengirim, `cashAdjustment` eksplisit/null, `clientRequestId`, pesan opsional |
| `GET /api/v1/offers/{id}/revisions` | Riwayat privat peserta, `limit` 1–50 dan `cursor` |
| `POST /api/v1/offers/{id}/accept` | Versi, dua ID revisi, dan `exchangeTermsHash` untuk kesepakatan lanjutan |
| `POST /api/v1/transactions/{id}/cash-confirmations` | `expectedVersion` dan `kind: SENT / RECEIVED`, hanya peran yang sesuai |

Contoh tambahan uang:

```json
{ "cashAdjustment": { "amountIdr": 150000, "payer": "BIDDER" } }
```

`amountIdr` berupa bilangan bulat Rp1–Rp1.000.000.000.000; `payer` adalah peran pada Listing asal, tidak berubah ketika pihak penerima counteroffer berganti. `null` berarti tidak ada tambahan uang.

`OfferRevisionDto.exchangeTerms` berisi `ownerItems`, `bidderItems` dan `cashAdjustment`; `termsHash` merupakan SHA-256 dari JSON kanonis. Hash ini mengikat persetujuan pada kesepakatan yang ditinjau, bukan bukti pembayaran. Klien baru selalu mengirim hash. Klien lama tanpa hash hanya dapat menerima pertukaran satu lawan satu tanpa tambahan uang.

`TransactionDto.snapshot.items` berisi semua barang; `snapshot.cashAdjustment` berisi tambahan yang disepakati atau null. `cashConfirmations` berisi actor, jenis, waktu dan `source: USER_REPORTED`. Field lama `exchangeItemId`, `exchangeSnapshot`, `itemId` dan `offeredItemId` tetap tersedia untuk kompatibilitas; field scalar bukan daftar lengkap barang.

## Penyelesaian, pembatalan dan sengketa

- Konfirmasi uang dapat dilakukan sebelum laporan barang; tidak menutup koordinasi serah terima. Laporan barang pertama tetap menutup koordinasi sesuai aturan sebelumnya.
- Lengkapnya laporan barang saja atau uang saja tidak menyelesaikan Exchange dengan tambahan uang. Semua ownership, reservasi, Passport dan Impact berubah dalam transaksi database yang sama.
- Pembatalan yang disetujui melepas seluruh reservasi tanpa perpindahan ownership. Laporan uang yang telah tercatat tetap merupakan riwayat, bukan transaksi refund.
- `DISPUTED` menahan konfirmasi barang/uang. Melanjutkan sengketa tidak melewati syarat penyelesaian biasa.
- Putusan sah `ADMIN_AUTHORIZED` mengikuti jalur admin yang sudah diaudit. Putusan dapat menyelesaikan transaksi tanpa laporan peserta lengkap, tetapi **tidak membuat laporan uang palsu** dan tidak menjadi bukti pembayaran.
- Passport mendapat satu event per barang. Jumlah transaksi dihitung sekali, berat berdasarkan barang yang berpindah. Tambahan uang Exchange tidak ditambahkan ke metrik nilai penjualan Resell.
- Foto paket/riwayat hanya dapat diakses peserta sesuai snapshot; metadata admin mengikuti penugasan/izin yang berlaku. Kesepakatan dan laporan uang tetap privat, tidak masuk Passport publik atau chat otomatis.

## Migrasi dan kompatibilitas

Migrasi tambahan `20261014010000_advanced_exchange` menambahkan:

- Pointer `Offer.currentRevisionId`, snapshot Exchange pada `OfferRevision`, serta ID/hash permintaan counteroffer.
- `OfferRevisionItem` untuk keanggotaan barang per revisi dan `TransactionItem` untuk seluruh barang transaksi.
- `CashConfirmation` dengan satu laporan `SENT` dan satu `RECEIVED` per transaksi.

Backfill mengambil snapshot Listing/Offer historis untuk Exchange satu lawan satu tanpa uang dan seluruh `snapshot.items` untuk keanggotaan transaksi lama. Berat pemilik yang tidak ada pada snapshot historis tetap null, bukan diambil dari kondisi barang saat ini. Tidak ada reset atau seed ulang. Jalankan `pnpm db:deploy` pada database tujuan sebelum menjalankan API baru; client Prisma perlu diregenerasi melalui build.

Migrasi telah diterapkan pada database pengembangan lokal. Database lain, termasuk database test, perlu menjalankan migrasi ini sendiri.

## Pemeriksaan implementasi

Build contracts/API/web, typecheck web dan lint API/web menjadi pemeriksaan kompilasi. Tidak ada penambahan atau eksekusi suite tes otomatis pada sesi ini.

Peninjauan manual menggunakan enam barang berlabel **Demo Exchange**, foto editorial yang sudah tersedia dan akun demo, melalui API lokal dan browser:

- Paket tiga barang per pihak, counteroffer dan replay `clientRequestId` menghasilkan dua revisi tanpa duplikasi.
- Penerimaan paket lanjutan tanpa hash ditolak; dengan hash menghasilkan enam reservasi dan dua belas kewajiban laporan barang.
- Konfirmasi uang oleh peran yang salah ditolak. Dua belas laporan barang lengkap tetap menunggu uang; satu laporan uang masih menunggu; laporan kedua menyelesaikan transfer keenam barang.
- Arah uang dari pemilik, pembatalan setelah satu laporan uang, pelepasan seluruh reservasi dan preservasi laporan historis ditinjau pada paket dua barang per pihak.
- Empat counteroffer bergantian mempertahankan paket pihak lain. Perubahan material barang yang sudah dilepas dari revisi aktif mempertahankan Offer; perubahan barang yang masih disertakan mengakhirinya. Input lama `exchangeItemId` dan penerimaan tanpa hash tetap bekerja untuk satu lawan satu tanpa uang.
- Akun di luar dua peserta tidak dapat membaca foto paket, detail penawaran atau riwayat revisi. Endpoint baru tersedia pada OpenAPI 1.17.0.
- Passport publik keenam barang tetap dapat diakses setelah perpindahan, termasuk barang tambahan, dan masing-masing memuat satu event Exchange.
- Tampilan kesepakatan 1440/390/320px, formulir Market, counteroffer, riwayat, dialog persetujuan/uang, batas tiga pilihan dan alasan ketidaklayakan diperiksa. Dialog menggunakan scroll internal dan tombol konfirmasi nonaktif sebelum persetujuan.

Rute demo lokal tersimpan pada `.local/advanced-exchange-demo.json` yang diabaikan Git. Data merupakan simulasi; tidak ada uang nyata yang diproses.
