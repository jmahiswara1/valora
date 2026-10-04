# Visibilitas Passport dan data lintas pemilik

**Status:** visibilitas dasar disepakati; pembatasan moderasi dan retensi demo ditetapkan pada [K04–K05](10-mvp-implementation-decisions.md). Item ID dan timeline berlanjut lintas pemilik. Identitas pemilik lama, alamat rinci, isi chat, dan biaya privat tidak masuk Passport publik. Owner baru menerima ringkasan Repair historis yang relevan, sedangkan bukti foto dan catatan rinci pemilik lama hanya tersedia jika sengaja dibagikan.

## Kapan Passport dapat dilihat

| Keadaan Item | Publik | Owner saat ini |
| --- | --- | --- |
| Item draft yang belum pernah dipublikasikan | Tidak ada halaman Passport publik. | Melihat seluruh data miliknya dan event yang sudah terjadi. |
| Listing `ACTIVE` atau `RESERVED` | Timeline publik dapat diakses melalui tautan Passport. | Melihat timeline serta data Item yang menjadi haknya sebagai owner saat ini. |
| Item sudah mengalami Transaction `COMPLETED` | Passport publik tetap tersedia sebagai riwayat transfer walau Listing saat ini tidak aktif, kecuali ada pembatasan moderasi yang diaudit. | Melihat timeline serta data miliknya. |
| Listing ditarik sebelum Item pernah berpindah | Passport tidak lagi tersedia bagi publik; event internal tetap tersimpan. | Melihat histori miliknya. |
| Item/Listing ditangguhkan karena laporan | Admin memilih `LIMITED` atau `HIDDEN` dengan alasan/audit. `LIMITED` menampilkan halaman status tanpa event; `HIDDEN` memberi `404` pada Guest/User tak terkait. | Owner tetap dapat melihat proyeksi miliknya, alasan yang boleh disampaikan, dan jalur banding/laporan. |

