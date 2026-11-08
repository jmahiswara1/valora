# Konteks produk Valora

**Status:** arah pengembangan produk diperbarui pada 8 November 2026 sesuai keputusan pengguna. Prioritas implementasi mengikuti kebutuhan Valora dan kriteria penerimaan produk.

## Tujuan produk

Valora membantu menjaga nilai dan memperpanjang usia pakai barang. [PRD](PRD.md) menetapkan empat jalur MVP: Repair, Resell, Exchange, dan Donate, beserta Score, Listing, chat, Transaction, Passport, Impact, dan moderasi. Pasar sasaran produk adalah Indonesia, dengan nominal rupiah dan lokasi publik paling rinci kota.

Target pengembangan adalah **MVP yang dapat diperiksa dan didemonstrasikan**. Istilah `ACTIVE`, “publik”, atau “transaksi selesai” di spesifikasi menjelaskan perilaku aplikasi dan hak akses. Pengoperasian bagi pengguna umum, pemrosesan transaksi sungguhan, dan kewajiban operasionalnya memerlukan keputusan tersendiri sebelum peluncuran.

Perubahan kebutuhan dan ruang lingkup dicatat secara eksplisit di [log keputusan](01-product-decisions.md).

## Rencana demonstrasi

Data dan akun contoh harus diberi label demo; statistik pada layar dihitung dari data aplikasi, bukan klaim aktivitas pengguna nyata.

| Cerita yang diperlihatkan | Bukti perilaku aplikasi |
| --- | --- |
| Pemilik menilai Item dan mencatat Repair | Assessment lengkap/parsial, alasan Score, RepairRecord, Assessment baru bila kondisi berubah, dan riwayat Passport. |
| Item dijual kembali | Listing ditinjau admin, Offer/Counteroffer formal, chat sebagai koordinasi, dua konfirmasi serah terima, perpindahan owner, dan Impact tanpa klaim pembayaran terverifikasi. |
| Item dipertukarkan | Dua Item memenuhi syarat, empat konfirmasi, perpindahan dua owner secara atomik, dan dua timeline Passport. |
| Item didonasikan | Assessment `PARTIAL_ECONOMIC` dapat dipakai bila keselamatan lengkap; Score total kosong, permintaan donasi dan konfirmasi selesai. |
| Kasus moderasi dan sengketa | Listing dengan data keselamatan kosong tertahan; kasus dari matriks kategori ditangani sesuai perlakuan; sengketa tidak mengubah ownership otomatis dan tindakan admin tercatat. |

Untuk reproduksi demo, siapkan akun contoh owner, calon penerima, dan admin; Item/foto contoh; serta urutan reset data yang aman. Jumlah akun, hosting, dan cara akses peninjau mengikuti kebutuhan pengembangan. Demo tidak menggunakan identitas, alamat, atau percakapan pribadi orang sungguhan tanpa izin.

## Kriteria kesiapan MVP

1. Selesaikan alur MVP sesuai [kriteria penerimaan PRD](PRD.md#14-kriteria-penerimaan-produk), termasuk empat jalur dan batas klaim.
2. Jalankan skenario demo dengan data contoh yang konsisten, akun peninjau yang sesuai, dan langkah pemulihan bila layanan luar seperti AI atau realtime gagal.
3. Periksa tampilan desktop/mobile terhadap referensi desain, keterbacaan teks Indonesia, dan tidak adanya angka atau badge yang menyiratkan verifikasi palsu.
4. Siapkan penjelasan singkat mengenai masalah, solusi, pembeda Valora, alur produk, keputusan keamanan/privasi, batas MVP, dan potensi pengembangan.

Kesiapan pengoperasian publik bagi transaksi nyata tetap memerlukan kebijakan retensi, layanan operasional, keamanan, dan pemeriksaan aturan perdagangan Indonesia pada saat peluncuran.
