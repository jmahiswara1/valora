# Foto chat, tanda dibaca, dan notifikasi percakapan

**Tanggal:** 6 Oktober 2026. OpenAPI 1.13.0. Migrasi aditif
`20261008010000_chat_enhancements`; pesan teks lama tetap tersedia.

## Mengirim foto

Setiap pesan dapat berisi teks maksimal 2.000 karakter, 1–3 foto tanpa teks,
atau gabungan keduanya. Foto menerima JPG, PNG dan WebP, maksimal 8 MiB per
berkas dan 20 megapiksel. Server memvalidasi isi berkas, memperbaiki orientasi,
memperkecil hingga 2.000 × 2.000, lalu menyimpan WebP tanpa metadata EXIF.

Composer memperlihatkan pratinjau, status unggahan, hapus dan coba lagi. Tombol
Kirim tersedia setelah seluruh foto siap. Tiket berumur 15 menit dan terikat
pengirim serta percakapan. Tiket dari Item, kasus atau percakapan lain ditolak.
Unggahan yatim mengikuti pembersihan 24 jam yang sudah tersedia.

Pembuatan pesan, konsumsi tiket dan notifikasi berada dalam satu transaksi.
Identitas `clientMessageId` unik per percakapan/pengirim; pengulangan dengan isi
berbeda ditolak 409. Setelah respons tidak pasti, tombol Periksa status pesan
memeriksa pesan milik pengirim. Draf baru dibersihkan setelah server memastikan
pesan tersimpan. Tidak ada pengiriman ulang otomatis. Draf berada dalam memori
halaman dan dibersihkan saat meninggalkan sesi/halaman.

## Foto privat dan bukti

`MessageAttachment` terpisah dari foto Item. REST mengirim metadata foto,
bukan kunci penyimpanan. URL foto bertanda tangan berlaku lima menit dan terikat
akun serta sesi. Setiap pembacaan foto memeriksa kembali sesi, kepesertaan dan
izin kasus. Respons menggunakan `private, no-store` dan `nosniff`.

Admin membutuhkan penugasan dan grant laporan/kasus yang cocok. Grant bukti
hanya mengizinkan foto dari pesan yang dirujuk pada bukti; grant CHAT sengketa
mengizinkan percakapan transaksi yang sesuai. Foto pesan dapat dilaporkan dan
ditampilkan dalam snapshot bukti sengketa/koreksi. Kedaluwarsa atau perubahan
penugasan menghentikan akses. Foto mengikuti retensi percakapan 90/180 hari;
kasus aktif dan hold menunda penghapusan. Penghapusan logis dilanjutkan antrean
penghapusan berkas yang sudah tersedia.

Foto terbuka dalam dialog dengan Escape, panah kiri/kanan, navigasi dan
pemulihan fokus. Tautan kedaluwarsa dimuat ulang; foto yang tidak tersedia
menampilkan keadaan pemulihan. Ruang foto dipesan sebelum gambar selesai dimuat.

## Tanda dibaca

`MessageDto` selalu mempunyai `sequence` dan `attachments` (array kosong untuk
teks lama). Detail percakapan memuat `readSequence`, `peerReadSequence`, dan
`messageSequence`. Kirim dan membuka halaman tidak memajukan cursor.

Client mengirim `throughSequence` setelah pesan dimuat dan terlihat di area
scroll serta viewport browser pada tab aktif. Cursor selalu naik dan tidak boleh
melewati pesan terakhir. Pesan terkirim menampilkan Terkirim; Dibaca muncul jika
cursor pihak lain sudah mencakup pesan tersebut. Tanda dibaca selalu aktif.

Satu SSE per sesi mengirim metadata perubahan MESSAGE/READ. REST mengambil isi
pesan, daftar percakapan dan notifikasi. Koneksi dibersihkan pada perubahan
identitas; server memeriksa pencabutan sesi berkala. Jika SSE terputus, histori
dan detail diperbarui setiap lima detik; daftar/notifikasi mempertahankan polling.

## Notifikasi Pesan

`MESSAGE_RECEIVED` menargetkan `CONVERSATION` dan membuka `/app/pesan/:id`.
Pesan baru memperbarui satu baris belum dibaca per percakapan/penerima, termasuk
urutan pesan terbaru dan waktu. Setelah baris dibaca, pesan berikutnya membuat
baris baru; riwayat notifikasi lama tetap ada. Payload tidak berisi isi pesan
atau foto. Badge pusat notifikasi menghitung baris, sedangkan daftar chat
menghitung pesan belum dibaca.

Pembacaan notifikasi tidak mengubah cursor chat. Pembacaan chat hanya menandai
notifikasi bila urutan pesan terbaru tidak melewati cursor terlihat. Permintaan
baca notifikasi menyertakan urutan yang dilihat client, sehingga notifikasi yang
baru diperbarui tidak ikut dibaca oleh permintaan lama. Tandai semua tetap merupakan
persetujuan eksplisit membaca seluruh notifikasi pada saat transaksi dijalankan.

## API tambahan

| Metode | Rute | Tujuan |
| --- | --- | --- |
| GET | `/conversations/:id` | Detail langsung tanpa bergantung 100 percakapan pertama |
| POST | `/conversations/:id/photos/tickets` | Tiket foto pesan |
| PUT | `/media/uploads/:ticketId` | Validasi dan normalisasi unggahan |
| POST | `/conversations/:id/messages` | Teks/foto, `clientMessageId`, `ticketIds` |
| GET | `/conversations/:id/messages/status` | Pemulihan pengiriman sendiri |
| POST | `/conversations/:id/read` | Cursor terlihat `throughSequence` |
| GET | `/message-photos/:id/access` | URL foto singkat, lingkup kasus opsional |
| GET | `/message-photos/private/:id` | Baca foto dan otorisasi ulang |

Nama/avatar lawan bicara membuka `/profil/:id`. Preferensi foto publik tetap
independen dari foto akun privat yang dipakai chat. Profil akun tidak aktif
menggunakan keadaan tidak tersedia yang sudah ada, sementara histori chat
mengikuti retensi.

Video, dokumen, pesan suara, status mengetik/online, edit/hapus pesan dan
notifikasi email/push berada di luar perluasan ini.

## Bukti implementasi

Smoke API mencakup batas foto/ukuran/piksel, tiket asing/kedaluwarsa, replay dan
konflik payload, pengiriman serentak, cursor dan pengelompokan notifikasi, akses
sesi berbeda, grant laporan/bukti/chat, sengketa/koreksi serta retensi foto.
Browser memakai simulasi UI dan API nyata untuk desktop/mobile, termasuk draf,
respons hilang, tab tersembunyi, pagination, tautan profil, dialog dan fokus.

### Hasil verifikasi akhir

- `pnpm test`: seluruh smoke API dan uji formula lulus, termasuk izin foto,
  pengiriman serentak, pemulihan respons, bukti sengketa/koreksi dan retensi.
- `pnpm typecheck`, `pnpm lint`, dan `pnpm build`: lulus.
- Playwright pada build produksi: **164 pengujian desktop/mobile lulus**.
  Delapan skenario chat memakai simulasi UI dan API nyata; matriks sesi
  mencakup seluruh 52 halaman untuk sembilan keadaan akun/koneksi.
- Pemeriksaan tampilan desktop, 390px dan 320px selesai. Reviewer menilai
  perbaikan composer sticky dan kontras placeholder terselesaikan.

Migrasi telah diterapkan secara aditif pada database lokal dan pengujian.
