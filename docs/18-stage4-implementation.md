# Implementasi tahap 4 — Kesepakatan dan transfer

**Status:** implementasi tahap 4 tersedia pada 1 Oktober 2026. Penerimaan Offer, reservasi, serah terima Resell/Donate/Exchange, pembatalan bersama, sengketa, putusan admin, serta pencatatan transfer telah diterapkan. Tahap 5 melengkapi tampilan Passport/Impact, koreksi ledger, operasi admin menyeluruh, dan AI Explainer.

## Perilaku yang berjalan

- Pihak pada `OfferRevision.respondsById` menerima revisi terkini. Penerimaan Counteroffer langsung membuat Transaction; tidak ada penerimaan kedua oleh pemilik Listing.
- Penerimaan memvalidasi versi, tenggat, akun aktif terverifikasi, block, owner, Assessment/rubrik terkini, keselamatan, foto, dan Item penukar. Snapshot Exchange disimpan saat Offer dibuat. Foto bukti kasus tidak termasuk galeri Item atau snapshot kesepakatan.
- Item, kedua Item Exchange, Listing, Offer yang dipilih, dan Transaction berubah dalam satu transaksi database. Offer lain tetap terbuka sampai kedaluwarsa atau transfer selesai, tetapi tidak dapat diterima selama reservasi.
- Resell/Donate memerlukan dua konfirmasi. Exchange memerlukan empat pasangan aktor–Item–tindakan. Konfirmasi terakhir memindahkan owner, menutup Listing, melepas reservasi, menulis OwnershipTransfer, PassportEvent, dan ImpactEvent dalam satu commit.
- Harga Resell berasal dari revisi Offer final. Nilai jual tidak dicatat untuk Exchange/Donate. Berat yang tidak diketahui tidak menjadi nol. Kontribusi berat berasal dari snapshot per Item; jumlah transaksi dicatat sekali pada tingkat platform dan masing-masing peserta.
- Mutasi kritis memerlukan UUID `Idempotency-Key`. Hash payload dan hasil tersimpan bersama perubahan domain. Payload berbeda dengan kunci sama ditolak. Transaksi memakai isolasi Serializable, penguncian baris terurut, versi optimistis, serta retry terbatas untuk konflik database.
- Permintaan batal membutuhkan respons pihak lain. **Konfirmasi tetap tersedia selama pembatalan menunggu.** Bila serah terima selesai lebih dahulu, permintaan batal ditutup dengan `TRANSACTION_COMPLETED`. Pembatalan melepas reservasi tanpa menghapus konfirmasi; Listing kembali aktif hanya jika masih memenuhi syarat.
- Sengketa membekukan konfirmasi dan penyelesaian otomatis. Bukti dapat berupa catatan, pesan dari percakapan terkait, dan maksimal empat foto JPEG/PNG/WebP berukuran maksimal 8 MiB per foto. Foto diproses tanpa metadata lokasi dan tetap privat.
- Admin mengambil penugasan secara atomik. Bukti dan chat membutuhkan alasan akses yang diaudit; grant berlaku lima menit. Admin lain dan pengguna di luar transaksi tidak dapat membacanya. Putusan memerlukan alasan dan rujukan bukti: lanjut konfirmasi, batal, atau transfer dengan asal `ADMIN_AUTHORIZED`.
- Target serah terima 14 hari. Job membuat pengingat hari 7/12 sekali untuk kedua peserta dan menandai overdue. Admin dapat membuka kasus tindak lanjut; lewat waktu tidak mengubah owner atau membatalkan transaksi otomatis.
- Penutupan akun segera menonaktifkan akun dan mencabut sesi. Transaksi aktif masuk kasus atau mendapat catatan pada kasus yang sudah terbuka. Purge akun melewati transaksi aktif, kasus terbuka, dan penahanan retensi; Item yang sudah ditransfer tidak diarsipkan oleh purge owner lama.

## Privasi setelah transfer

Input tahun/harga pembelian disimpan dalam snapshot privat untuk audit dan dibersihkan dari Item owner baru. Jawaban Assessment dan sumber ekonomi owner lama tidak dibuka kepada owner baru; Assessment lama menjadi historis. Biaya Repair, identitas pencatat, catatan, dan bukti privat mengikuti proyeksi tahap 2. Foto kesepakatan dibagikan kepada owner berikutnya; foto privat lain tetap mengikuti izin eksplisitnya. Payload Passport transfer tidak membawa nama peserta, harga, biaya, chat, atau bukti kasus.

## Route UI

