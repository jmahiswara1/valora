# Audit referensi desain Pencil

**Sumber:** kanvas pen.dev aktif `pencil-new.pen`, ditinjau 28 September 2026 melalui MCP Pencil. Audit ini bersifat baca-saja; kanvas tidak diubah dan tidak perlu diedit sebelum implementasi. [PRD v1.14](../PRD.md) menetapkan token visual `v1`, font, warning text, dan penghapusan badge tanpa objek verifikasi. Screenshot dan layer dipakai untuk membaca arah visual serta cakupan layar; koreksi berikut dikerjakan pada UI yang dikodekan.

## Inventaris

| Area | Layar dasar | Varian |
| --- | ---: | --- |
| Publik P01–P06 | 6 | Desktop dan mobile: Landing, Cara Kerja, Market, Detail Listing, Passport Publik, Tentang Valora. |
| Akun AUC01–AUC04 | 4 | Desktop dan mobile: daftar, masuk, reset kata sandi, verifikasi/akses. |
| User U01–U18 | 18 | Desktop dan mobile: ringkasan, Item, Score, Repair, Listing, Offer, chat, Transaction, Passport, Impact, report, profil. |
| Admin AD01–AD14 | 14 | Desktop dan mobile: ringkasan, moderasi, laporan, sengketa, pengguna, rubrik, transaksi, analytics, audit. |

Total ada 84 frame layar, ditambah satu design system, tiga komponen foto, dan satu peta alur. Peta alur sudah menghubungkan Item → Assessment → empat tindakan → Transaction → Passport/Impact, serta jalur moderasi dan sengketa. Ini cakupan layar yang baik untuk menurunkan navigasi dan komponen.

## Yang sudah selaras dengan PRD

- Halaman publik memakai komposisi editorial, foto barang dominan, ruang putih, dan container yang jelas.
- Sampel Landing, Market, Score, dan Admin tidak memakai efek shadow. Audit node sampel tidak menemukan elemen terpotong menurut pemeriksaan bounds Pencil, walau pemeriksaan ini tidak menjamin keterbacaan teks.
- Market dan Detail Listing membedakan Resell, Exchange, serta Donate. Detail Listing memuat harga, kondisi, sumber Score, chat, dan Offer formal.
- Peta alur dan contoh chat menegaskan bahwa percakapan tidak mengubah kesepakatan formal. Contoh Transaction menyatakan owner baru berubah setelah konfirmasi lengkap.
- Design system menyebut status eksplisit dan keadaan default, hover, focus, disabled, loading, empty, error, dan success.

## Ketidaksesuaian dan koreksi saat implementasi UI

| Prioritas | Temuan berbasis kanvas | Tindakan dalam implementasi |
| --- | --- | --- |
| Tinggi | Market desktop masih menampilkan badge **“TERVERIFIKASI”** pada contoh Listing, sedangkan Valora tidak memverifikasi kondisi fisik atau pembayaran. | Jangan tampilkan badge tersebut pada komponen Market/Listing yang dikodekan tanpa objek verifikasi nyata. |
| Tinggi | Landing mobile 390 px menampilkan empat kartu Repair/Resell/Exchange/Donate sekaligus dalam satu baris; judul dan isi terpecah menjadi kata/huruf yang sempit. | Kodekan satu atau dua kolom, lalu periksa urutan baca dan tinggi konten. Prinsip PRD adalah keterbacaan pada ponsel tanpa horizontal scroll. |
| Tinggi | Score, chat, Transaction, dan beberapa layar user memakai blok contoh ringkas yang berulang (“TERKINI”, “Konteks dan sumber”, “Langkah berikutnya”). Visualnya belum menjelaskan semua data, error, dan cabang status. | Jadikan layar tersebut acuan komposisi; kodekan state `INCOMPLETE`, `PARTIAL_ECONOMIC`, `NEEDS_DATA`, reserved, sengketa, loading, dan kegagalan berdasarkan PRD/docs. |
| Sedang | Saat audit awal, token PRD berbeda dari layar Pencil. PRD v1.14 memilih Forest `#1B3A28`, Cream `#F5F3EE`, Line `#CAD4C7`, dan token `v1` lain. | Terapkan [token terpilih](08-design-system.md) dalam kode walaupun papan Design System Pencil berbeda. |
| Sedang | Papan “Valora Design System” di kanvas masih menyebut Inter, sementara layar yang ditinjau banyak memakai Newsreader, Funnel Sans, dan IBM Plex Mono. Kanvas juga menyimpan variabel `v2`. | Gunakan tiga font dari `v1` dalam implementasi dan abaikan variabel `v2` untuk MVP. |
| Sedang | Contoh Market menampilkan angka stok/klaim seperti “128 barang aktif · diperbarui hari ini” dan label kurasi. | Angka dan label dalam kode harus berasal dari data/kurasi nyata atau diganti copy netral. |
| Sedang | Empat konfirmasi Exchange dan alur pembatalan/sengketa belum terwakili sebagai state lengkap di satu layar Transaction. | Kodekan matriks konfirmasi dua Item, status pihak lawan, dan jalur sengketa. |

## Aturan pemakaian referensi saat coding nanti

1. Gunakan layar Pencil untuk komposisi, ritme, hierarki, foto, dan pola navigasi. Gunakan PRD serta dokumen domain untuk hak akses, status, dan fakta yang boleh diklaim.
   Bila contoh Pencil bertentangan dengan PRD/docs, ikuti aturan tertulis dan uji hasil implementasi; kanvas tetap sebagai referensi asal.
2. Komponen tidak boleh menampilkan Score total pada Assessment `PARTIAL_ECONOMIC`; labelnya harus menjelaskan data yang kurang.
3. Desain untuk mobile 390 px dan desktop 1440 px harus diuji secara nyata, termasuk keyboard focus, teks panjang berbahasa Indonesia, angka rupiah, empty/loading/error, dan state disabled.
4. Foto contoh, angka contoh, nama pengguna, harga, dan timestamp pada kanvas adalah fixture desain sampai ada data produk sesungguhnya.
5. Gunakan token final pada [design system MVP](08-design-system.md), lalu lengkapi komponen dasar: header publik, sidebar user/admin, kartu Listing, filter, form, status, timeline, percakapan, tabel, dan dialog konfirmasi.
