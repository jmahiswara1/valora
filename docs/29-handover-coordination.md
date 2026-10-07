# Koordinasi serah terima

Perluasan setelah MVP · PRD 1.24 · OpenAPI 1.14.0.

## Perilaku peserta

Panel pada `/app/transaksi/[id]` menyediakan jadwal dan detail privat untuk Resell, Donate, dan Exchange. Koordinasi bersifat opsional; transaksi lama tetap dapat dikonfirmasi tanpa mengisi jadwal.

- Tenggat tetap 14 hari sejak penawaran diterima. Pilih waktu mendatang yang tidak melewati `targetHandoverAt`.
- Pertemuan memakai lokasi dan waktu; pengiriman memakai perkiraan waktu diterima. Waktu disimpan UTC dengan zona tampilan WIB, WITA atau WIT.
- Metode harus tersedia dalam snapshot transaksi. Satu usulan menunggu per transaksi; hanya pihak lain boleh menyetujui atau menolak. Pengusul dapat menarik usulannya.
- Usulan tidak diedit. Buat usulan baru untuk perubahan; kesepakatan sebelumnya tetap berlaku sampai pengganti disetujui. Usulan yang ditolak, ditarik, kedaluwarsa atau ditutup tetap tercatat.
- Pada pengiriman, setiap penerima mengisi nama, telepon dan alamatnya sendiri. Exchange memakai satu jadwal dan metode, dengan alamat serta resi terpisah per arah barang.
- Konfirmasi formal pertama mengunci metode, jadwal dan alamat. Usulan menunggu ditutup saat konfirmasi pertama, permintaan pembatalan, sengketa atau penutupan transaksi.
- Pengirim boleh mencatat kurir dan resi pada kesepakatan pengiriman yang berlaku, termasuk setelah konfirmasi penyerahan, sampai penerimaan barang tersebut dikonfirmasi. Perbaikan wajib beralasan dan menambah revisi.
- Sengketa, transaksi ditutup, pembatalan menunggu, akun tidak aktif atau email belum diverifikasi menghalangi perubahan sesuai izin endpoint.
- Resi tidak memantau kurir, mengonfirmasi pembayaran, menyelesaikan transaksi atau memindahkan kepemilikan.

## Penyimpanan dan konkurensi

Migrasi `20261009010000_handover_coordination` menambah `HandoverProposal`, `ShipmentRecord`, `HandoverEvent` dan pointer `Transaction.agreedHandoverId`. Migrasi aditif tidak membuat jadwal atau aktivitas koordinasi rekaan pada data lama. Partial unique index membatasi satu usulan `PENDING` per transaksi; usulan lama tetap `APPROVED` sebagai riwayat setelah pointer aktif berganti.

Mutasi memakai `expectedVersion`, `Idempotency-Key`, gate transaksi dan penguncian transaksi/barang yang sudah dipakai domain. Status/izin sesi diperiksa lagi setelah gate. Hasil idempotensi hanya metadata ID, versi dan status; alamat/resi tidak dimasukkan ke respons pemulihan. Formulir mempertahankan draft dalam memori saat respons belum pasti dan meminta pemeriksaan status sebelum mutasi lain. Pergantian sesi membatalkan permintaan serta menghapus cache privat melalui mekanisme aplikasi yang berlaku.

Linimasa menggabungkan event koordinasi dengan data formal yang sudah tersimpan: penerimaan penawaran, konfirmasi, permintaan pembatalan, sengketa, penyelesaian dan koreksi. Urutan waktu/ID turun dan cursor terikat transaksi; default 20, maksimum 50. Data lama muncul dari catatan asli, tanpa backfill event palsu. Riwayat resi serta riwayat privat admin juga memakai halaman terbatas. UI mempertahankan halaman yang sudah dimuat ketika pemuatan halaman berikutnya gagal dan menyediakan retry pada halaman yang gagal. Penolakan akses dan grant kedaluwarsa tetap menyembunyikan data privat.

## Privasi dan retensi

Peserta membaca hanya transaksi miliknya. Admin tidak mendapat akses melalui endpoint peserta atau konteks transaksi umum. Endpoint privat admin memerlukan penugasan kasus, alasan akses, grant `HANDOVER` lima menit dan audit `ACCESS_HANDOVER`. Semua pembacaan memeriksa grant/penugasan kembali. UI menghapus cache saat grant berakhir atau server mencabut akses.

Lokasi, catatan, alasan tanggapan, nama penerima, nomor telepon, alamat, kurir, resi serta alasan revisi tersimpan sebagai data privat. Detail tersebut dihapus pada seluruh usulan dan revisi setelah 180 hari sejak transaksi/kasus terkait terakhir ditutup. Kasus aktif dan retention hold menunda penghapusan. ID, metode, jadwal, status, waktu dan metadata linimasa tetap tersedia. Data privat tidak muncul di notifikasi, Passport, Impact atau halaman Market publik. Setelah penghapusan, panel tetap menunjukkan metadata revisi pengiriman beserta status retensinya. Pemrosesan akun ditutup menelusuri halaman berukuran 25 dengan cursor ID; akun yang tertahan kasus/hold tidak menghalangi akun lain yang sudah memenuhi syarat.

## Worker dan notifikasi