| Tujuan | Route |
| --- | --- |
| Daftar dan detail kesepakatan | `/app/transaksi`, `/app/transaksi/[id]` |
| Antrean kasus dan transaksi overdue | `/app/admin/sengketa` |
| Penugasan, akses beralasan, dan putusan | `/app/admin/sengketa/[id]` |

Offer dan percakapan menautkan Transaction. Ringkasan akun menampilkan pengingat. Detail Item menjelaskan reservasi dan menautkan transaksi. Dialog kritis memakai checkbox persetujuan, fokus keyboard, serta identitas barang/tindakan. Permintaan yang hasilnya belum pasti disimpan di sessionStorage per akun; retry mengirim payload/kunci yang sama, termasuk setelah reload halaman.

## Database dan API

Migrasi `20261001110000_stage4_transactions` menambah Transaction, konfirmasi, pembatalan, kasus/bukti/grant, transfer, event Passport/Impact, idempotensi, serta notifikasi. Kendala parsial memastikan maksimal satu pembatalan menunggu dan satu kasus terbuka per Transaction. Offer Exchange lama tanpa snapshot diakhiri dengan `EXCHANGE_SNAPSHOT_REQUIRED`; histori tetap tersedia.

OpenAPI lokal versi 1.4 tersedia di `/api/docs` dan `/api/docs-json`. Kontrak runtime ada pada `packages/contracts`; semua endpoint tahap 4 terdaftar pada `apps/api/src/openapi-stage4.ts`. Detail request mengacu pada [kontrak API](12-api-contract.md).

## Verifikasi yang dapat diulang

Hasil pada 1 Oktober 2026: typecheck, lint, build produksi, enam uji rumus, smoke API tahap 1–4, dan dua uji Playwright desktop/mobile lulus. Migrasi diterapkan pada database pengembangan dan test. Fixture demo tiga jalur telah dibuat; API lokal melaporkan OpenAPI 1.4 dan route transaksi web merespons berhasil.

```powershell
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm build
corepack pnpm test
corepack pnpm test:e2e
```

- Enam uji rumus dan smoke tahap 1–4 memakai `valora_test`; database pengembangan tidak dipakai untuk pengujian.
- Smoke tahap 4 menguji tiga jalur, Donate parsial, Counteroffer, penerimaan bersamaan, Item penukar bersaing, kegagalan di tengah Exchange melalui trigger uji, rollback, idempotensi/payload konflik, versi dan tenggat, persaingan pembatalan–konfirmasi terakhir, privasi owner/Repair/bukti, tiga putusan admin, grant kedaluwarsa, pengingat, overdue, serta akun ditutup saat reservasi aktif.
- Playwright menjalankan alur peserta dan admin pada 1440×900 dan 390×844. Uji mencakup empat konfirmasi Exchange, respons jaringan sengaja diputus setelah commit, pemulihan setelah reload, catatan/pesan/foto bukti, penugasan, akses bukti/chat, dan putusan batal. Dialog/fokus, overflow horizontal, serta error JavaScript diperiksa.
- Tangkapan layar tersedia lokal sebagai `.local/stage4-exchange-{desktop,mobile}.png`, `stage4-evidence-{desktop,mobile}.png`, dan `stage4-admin-{desktop,mobile}.png`.

Playwright memerlukan Chrome lokal. Runner memakai API port 4001 dan web port 3002, database test, serta direktori build `.next-e2e`; port tersebut harus bebas. Jalankan pengujian API dan E2E secara bergantian.

## Fixture demo lokal

```powershell
corepack pnpm db:seed
corepack pnpm demo:stage4
corepack pnpm dev
```

`demo:stage4` membuat data sintetis baru pada database lokal yang dikonfigurasi: Resell menunggu serah terima, Donate parsial dengan satu konfirmasi, dan Exchange menunggu empat konfirmasi. Rute tersimpan pada `.local/stage4-demo-fixtures.json`; akun peserta/admin memakai kredensial seed lokal. Setiap pengulangan membuat salinan fixture baru sehingga ledger historis tidak ditulis ulang. Runner demo memakai API sementara port 4003 lalu menghentikannya.

## Pekerjaan tahap berikutnya

Ledger transfer sudah tersedia; tampilan Passport publik/owner, agregasi Impact, pembatasan proyeksi historis, koreksi ledger terotorisasi, dan AI Explainer masuk tahap 5. Penjadwalan penghapusan chat/lampiran setelah masa retensi 90/180 hari, pengelolaan hold beralasan melalui UI admin, serta audit job retensi lengkap juga memerlukan penyelesaian pada operasi tahap 5; tahap 4 sudah melindungi data kasus/transaksi aktif dari purge akun. Tahap 6 memeriksa seluruh MVP. Pengoperasian publik tetap mengikuti keputusan O11.
