# Daftar dan alur penawaran

Mode: Operate. Pertahankan Plus Jakarta Sans, White, Forest, Cream/Sage,
kontrol akun yang sudah ada, serta pemisah datar.

## Daftar

- Judul dan nominal menjadi informasi utama. Arah penawaran, jenis, revisi,
  pesan terakhir, serta ringkasan paket mendukung pemindaian baris.
- Baris dan judul bukan target klik. Navigasi berada pada tombol minimal 44px;
  status berupa teks, tanpa latar menyerupai tombol atau notice selebar baris.
- Perlu tanggapan: tombol utama **Tinjau penawaran** membuka detail.
- Menunggu atau berakhir: **Lihat detail** memakai tombol sekunder.
- Diterima dengan transactionId: **Buka transaksi** menjadi aksi utama;
  **Lihat detail** tetap tersedia sebagai aksi sekunder. Tanpa transactionId,
  hanya detail ditawarkan; jangan membuat tautan transaksi kosong.
- Tenggat hanya ditampilkan saat masih aktif. Status diterima tidak membuktikan
  transaksi masih berlangsung; arahkan ke transaksi untuk melihat progresnya.
- Baris menumpuk secara struktural pada layar sempit dan mempertahankan tombol
  yang jelas ketika judul panjang atau ukuran teks diperbesar.

## Tinjau, tanggapi, lanjutkan

Terima, tawaran balik, tolak, dan tarik berada di detail, sesuai peserta dan
giliran respons. Penerimaan tetap melalui dialog berisi ketentuan lengkap,
persetujuan eksplisit, dan reservasi. Versi, revisi, hash paket, idempotensi,
penanganan konflik, dan pemulihan permintaan tidak berubah.

Tawaran balik membuka formulir di detail dengan nominal, paket, dan tambahan
uang sesuai jenisnya. Draf yang gagal tetap tersedia untuk retry. Tenggat yang
lewat menonaktifkan respons di daftar dan detail; rincian yang belum tersedia
tidak menawarkan mutasi.

## Verifikasi

Regresi browser mencakup filter, urutan giliran, tinjau sebelum mutasi,
payload tawaran balik, hak peserta, persetujuan penerimaan dan hash paket,
retry, tenggat, rincian kosong, serta loading/empty/error. Pemeriksaan visual
mencakup desktop, tablet, ponsel 320/390px, dan teks 200% tanpa overflow baris.
