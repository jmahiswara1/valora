# Konteks karya INSYFEST 2026

**Status:** fakta tujuan lomba dikonfirmasi pengguna pada 28 September 2026. Pengguna menyatakan panduan resmi tidak diperlukan untuk melanjutkan rencana saat ini. Kategori, tenggat, format pengumpulan, dan kriteria penilaian yang belum diketahui tidak ditebak dari edisi lain.

## Tujuan karya

Valora dikembangkan sebagai proyek lomba **INSYFEST 2026**. [PRD](PRD.md) tetap menetapkan empat jalur MVP: Repair, Resell, Exchange, dan Donate, beserta Score, Listing, chat, Transaction, Passport, Impact, dan moderasi. Pasar sasaran produk adalah Indonesia, dengan nominal rupiah dan lokasi publik paling rinci kota.

Target dekat adalah **karya yang dapat diperiksa dan didemonstrasikan**. Istilah `ACTIVE`, “publik”, atau “transaksi selesai” di spesifikasi menjelaskan perilaku aplikasi dan hak akses, tidak berarti platform sudah dibuka untuk perdagangan nyata. Pengoperasian bagi pengguna umum, pemrosesan transaksi sungguhan, dan kewajiban operasionalnya memerlukan keputusan terpisah.

## Informasi lomba yang belum diketahui dan tidak menghambat MVP

| Hal | Status | Dampak pada rencana |
| --- | --- | --- |
| Cabang/kategori lomba dan tema resmi 2026 | Belum diverifikasi | Menentukan penekanan narasi dan bukti yang ditunjukkan ke juri. |
| Kriteria serta bobot penilaian | Belum diverifikasi | Menentukan susunan demo, artefak pendukung, dan prioritas penyempurnaan. |
| Tenggat dan tahapan seleksi | Belum diverifikasi | Menentukan jadwal kerja dan batas finalisasi karya. |
| Format pengumpulan, akses juri, serta kebutuhan deployment/video/presentasi | Belum diverifikasi | Menentukan kemasan aplikasi dan skrip demo. |
| Aturan penggunaan AI, pustaka, aset, dan kolaborasi | Belum diverifikasi | Menentukan bukti orisinalitas dan pilihan layanan implementasi. |

Informasi pada tabel tidak menjadi syarat untuk melanjutkan spesifikasi atau implementasi MVP. Bila panduan diberikan kemudian dan mengubah kebutuhan pengumpulan, catat perubahan ruang lingkup secara eksplisit di [log keputusan](01-product-decisions.md).

## Rencana demonstrasi sementara — usulan

Rencana ini membantu menyiapkan alur produk sambil menunggu panduan. Data dan akun contoh harus diberi label demo; statistik pada layar dihitung dari data aplikasi, bukan klaim aktivitas pengguna nyata.

| Cerita yang diperlihatkan | Bukti perilaku aplikasi |
| --- | --- |
| Pemilik menilai Item dan mencatat Repair | Assessment lengkap/parsial, alasan Score, RepairRecord, Assessment baru bila kondisi berubah, dan riwayat Passport. |
| Item dijual kembali | Listing ditinjau admin, Offer/Counteroffer formal, chat sebagai koordinasi, dua konfirmasi serah terima, perpindahan owner, dan Impact tanpa klaim pembayaran terverifikasi. |
| Item dipertukarkan | Dua Item memenuhi syarat, empat konfirmasi, perpindahan dua owner secara atomik, dan dua timeline Passport. |
| Item didonasikan | Assessment `PARTIAL_ECONOMIC` dapat dipakai bila keselamatan lengkap; Score total kosong, permintaan donasi dan konfirmasi selesai. |
| Kasus moderasi dan sengketa | Listing dengan data keselamatan kosong tertahan; kasus dari matriks kategori ditangani sesuai perlakuan; sengketa tidak mengubah ownership otomatis dan tindakan admin tercatat. |

Untuk reproduksi demo, rancang akun contoh owner, calon penerima, dan admin; Item/foto contoh; serta urutan reset data yang aman. Detail jumlah akun, hosting, dan cara akses juri mengikuti panduan resmi. Demo tidak menggunakan identitas, alamat, atau percakapan pribadi orang sungguhan tanpa izin.

## Gerbang kesiapan karya — usulan

1. Cocokkan karya dan materi pengumpulan dengan kategori, tema, serta aturan resmi INSYFEST 2026 ketika panduan tersedia.
2. Selesaikan alur MVP sesuai [kriteria penerimaan PRD](PRD.md#14-kriteria-penerimaan-produk), termasuk empat jalur dan batas klaim.
3. Jalankan skenario demo dengan data contoh yang konsisten, akun juri yang sesuai, dan langkah pemulihan bila layanan luar seperti AI atau realtime gagal.
4. Periksa tampilan desktop/mobile terhadap referensi Pencil, keterbacaan teks Indonesia, dan tidak adanya angka atau badge yang menyiratkan verifikasi palsu.
5. Siapkan materi penjelasan singkat: masalah, solusi, pembeda Valora, alur produk, keputusan keamanan/privasi, batas MVP, dan potensi pengembangan. Bentuknya disesuaikan bila panduan lomba diberikan kemudian.

Kesiapan pengoperasian publik bagi transaksi nyata tetap memerlukan kebijakan retensi, layanan operasional, keamanan, dan pemeriksaan aturan perdagangan Indonesia pada saat peluncuran. Itu tidak diasumsikan sebagai syarat pengumpulan lomba tanpa panduan resminya.