“Publik” berarti data yang sengaja diterbitkan, bukan seluruh kolom Item, Assessment, atau Transaction. Akses selalu dibatasi di API/query; komponen UI tidak menjadi satu-satunya pengaman. Keputusan moderasi `LIMITED`/`HIDDEN` tidak menghapus event atau mengubah owner; pencabutannya menuntut tindakan admin baru. Lihat [K04](10-mvp-implementation-decisions.md#o07--pembatasan-passport-publik).

## Proyeksi per jenis event

| Event | Isi publik yang diusulkan | Hanya untuk pihak berhak |
| --- | --- | --- |
| `REGISTERED` | Tanggal pendaftaran Valora, kategori, dan ringkasan Item yang dipublikasikan. | Pembuat melihat input asli; tahun pembelian tetap bertanda laporan pengguna dan tidak dijadikan tanggal registrasi. |
| `ASSESSMENT_CREATED` | Tanggal, versi rubrik, Score/label bila `COMPLETE`, komponen/ringkasan kondisi yang diizinkan, dan asal data. Assessment lama diberi label historis. | Pembuat Assessment melihat jawaban detailnya. Owner baru melihat ringkasan kondisi/riwayat yang dapat diteruskan, lalu membuat Assessment baru jika perlu; jawaban privat pembuat lama tidak otomatis terbuka. |
| `REPAIR_RECORDED` | Tanggal, ringkasan tindakan dan kondisi sesudahnya jika disetujui untuk riwayat publik, selalu berlabel “dilaporkan pemilik”. | Pembuat melihat biaya, catatan rinci, dan bukti privatnya. Owner baru melihat ringkasan historis yang relevan; catatan rinci dan bukti foto lama hanya jika pembuat sengaja menandainya untuk diteruskan. |
| `LISTED` | Tanggal, tipe Listing, status historis, dan kondisi yang pernah dipublikasikan. | Harga final negosiasi, pesan, serta catatan moderasi tetap di konteks yang berhak. |
| `TRANSFERRED_BY_SALE/EXCHANGE/DONATION` | Tanggal, jenis transfer, dan label “tercatat setelah konfirmasi pihak/putusan admin” sesuai asalnya. | Identitas pihak, konfirmasi rinci, harga final Resell, dan koordinasi serah terima hanya untuk peserta/admin kasus sesuai akses. |
| `CORRECTION` | Ringkasan koreksi bila fakta publik berubah, tanggal, dan label koreksi. | Alasan lengkap, bukti, pelapor, dan tindakan admin hanya untuk pihak yang berhak. |

`SYSTEM_CONFIRMED` berarti sistem mencatat proses/konfirmasi formal, **bukan** pemeriksaan fisik barang atau verifikasi pembayaran. Bila admin menyelesaikan sengketa, asal dan teks publik harus membedakannya dari konfirmasi normal kedua pihak tanpa membuka detail kasus privat.

## Hak baca per peran

| Data | Guest | Owner saat ini | Pembuat data / peserta transaksi | Admin |
| --- | --- | --- | --- | --- |
| Ringkasan Passport yang sudah diterbitkan | Ya | Ya | Ya | Ya untuk tugas moderasi. |
| Assessment detail dan jawaban mentah | Tidak | Miliknya sendiri; ringkasan historis owner lama | Pembuat Assessment dapat melihat miliknya | Hanya bila relevan pada review/kasus, dengan audit akses. |
| Ringkasan Repair historis yang relevan | Bila sengaja diterbitkan sebagai riwayat publik | Ya, termasuk dari owner lama | Pembuat record melihat miliknya | Sesuai tugas dan audit. |
| Biaya Repair, bukti privat, catatan rinci | Tidak | Data sendiri; bukti dan catatan lama hanya jika pembuat sengaja membagikannya untuk owner berikutnya. Biaya lama tetap privat. | Pembuat record melihat miliknya | Hanya kasus yang beralasan dan diaudit. |
| Nama, kontak, alamat rinci, kota privat historis | Tidak | Tidak otomatis untuk owner lama | Hanya pihak yang memang terlibat dalam transaksi terkait | Sesuai kebutuhan kasus dan audit. |
| Chat dan tawar-menawar | Tidak | Hanya Conversation yang diikuti | Hanya peserta Conversation | Hanya terkait Report/sengketa dengan alasan akses dan log. |
| Foto Item | Hanya foto yang dipublikasikan | Foto publik serta foto privat yang dibuatnya/diteruskan eksplisit | Pemilik foto privat | Sesuai tugas dan audit. |

Alamat serah terima rinci yang disebut di chat tetap privat bagi peserta percakapan. Lokasi yang dicatat di Listing/Passport publik paling rinci setingkat kota. Metadata foto yang tidak diperlukan, terutama metadata lokasi, harus dihilangkan dari media publik.

## Koreksi dan akses admin

- Event Passport append-only. Koreksi menambahkan event baru yang menunjuk event/field terdahulu, menjelaskan sumber koreksi, serta memperbarui proyeksi publik bila diperlukan. Riwayat internal tetap dapat diaudit.
- Admin moderasi Listing melihat data yang diperlukan untuk memutuskan Listing; ini tidak otomatis memberi akses bebas ke semua chat.
- Admin penangan kasus membuka percakapan atau bukti privat hanya dari Report/sengketa yang ditugaskan, dengan alasan akses, waktu, identitas admin, dan referensi kasus di `AdminAction`/audit akses.
- Pergantian owner mengubah hak akses berdasarkan owner terkini. Ringkasan Repair relevan mengikuti Item; pesan, biaya, dan dokumen identitas pembuat lama tidak ikut. Bukti foto dan catatan rinci hanya ikut jika pembuat menandainya secara eksplisit untuk owner berikutnya.
- Penutupan akun, retensi chat/foto demo, penahanan kasus, dan pseudonimisasi mengikuti [K05](10-mvp-implementation-decisions.md#o08--akun-unggahan-dan-retensi-demo). Jejak transfer/Impact tetap dapat diaudit tanpa menerbitkan kontak atau alamat mantan pengguna.

## Kontrak API dan pemeriksaan minimum

Sediakan proyeksi terpisah untuk Passport publik, owner, dan admin kasus, dengan daftar field yang diperbolehkan. Jangan mengirim payload privat lengkap lalu menyembunyikan sebagian field di browser. Bukti foto dan catatan rinci Repair lama memakai izin berbagi eksplisit per record atau lampiran; nilai awalnya privat. Uji sebagai Guest, owner saat ini, owner lama, peserta transaksi, User tak terkait, admin moderasi, dan admin kasus. Contoh wajib: setelah Resell selesai, owner baru melihat timeline, kondisi barang, dan ringkasan Repair relevan, tetapi tidak mendapat chat, alamat, biaya Repair privat, identitas pemilik lama, atau bukti/catatan Repair yang tidak dibagikan melalui API Passport.

**Skenario wajib:** Guest menerima proyeksi yang sama sekali tidak memuat field privat; owner baru hanya menerima ringkasan Repair lama dan bukti yang sengaja dibagikan; admin moderasi tidak dapat membaca chat tanpa kasus; `LIMITED`/`HIDDEN` tidak menghapus timeline internal; penutupan akun menunggu Transaction/kasus aktif selesai sesuai K05.