Worker `handover-coordination` berjalan saat startup dan setiap menit dengan dedicated advisory lock. Hasil disimpan sebagai `MaintenanceRun` berjenis `HANDOVER_COORDINATION`, berisi jumlah usulan kedaluwarsa dan notifikasi koordinasi baru (hitungan ini tidak mencakup pengingat fallback hari ke-7/12); kegagalan menyimpan tipe error tanpa data privat.

Usulan kedaluwarsa ketika waktu usulan terlewati. Pengingat jadwal dikirim 24 jam dan 2 jam sebelum waktu yang disepakati hanya kepada peserta yang belum menyelesaikan konfirmasi wajib. Ambang sebelum persetujuan dilewati. Setelah downtime, hanya ambang terbaru yang masih relevan dikirim; kunci event mencegah duplikasi. Jadwal lama yang terganti, transaksi sengketa/ditutup dan waktu yang lewat dilewati. Transaksi tanpa jadwal disepakati mempertahankan pengingat hari ke-7/12. Target 14 hari tetap menghasilkan flag overdue untuk admin, tanpa menutup transaksi otomatis.

Notifikasi usulan, persetujuan, penolakan, penarikan, kedaluwarsa dan pembaruan resi masuk kategori transaksi. Payload hanya identitas transaksi/usulan, judul barang dan ambang pengingat; tidak berisi lokasi, alamat, telepon atau resi.

## Endpoint

Semua path berikut memakai prefix `/api/v1` dan sesi; mutasi juga memerlukan CSRF serta `Idempotency-Key`.

| Metode | Path | Hasil |
| --- | --- | --- |
| GET | `/transactions/{id}/handover` | Kesepakatan, usulan menunggu, arah pengiriman dan izin saat ini |
| POST | `/transactions/{id}/handover/proposals` | Ajukan usulan immutable |
| GET | `/transactions/{id}/handover/proposals/{proposalId}` | Detail riwayat privat peserta |
| POST | `/transactions/{id}/handover/proposals/{proposalId}/respond` | Setuju atau tolak dengan alasan |
| POST | `/transactions/{id}/handover/proposals/{proposalId}/withdraw` | Tarik usulan sendiri |
| GET | `/transactions/{id}/handover/proposals/{proposalId}/shipments` | Revisi resi dengan cursor |
| POST | `/transactions/{id}/handover/shipments/{itemId}` | Catat atau perbaiki resi barang sendiri |
| GET | `/transactions/{id}/timeline` | Aktivitas gabungan dengan cursor |
| POST | `/admin/cases/{id}/handover-access` | Grant privat lima menit dengan alasan/audit |
| GET | `/admin/cases/{id}/handover` | Kesepakatan dan riwayat privat paginasi bagi admin kasus |

Read memakai polling 15 detik selama halaman terlihat. Endpoint admin menerima `cursor`, `shipmentCursor`, `limit`; cursor terikat riwayat transaksi kasus. Endpoint lain yang berpaginasi memakai `cursor`, `limit`.

## Verifikasi

- API: `apps/api/scripts/smoke/handover.mjs`, masuk dalam `pnpm test`; fixture dan mutasi nyata menggunakan database `_test`.
- Browser mock: `handover.spec.mjs`, termasuk zona waktu, persetujuan/alamat, resi, respons hilang, lock, retry, tampilan 1440/390/320px.
- Browser API nyata: `handover-live.spec.mjs`, kedua peserta menyepakati pengiriman, mencatat resi dan menyelesaikan konfirmasi formal.
- Perintah regresi: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm test:e2e`.

### Hasil pelaksanaan

- `pnpm test`: lulus, mencakup 6 tes engine dan seluruh 12 suite smoke API, termasuk koordinasi serah terima. Migrasi aditif sudah diterapkan pada database lokal dan database uji.
- Regresi browser lengkap: 180 tes desktop/mobile lulus dengan build produksi, termasuk alur dua peserta melalui API nyata. Setelah perbaikan pagination dan penyesuaian teknis Select, 20 tes UI terfokus lulus kembali; jumlah ini merupakan rerun dan tambahan kasus, bukan 200 kasus unik.
- `pnpm lint`, `pnpm typecheck` dan `pnpm build`: lulus. Include TypeScript untuk direktori build uji sementara sudah dihapus.
- Capture panel/dialog diverifikasi pada desktop, mobile dan 320px. Review awal Impeccable menemukan satu perbaikan retensi riwayat pada kegagalan pagination; verdict berikutnya `ship` menilai perbaikan tersebut selesai. Verdict visual tidak mencakup enforcement backend, yang diperiksa melalui suite API.

Bukti lokal berada di `.local/handover-api-final.log`, `.local/handover-browser-regression.log`, `.local/handover-final-ui.log`, `.local/handover-final-lint.log`, `.local/handover-final-typecheck.log` dan `.local/handover-final-build.log`. Log dan capture raster diabaikan Git. [Review UI](../apps/web/.impeccable/review/handover/finish-review.md) mencatat batas verdict; [brief](../apps/web/.impeccable/briefs/handover.md) memuat aturan permukaan.

Integrasi kurir, peta, buku alamat, pembayaran, escrow, email/push dan perpanjangan tenggat tidak termasuk fitur ini.
