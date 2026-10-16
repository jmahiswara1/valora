# Keputusan produk dan rincian implementasi

**Acuan:** [PRD v1.14](PRD.md), diskusi 27–29 September 2026. D01–D20 dan D22 berasal dari keputusan pengguna; rincian K01–K06 di bawah adalah baseline spesifikasi yang diturunkan pada 28 September 2026 untuk melengkapi docs sebelum kode.

## Keputusan yang disepakati

| ID | Keputusan | Konsekuensi |
| --- | --- | --- |
| D01 | Repair, Resell, Exchange, dan Donate semuanya masuk MVP. | Urutan pengerjaan boleh bertahap; semua alur harus selesai sebelum MVP dinyatakan lengkap. |
| D02 | Chat masuk MVP, tetapi persetujuan formal hanya melalui Offer dan Transaction. | Pesan tidak pernah mengubah harga, status, atau ownership. |
| D03 | AI hanya menjelaskan hasil mesin aturan dan mempunyai fallback template. | Score, kelayakan, harga, dan ownership tidak berasal dari AI. |
| D04 | Donate dan Exchange boleh menggunakan Assessment `PARTIAL_ECONOMIC` jika hanya nilai ekonomi yang belum lengkap dan data lain serta keselamatan sudah lengkap. | Tidak ada Score total/label rekaan. Resell tetap membutuhkan Assessment `COMPLETE`. |
| D05 | Pembayaran dan pengiriman/serah terima diatur langsung oleh para pihak pada MVP. Integrasi pembayaran dan pengiriman dilakukan setelah MVP. | Valora menyimpan harga kesepakatan, koordinasi, konfirmasi pengguna, dan sengketa; tidak menyediakan checkout, escrow, resi otomatis, atau verifikasi pembayaran. |
| D06 | Ownership berubah hanya setelah Transaction selesai. Exchange memindahkan dua Item dalam satu transaksi atomik. | Dua konfirmasi pihak diperlukan; pengulangan permintaan tidak boleh menghasilkan transfer atau Impact ganda. |
| D07 | Passport berlanjut lintas pemilik; Impact hanya memakai peristiwa yang definisinya jelas. | Klaim kondisi dan dampak harus menyebut sumber serta batas datanya. |
| D08 | Pasar sasaran awal Indonesia, nominal dalam rupiah, dan lokasi publik paling rinci setingkat kota. | Form, pencarian, harga, dan copy memakai konteks Indonesia; alamat rinci tetap privat. |
| D09 | Offer berlaku 7 hari sejak dibuat atau Counteroffer terakhir. Transaction memiliki target serah terima 14 hari, dengan pengingat dalam aplikasi pada hari ke-7 dan ke-12. | Offer kedaluwarsa tidak dapat diterima; Transaction yang melewati target masuk tindak lanjut admin tanpa pembatalan atau transfer otomatis. |
| D10 | Pembatalan memerlukan persetujuan kedua pihak, atau penyelesaian sengketa oleh admin dengan alasan dan audit. | Konfirmasi yang sudah ada tidak dihapus. Sengketa membekukan penyelesaian otomatis; hasil admin melalui prosedur transfer yang sah. |
| D11 | Perubahan material pada Listing `ACTIVE` membuatnya `PAUSED`, mengakhiri Offer pada revisi lama, lalu mewajibkan Assessment dan moderasi ulang sebelum aktif lagi. | Penawar tidak terikat pada informasi barang yang telah berubah; histori Offer tetap terlacak. |
| D12 | `Items Revalued` dihitung sekali per Item di platform dan diberikan kepada pengguna yang pertama menyelesaikan Assessment. Berat transfer pengguna diberikan kepada pihak yang menyerahkan Item. | Reassessment owner baru tidak menaikkan hitungan; total platform tidak menjumlahkan ringkasan tiap pengguna. |
| D13 | Barang Hobi pada MVP dimulai dari alat musik, permainan papan, dan peralatan seni/kerajinan. | Subkategori Hobi lain dapat disimpan sebagai draft, tetapi Listing menunggu rubrik yang diterbitkan. |
| D14 | Passport publik tersedia saat Listing `ACTIVE`/`RESERVED` dan tetap tersedia setelah transfer selesai; Listing yang ditarik sebelum transfer pertama membuat Passport kembali privat. | Riwayat internal tidak dihapus; akses publik tetap tunduk pada moderasi yang diaudit. |
| D15 | Pembulatan `score-v1` memakai bilangan bulat terdekat dengan `.5` ke atas untuk komponen dan total; total dihitung dari komponen yang sudah dibulatkan. | Input dan versi aturan sama menghasilkan hasil deterministik di backend; tidak ada perbedaan akibat pembulatan antar layar. |
| D16 | Sistem visual MVP memakai warna dan tata letak Pencil `v1`; warna teks warning diperkuat dan badge “TERVERIFIKASI” tanpa makna nyata dihapus. Tipografi diperbarui pada 3 Oktober 2026 sesuai pilihan pengguna menjadi `Plus Jakarta Sans`, dengan teks 500, label/tombol 600, dan judul 700. | PRD dan [design system](08-design-system.md) menjadi sumber token; perbedaan pada Pencil ditangani langsung saat UI dikodekan. |
| D17 | Owner baru menerima ringkasan Repair historis; foto bukti dan catatan rinci owner lama hanya diteruskan bila sengaja dibagikan. | Field privat lama tetap pada pembuatnya dan tidak bocor lewat Passport/API owner baru. |
| D18 | Moderasi kategori membedakan kondisi terlarang, kasus yang perlu review khusus admin, dan kondisi yang boleh ditawarkan dengan pengungkapan jelas. Informasi keselamatan wajib yang belum lengkap menahan Listing. | Setiap Listing tetap melalui review admin; Score tinggi tidak mengesampingkan larangan atau kebutuhan informasi. [Matriks kasus awal per kategori](09-moderation-policy-draft.md) sudah disetujui. |
| D19 | Valora adalah proyek lomba INSYFEST 2026, dengan MVP dan demonstrasi sebagai target karya. | Prioritas dan paket pengumpulan mengikuti [konteks lomba](00-competition-context.md) serta panduan resmi ketika diberikan; kesiapan operasi komersial diputuskan terpisah. |
| D20 | Panduan lomba resmi tidak menjadi syarat untuk melanjutkan spesifikasi dan implementasi MVP yang sudah disepakati. | Rincian kategori, tenggat, dan format pengumpulan yang belum diketahui tetap tidak diklaim sebagai fakta; bila panduan diberikan kemudian, penyesuaian dicatat eksplisit. |
| D22 | Kanvas Pencil tetap sebagai referensi visual dan tidak perlu diedit sebelum implementasi. | Perbedaan token, copy, layout mobile, dan state diselesaikan langsung saat UI dikodekan dengan PRD/docs sebagai acuan perilaku. |

