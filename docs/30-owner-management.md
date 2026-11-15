# Kelola Listing dan barang

Pemilik membuka detail Listing lalu **Edit Listing** untuk memperbarui judul, deskripsi, kondisi yang diungkapkan, harga, kota, metode serah terima, pilihan foto, dan keterangan sesuai jenis. Jenis Listing dan barang yang terhubung tetap. Penilaian terbaru yang masih cocok dengan revisi barang dapat digunakan kembali untuk perubahan Listing; perubahan kondisi barang tetap memerlukan penilaian terkini. Listing aktif dijeda dan penawaran terbuka berakhir ketika disimpan. Revisi baru harus dikirim untuk review dan disetujui sebelum publikasi ulang. Listing ditarik dapat diedit dan diajukan ulang; Listing dalam transaksi, selesai, atau ditangguhkan tidak bisa diedit.

Tombol **Hapus Listing** dan **Hapus barang** ada pada detail milik sendiri, melalui dialog konfirmasi. DELETE /listings/:id dan DELETE /items/:id memakai expectedVersion, pemeriksaan pemilik, serta penguncian domain. Versi lama ditolak; pengulangan penghapusan oleh pemilik berhasil tanpa menggandakan perubahan. Barang atau Listing yang terikat transaksi aktif tidak bisa dihapus.

Penghapusan Listing memakai deletedAt dan status WITHDRAWN (CLOSED tetap CLOSED); hilang dari Market dan Listing saya, tetapi barang tetap tersimpan. Penghapusan barang memakai archivedAt, menghapus Listing pemilik terkait, menutup penawaran termasuk paket tukar, serta mengakhiri panduan yang sudah tidak cocok. Riwayat penawaran, transaksi, dan kepemilikan tetap tersimpan. Tidak ada penghapusan fisik data historis.

Market menampilkan COD, bisa dikirim, atau COD atau dikirim berdasarkan metode Listing. Usulan serah terima mengikuti metode pada snapshot kesepakatan; opsi yang tidak tersedia tetap terlihat tetapi disabled.

Migrasi aditif 20261115150000_owner_listing_delete menambah Listing.deletedAt tanpa mengubah data lama.