## Batas transaksi di luar platform

Untuk Resell, harga final berasal dari Offer/Counteroffer yang diterima. Metode bayar seperti tunai atau transfer dan cara serah terima seperti bertemu atau memakai jasa kirim dipilih dan dijalankan oleh para pihak. Valora tidak melihat mutasi rekening atau status kurir. Konfirmasi “sudah menyerahkan” dan “sudah menerima” adalah pernyataan pengguna, bukan bukti independen. Jika ada perbedaan, pengguna membuka sengketa; admin meninjau bukti dan mencatat keputusan sesuai prosedur yang akan ditetapkan.

Untuk Exchange, tidak ada tambahan uang dan masing-masing pihak menyerahkan satu Item serta menerima satu Item. Untuk Donate, tidak ada harga jual. Alamat rinci hanya boleh berada pada kanal privat yang berhak mengaksesnya; alamat tersebut tidak menjadi data publik Listing atau Passport.

## Rincian spesifikasi MVP yang ditetapkan

| ID | Area | Aturan dan rujukan |
| --- | --- | --- |
| K01 (O04) | Cabang Listing | `REJECTED` dapat direvisi, `WITHDRAWN` terminal, `SUSPENDED` kembali lewat review, dan pembatalan `RESERVED` melepas reservasi hanya setelah validasi ulang. [Aturan lengkap](10-mvp-implementation-decisions.md#o04--siklus-listing-dan-pembatalan). |
| K02 (O05) | Sumber ekonomi | Tiga angka rupiah memiliki sumber dan snapshot; acuan pengguna boleh dipakai dengan label, harga Listing bukan pembanding; batas rasio diuji. [Rubrik](06-category-rubric-draft.md) dan [kasus batas](10-mvp-implementation-decisions.md#o05--sumber-nilai-ekonomi-dan-batas-formula). |
| K03 (O06) | Rubrik dan keselamatan | Enam indikator memakai lima pilihan yang dirender per sembilan kategori/subkategori; deklarasi keselamatan wajib, tiga perlakuan moderasi, dan kasus batas terdokumentasi. [Rubrik](06-category-rubric-draft.md) dan [kebijakan](09-moderation-policy-draft.md). |
| K04 (O07) | Passport | `PUBLIC`/`LIMITED`/`HIDDEN` ditentukan oleh aturan visibilitas dan tindakan moderasi yang diaudit; proyeksi field terpisah per peran. [Privasi](07-passport-privacy-draft.md). |
| K05 (O08) | Akun dan data | Verifikasi email, batas media, retensi data demo, serta penahanan kasus ditetapkan pada [kontrak rinci](10-mvp-implementation-decisions.md#o08--akun-unggahan-dan-retensi-demo). |
| K06 (O09) | Koreksi Impact | Koreksi append-only dengan delta, atribusi tetap, dan koreksi ownership terotorisasi. [Kontrak rinci](10-mvp-implementation-decisions.md#o09--koreksi-impact-dan-ownership). |

## Keputusan di luar gerbang dokumen MVP

| ID | Saat diperlukan | Keputusan yang belum diketahui |
| --- | --- | --- |
| O11 | Sebelum operasi publik untuk transaksi nyata | Target kinerja, penyedia AI, hosting, backup, observabilitas, batas biaya, pemberitahuan privasi, dan review aturan perdagangan Indonesia yang berlaku. Detail deployment demo dapat dipilih dari kebutuhan karya tanpa mengklaim kesiapan operasi publik. |

K01–K06 menutup keputusan operasional yang menghalangi skema dan API MVP. [Model data](11-data-model.md), [kontrak API](12-api-contract.md), serta [skenario penerimaan](13-acceptance-and-demo.md) menjadi turunan implementasi. Kanvas Pencil tidak perlu diubah; perbaikan Landing mobile, token, copy, dan state yang kurang dikerjakan saat implementasi UI berdasarkan PRD serta [audit desain](04-pencil-design-review.md). Panduan lomba tidak menghambat spesifikasi MVP.

## Keputusan implementasi tahap 4 — 1 Oktober 2026

Pengguna menetapkan bahwa konfirmasi tetap berjalan selama permintaan pembatalan belum dijawab, dan bukti sengketa mencakup catatan, pesan terkait, serta foto privat. Penerima Counteroffer menerima revisi final secara langsung. Penutupan akun segera mencabut akses; transaksi aktif masuk kasus yang tercatat dan menghalangi purge. Implementasi serta batas tahap berikutnya tercatat pada [tahap 4](18-stage4-implementation.md).
