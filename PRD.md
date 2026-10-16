# Valora — Product Requirements Document

**Versi:** 1.28
**Tanggal:** 16 Oktober 2026  
**Status:** Karya INSYFEST 2026; arah produk disepakati, spesifikasi MVP ada di `docs/`, dan implementasi tahap 1 dicatat pada `docs/15-stage1-implementation.md`  
**Tagline:** *Keep Things Valuable*  
**Platform:** Web application  
**Tema:** Kesadaran lingkungan melalui circular economy

## 0. Keputusan produk pada revisi ini

1. Valora mempertahankan keempat jalur: **Repair, Resell, Exchange, dan Donate**. Semuanya termasuk dalam MVP.
2. Area publik, dashboard pengguna, dan dashboard admin memiliki navigasi serta hak akses terpisah.
3. **Chat masuk MVP.** Percakapan menghubungkan calon pihak transaksi pada suatu listing dan berlanjut selama transaksi berlangsung. Perubahan kesepakatan formal tetap terjadi melalui Offer dan Transaction.
4. AI pada MVP berupa **Valora AI Explainer**: menjelaskan Score yang telah dihitung dan alasan rekomendasi dari data terstruktur. AI tidak menghitung Score, menaksir harga pasar, memverifikasi kondisi fisik, atau mengubah ownership.
5. Ownership berpindah hanya ketika Transaction selesai melalui konfirmasi serah terima kedua pihak. Exchange MVP memindahkan dua Item secara atomik; perluasan Exchange mendukung 1–3 Item per pihak dan menunggu laporan tambahan uang bila disepakati.
6. Passport adalah riwayat Item yang berlanjut lintas pemilik. Impact dihitung dari peristiwa yang definisinya jelas; klaim dampak lingkungan tidak melampaui data yang tersedia.
7. UI memakai gaya editorial dengan foto dominan, ruang putih, aksen hijau, sedikit cream, sudut membulat, dan tanpa shadow. Referensi pengguna pada 3 Oktober 2026 menjadi arah komposisi baru, disesuaikan untuk berbagai kategori barang. Migrasi bertahap dimulai dari Beranda, Cara Kerja, dan Impact publik, lalu akun, Market, serta dashboard pengguna/admin.
8. Donate dan Exchange boleh memakai Assessment dengan komponen ekonomi belum lengkap, selama komponen lain dan pemeriksaan keselamatan lengkap. Score total tidak ditampilkan sampai keempat komponen lengkap. Resell tetap memerlukan Assessment lengkap.
9. Pada MVP, pembayaran dan pengiriman/serah terima diatur langsung oleh para pihak di luar Valora. Valora mencatat Offer, Transaction, konfirmasi para pihak, dan sengketa, tetapi tidak memproses pembayaran atau memverifikasi perpindahan fisik barang secara independen. Integrasi pembayaran dan pengiriman dilakukan setelah MVP.
10. Pasar sasaran awal Valora adalah Indonesia. Harga dan estimasi biaya memakai rupiah; lokasi yang tampil publik paling rinci setingkat kota. Alamat serah terima rinci tetap privat.
11. Offer berlaku tujuh hari sejak pembuatan atau Counteroffer terakhir. Setelah Offer diterima, target serah terima adalah 14 hari dengan pengingat di aplikasi. Lewat target masuk tindak lanjut admin; tidak ada pembatalan atau perpindahan ownership otomatis. Pembatalan memerlukan persetujuan kedua pihak atau putusan sengketa yang diaudit.
12. Perubahan material pada Listing aktif membuatnya `PAUSED`; Offer berdasarkan revisi lama berakhir. Assessment dan moderasi diulang sebelum Listing dapat aktif lagi.
13. `Items Revalued` dihitung sekali per Item pada total platform dan diatribusikan kepada pengguna yang pertama menyelesaikan Assessment. Berat transfer pada ringkasan pengguna diatribusikan kepada pihak yang menyerahkan Item; total platform menghitung setiap Item yang berpindah sesuai Transaction.
14. Rubrik barang hobi pada MVP dimulai dari alat musik, permainan papan, serta peralatan seni/kerajinan. Subkategori lain dapat disimpan sebagai draft Item, tetapi belum dipublikasikan sebagai Listing sampai rubriknya diterbitkan.
15. Passport publik tersedia saat Listing `ACTIVE`/`RESERVED` dan tetap tersedia setelah Item mengalami Transaction `COMPLETED`. Jika Listing ditarik sebelum Item pernah berpindah melalui Valora, Passport kembali privat; event internal tetap tersimpan.
16. Warna Forest/Green dipertahankan dengan White sebagai permukaan utama, Cream sebagai aksen, dan Sage sebagai bidang pendukung. Tipografi memakai `Plus Jakarta Sans`: teks medium 500, label/tombol semibold 600, dan judul bold 700. Token implementasi baru tercatat pada `apps/web/DESIGN.md`; batas migrasi ada di `docs/08-design-system.md`. Badge “TERVERIFIKASI” tidak dipakai tanpa jenis verifikasi yang benar-benar dilakukan dan dijelaskan.
17. Setelah ownership berpindah, owner baru menerima ringkasan Repair historis yang relevan. Foto bukti dan catatan rinci pemilik lama hanya ikut bila pemilik lama sengaja membagikannya; biaya privat, kontak, alamat, dan chat tidak ikut.
18. Moderasi kategori memakai tiga perlakuan yang dibedakan secara eksplisit: kondisi yang ditetapkan terlarang tidak boleh dipublikasikan, kasus meragukan memerlukan tinjauan admin, dan kondisi yang diperbolehkan harus diungkapkan dengan jelas. Listing dengan informasi keselamatan wajib yang belum lengkap ditahan sampai diperjelas. Semua Listing tetap melalui review admin sebelum aktif.
19. Valora dibuat sebagai proyek lomba **INSYFEST 2026**. Dokumen membedakan target karya dan demonstrasi MVP dari keputusan pengoperasian platform untuk transaksi nyata; kategori, tenggat, format pengumpulan, serta kriteria penilaian lomba mengikuti panduan resmi ketika tersedia. Matriks kasus moderasi awal per kategori pada `docs/09-moderation-policy-draft.md` telah disetujui sebagai kebijakan MVP; formulir dan kasus uji MVP tercatat pada `docs/06-category-rubric-draft.md`.
20. Panduan lomba resmi tidak diperlukan untuk melanjutkan rencana MVP Valora saat ini. Bila ketentuan lomba diberikan kemudian, kebutuhan pengumpulan dapat disesuaikan secara eksplisit tanpa menganggap rincian lomba yang belum diketahui sebagai fakta.
21. Rincian operasional O04–O09 yang sebelumnya terbuka ditetapkan sebagai baseline spesifikasi MVP pada `docs/10-mvp-implementation-decisions.md`, lalu diturunkan ke model data, API, dan skenario penerimaan. Rincian baru tersebut adalah keputusan rancangan pra-kode; perubahan setelah review dilakukan lewat revisi dokumen dan versi aturan, bukan perubahan diam-diam pada data historis. O11 tetap keputusan terpisah sebelum operasi publik.
22. Kanvas Pencil tetap menjadi catatan desain historis dan tidak perlu diedit. Komposisi baru mengikuti referensi pengguna; PRD serta `docs/` tetap menjadi sumber copy, status, akses, dan perilaku produk. Halaman yang belum mendapat tahap redesign mempertahankan implementasi saat ini sampai tahapnya dikerjakan.

Dokumen ini mengonsolidasikan PRD overview dan keputusan dalam pembahasan terbaru. Spesifikasi modul yang lebih rinci harus mengikuti aturan produk di sini apabila terdapat perbedaan.

## 1. Ringkasan produk

Valora membantu pemilik mempertahankan nilai dan memperpanjang usia pakai barang melalui evaluasi, perbaikan, penjualan kembali, pertukaran, dan donasi. Karya ini disiapkan untuk **INSYFEST 2026** dengan pasar sasaran Indonesia, nominal dalam rupiah, dan lokasi yang tampil pada area publik paling rinci setingkat kota. Pengguna mendaftarkan barang, melengkapi kondisi, menerima **Valora Score** dan rekomendasi, lalu menentukan tindakan. Peristiwa penting dicatat dalam **Valora Passport**, sedangkan aktivitas yang memenuhi syarat masuk ke **Valora Impact**.

Valora Score adalah **indeks potensi sirkular menurut rubrik Valora**, bukan sertifikat kondisi, jaminan nilai jual, atau bukti bahwa barang telah menyelamatkan sejumlah emisi.

### 1.1 Masalah

Barang yang masih memiliki nilai guna sering tidak digunakan atau dibuang karena pemilik tidak mengetahui kondisi, pilihan perbaikan, perkiraan nilai, penerima yang tepat, atau hasil tindakannya. Proses transaksi barang bekas juga membutuhkan koordinasi dan catatan yang dapat dipercaya.

### 1.2 Tujuan

- Membantu pemilik mengevaluasi barang dengan alasan yang dapat dipahami.
- Memungkinkan Repair, Resell, Exchange, dan Donate dalam satu alur produk.
- Mencatat perjalanan Item ketika pemilik berganti.
- Menyajikan metrik aktivitas sirkular yang definisinya dapat diaudit.
- Memberi alat moderasi dan penyelesaian sengketa kepada admin.

### 1.3 Batas klaim

Valora tidak memverifikasi pembayaran di luar platform, kelayakan fisik barang secara independen, atau pengurangan CO₂ tanpa metodologi dan bukti yang sesuai. Keterangan kondisi serta riwayat sebelum terdaftar di Valora diberi label sebagai laporan pengguna.

## 2. Aktor, halaman, dan akses

| Aktor | Halaman utama | Hak utama |
| --- | --- | --- |
| Guest | Landing, Market, detail listing, daftar, login | Melihat informasi publik; tidak dapat mengirim chat, offer, atau permintaan donasi. |
| User | Dashboard, Barang Saya, Evaluasi, Repair, Listing Saya, Inbox, Offer & Transaksi, Passport, Impact, Profil | Mengelola Item miliknya, berkomunikasi, bertransaksi, dan melaporkan masalah. |
| Admin | Dashboard Admin, Moderasi Listing, Laporan & Sengketa, Pengguna, Kategori & Rubrik, Transaksi, Analytics, Audit | Meninjau dan mengelola platform dengan pencatatan tindakan. |

Contoh rute: `/market`, `/market/[listingId]`, `/dashboard`, `/items`, `/items/[itemId]`, `/messages`, `/transactions`, `/passport/[itemId]`, `/impact`, `/admin`, `/admin/listings`, dan `/admin/reports`. Nama rute dapat berubah tanpa mengubah pemisahan hak akses.

Pemeriksaan peran dan kepemilikan wajib dilakukan pada API dan akses data, bukan hanya dengan menyembunyikan tombol. Admin dapat memiliki akun user, tetapi tindakannya dalam peran admin tetap dicatat di audit log. Identitas, alamat rinci, dan isi chat tidak tampil untuk publik.

## 3. Model domain dan aturan tetap

| Entitas | Fungsi |
| --- | --- |
| `User` | Identitas akun, peran, status aktif atau ditangguhkan. |
| `Item` | Identitas barang yang tetap; menyimpan `currentOwnerId`, kategori, atribut, dan status arsip. |
| `ItemImage` | Foto barang dengan akses sesuai konteks. |
| `Assessment` | Snapshot jawaban, komponen yang dapat dihitung, status kelengkapan, Score bila lengkap, rekomendasi, sumber data, dan `ruleVersion`. |
| `RepairRecord` | Tanggal, tindakan, biaya, kondisi sesudahnya, bukti opsional, dan asal klaim. |
| `Listing` | Penawaran publik atas satu Item, bertipe `RESELL`, `EXCHANGE`, atau `DONATE`. |
| `Offer` | Harga yang ditawar, Item pertukaran, atau permintaan donasi menurut jenis listing. |
| `Conversation` / `Message` | Komunikasi terkait listing dan pihak transaksi. |
| `Transaction` | Kesepakatan yang diterima, konfirmasi serah terima, status, dan harga final jika penjualan. |
| `OwnershipTransfer` | Jejak perpindahan owner oleh satu Transaction selesai. |
| `PassportEvent` | Riwayat penting Item yang bersifat append-only. |
| `ImpactEvent` | Sumber perhitungan metrik, terkait aktivitas yang memenuhi syarat. |
| `Report` / `AdminAction` | Laporan pengguna, penanganan, alasan, dan audit moderasi. |

**Invarian domain:**

1. Satu Item memiliki tepat satu current owner pada satu waktu.
2. Item, Assessment, dan Listing adalah entitas terpisah. Satu Item dapat memiliki beberapa Assessment dan beberapa Listing historis, tetapi paling banyak satu Listing aktif atau reserved.
3. Pembuat Listing harus menjadi owner Item dan akun dalam keadaan aktif. Pengguna tidak dapat menawar Listing miliknya sendiri.
4. Item yang sedang reserved tidak dapat dipakai untuk kesepakatan lain. Item yang ditawarkan dalam Exchange mengikuti aturan yang sama.
5. Owner berubah hanya melalui penyelesaian Transaction. Exchange memperbarui kedua owner atau tidak sama sekali.
6. PassportEvent yang telah tercatat tidak dihapus karena Item berganti owner. Koreksi dicatat sebagai peristiwa koreksi yang dapat diaudit.
7. Penyelesaian Transaction bersifat idempoten: pengulangan permintaan tidak membuat transfer, event, atau Impact ganda.
8. Perubahan kategori, fungsi, kerusakan, kelengkapan, atau informasi material lain setelah Assessment membuat hasil lama tidak lagi berlaku sebagai hasil terkini. Listing `ACTIVE` menjadi `PAUSED`; Offer pada revisi lama menjadi `EXPIRED` dengan alasan `LISTING_REVISED`. Assessment dan moderasi ulang diperlukan sebelum Listing dapat kembali `ACTIVE`.
9. Chat tidak mengubah harga final, status Offer, status Transaction, atau ownership secara implisit.

## 4. Alur utama end-to-end

1. **Daftar/login.** Pengguna melengkapi profil minimum dan kota. Lokasi atau alamat serah terima yang lebih rinci tidak dipublikasi.
2. **Tambah Item.** Pengguna mengunggah foto, memilih kategori, menulis deskripsi, fungsi, kondisi, kelengkapan, tahun pembelian dan harga awal jika diketahui, perkiraan berat jika diketahui, serta masalah atau kebutuhan perbaikan.
3. **Evaluasi.** Sistem menampilkan pertanyaan kategori. Data wajib yang belum terisi membuat Assessment berstatus `INCOMPLETE`; bila hanya data ekonomi yang belum lengkap, statusnya `PARTIAL_ECONOMIC`. Item tetap tersimpan sebagai draft.
4. **Score & rekomendasi.** Mesin aturan menghitung komponen yang didukung data, alasan, serta kelayakan setiap tindakan. Score total dan label hanya dihitung dari Assessment `COMPLETE`. AI Explainer dapat menyajikan penjelasan bahasa alami atas data yang tersedia; penjelasan berbasis template tersedia ketika AI gagal.
5. **Pilihan pemilik.** Pemilik dapat mencatat Repair, membuat Listing Resell/Exchange/Donate, atau menyimpan Item tanpa tindakan. Pilihan lain tetap boleh selama memenuhi aturan kelayakan dan keamanan.
6. **Discovery & Chat.** Calon pihak melihat listing dan dapat membuka percakapan setelah login. Pembicaraan awal tidak mereservasi Item.
7. **Offer / permintaan.** Calon pembeli menawar harga, calon penukar memilih Item miliknya, atau calon penerima mengajukan permintaan donasi.
8. **Penerimaan dan reservasi.** Pemilik menerima satu Offer; sistem memverifikasi owner, kelayakan, status, serta konflik, lalu mereservasi Item terkait dan membuat Transaction.
9. **Serah terima.** Kedua pihak menggunakan chat untuk koordinasi privat, kemudian mengisi konfirmasi yang sesuai dengan jenis transaksi. Pembayaran dan pengiriman yang terjadi di luar aplikasi tidak diklaim telah diverifikasi Valora.
10. **Penyelesaian.** Sistem menyelesaikan Transaction, memindahkan ownership sesuai jenisnya, menutup Listing, membuat PassportEvent, dan mencatat ImpactEvent dalam alur data yang konsisten.
11. **Siklus berikutnya.** Pemilik baru melihat Item di dashboard, dapat mencatat Repair, menilai ulang, dan membuat Listing baru. Item ID serta Passport tetap sama.

### 4.1 Jalur Repair

- Pemilik menambahkan tanggal, deskripsi tindakan, biaya aktual atau estimasi, status berhasil/tidak berhasil, dan kondisi sesudahnya. Foto bukti opsional.
- Catatan buatan pemilik ditampilkan sebagai `dilaporkan pemilik`. Tidak ada perpindahan ownership.
- Jika kondisi berubah, sistem mewajibkan Assessment baru. Score lama tetap dapat dilihat dalam riwayat.
- Repair yang tercatat dihitung sebagai aktivitas repair yang dilaporkan; massa barang tidak otomatis ditambahkan ke metrik transfer.
- Panduan perbaikan berbantuan AI dan marketplace jasa repair berada di Future Features. Konten keamanan statis dan rujukan teknisi dapat ditampilkan untuk kategori yang memerlukannya.

### 4.2 Jalur Resell

- Listing memuat harga yang diminta dalam rupiah, kondisi, Score beserta sumbernya, kota, opsi serah terima, dan foto.
- Offer memuat nominal dan pesan opsional. Pemilik dapat menerima, menolak, atau mengirim counteroffer; pihak penerima counteroffer harus menyetujuinya secara eksplisit.
- Harga yang disepakati disimpan sebagai snapshot pada Transaction. Mengubah harga Listing setelahnya tidak mengubah kesepakatan tersebut.
- Penjual mengonfirmasi telah menyerahkan Item, pembeli mengonfirmasi telah menerimanya. Setelah keduanya terpenuhi, ownership berpindah.
- Pembayaran dan pengiriman atau pertemuan untuk serah terima diatur langsung oleh kedua pihak. Valora tidak menyediakan checkout, menahan dana, menerbitkan resi, atau mengonfirmasi bahwa uang telah diterima pada MVP.

### 4.3 Jalur Exchange

- Pada MVP, satu Offer menukar **satu Item milik penawar dengan satu Item pada Listing**, tanpa tambahan uang. Kedua Item harus memiliki Assessment terkini dan memenuhi aturan kelayakan.
- Item penawar tidak boleh sedang reserved atau dalam Listing aktif lain. Jika Item tersebut memiliki draft Listing, draft tetap tidak dipublikasi selama reservasi.
- Saat Offer diterima, kedua Item direservasi. Masing-masing pihak mengonfirmasi telah menyerahkan Item miliknya **dan** menerima Item lawan.
- Penyelesaian menukar kedua `currentOwnerId` dan menulis peristiwa pada kedua Passport secara atomik.
- Perluasan [Exchange lanjutan](docs/32-advanced-exchange.md) mendukung 1–3 Item per pihak, tambahan uang opsional dari pemilik Listing atau penawar, counteroffer bergantian, serta riwayat revisi. Barang utama Listing tetap disertakan. Seluruh Item direservasi dan dipindahkan atomik; penyelesaian biasa menunggu laporan penyerahan/penerimaan setiap Item serta dua laporan uang bila diperlukan. Valora tidak memproses pembayaran atau memverifikasi transfer bank.

### 4.4 Jalur Donate

- Listing menampilkan kondisi dan kriteria serah terima. Pemohon dapat memberikan alasan singkat secara opsional tanpa wajib membagikan data sensitif.
- Pemilik memilih salah satu permintaan. Permintaan lain tidak dapat diterima ketika Item reserved.
- Pemberi mengonfirmasi penyerahan; penerima mengonfirmasi penerimaan. Ownership berpindah setelah kedua konfirmasi.
- Tidak ada harga jual yang tercatat pada Impact untuk donasi.

## 5. Valora Score dan Recommendation Engine

### 5.1 Definisi hasil

Empat komponen bernilai 0–100: `Condition` (30%), `Repairability` (25%), `Economic Value` (25%), dan `Reuse Potential` (20%).

`Score = round(0.30 × Condition + 0.25 × Repairability + 0.25 × Economic Value + 0.20 × Reuse Potential)`

`round` pada `score-v1` berarti pembulatan ke bilangan bulat terdekat, dengan nilai pecahan `.5` dibulatkan ke atas untuk nilai non-negatif. Rata-rata indikator dibulatkan lebih dahulu menjadi komponen bulat; Score total dihitung dari keempat komponen bulat tersebut lalu dibulatkan dengan aturan yang sama. Perhitungan server memakai snapshot dan versi aturan yang sama agar hasil dapat diulang.

Label awal: 0–39 `Low`, 40–69 `Moderate`, 70–100 `High Circular Potential`. Ambang dan rubrik memiliki `ruleVersion`; perubahan aturan tidak menulis ulang Assessment lama. Label menggambarkan indeks potensi menurut input dan rubrik, bukan mutu yang diverifikasi pihak ketiga.

### 5.2 Data dan rubrik

- Formulir kategori menentukan pertanyaan wajib untuk fungsi, kondisi fisik, kelengkapan, masalah perbaikan, perkiraan biaya perbaikan, kemungkinan digunakan kembali, dan informasi nilai pembanding.
- Setiap jawaban pilihan dipetakan ke nilai indikator tetap. Komponen dihitung dari indikator sesuai konfigurasi kategori; konfigurasi awal, rentang, alasan, dan bobotnya dapat dilihat admin. Perhitungan server memakai snapshot jawaban dan versi konfigurasi.
- Untuk `Economic Value`, nilai estimasi penjualan, biaya perbaikan, serta harga barang pembanding dicatat bersama asal informasi (`referensi kategori`, `acuan yang diberikan pengguna`, atau `estimasi pengguna`). Harga listing sendiri tidak boleh diam-diam dijadikan bukti harga pasar. Nilai ini adalah perkiraan, bukan appraisal.
- Jika data wajib fungsi, kondisi, kelengkapan, potensi penggunaan ulang, kemampuan perbaikan, atau keselamatan belum tersedia, Assessment berstatus `INCOMPLETE`; sistem menampilkan pertanyaan yang perlu dijawab dan memblokir Listing. Jika hanya data `Economic Value` yang belum lengkap, Assessment berstatus `PARTIAL_ECONOMIC`: tiga komponen lain dapat ditampilkan, sedangkan Score total dan label tidak tersedia. Donate dan Exchange dapat diajukan bila lolos aturan kelayakan dan keselamatan; Resell memerlukan Assessment `COMPLETE`. Nilai ekonomi yang hilang tidak diisi dengan nol atau AI. Draft Item dan Repair tetap dapat digunakan.
- Halaman hasil menampilkan empat komponen, data yang digunakan, sumber yang dilaporkan pengguna, versi penilaian, serta tanggal evaluasi. Informasi yang belum diverifikasi diberi label yang terlihat.

Rubrik kategori awal meliputi elektronik, furnitur, pakaian, buku, peralatan rumah tangga, peralatan olahraga, dan barang hobi. Semua kategori menggunakan empat dimensi yang sama tetapi pertanyaan fungsi dan perbaikannya disesuaikan; kategori baru diaktifkan setelah rubrik dan contoh uji disiapkan. Pada MVP, barang hobi yang dapat dinilai dan dipublikasikan dimulai dari alat musik, permainan papan, serta peralatan seni/kerajinan. Subkategori hobi lain tetap dapat disimpan sebagai draft Item dan menunggu rubrik yang diterbitkan sebelum Listing.

**Aturan awal `score-v1`:** jawaban pilihan pada formulir kategori dipetakan ke tingkat 0, 25, 50, 75, atau 100. Deskripsi setiap tingkat disesuaikan dengan kategori dan ditampilkan kepada pengguna sebelum memilih. `Condition` adalah rata-rata indikator fungsi, kondisi fisik, dan kelengkapan. `Repairability` adalah rata-rata kelayakan metode perbaikan dan ketersediaan bagian/dukungan; bila barang tidak membutuhkan perbaikan, nilainya 100. `Reuse Potential` memakai tingkat kegunaan setelah tindakan yang layak: 0 = tidak aman/tidak layak, 25 = hanya pada situasi yang sangat terbatas, 50 = berguna bagi penerima tertentu, 75 = dapat digunakan oleh banyak penerima, 100 = siap digunakan dengan kegunaan luas. Semua hasil antara memakai aturan pembulatan `score-v1` di atas.

`Economic Value` menggunakan nominal rupiah: `net = max(0, estimatedResaleValue − estimatedRepairCost)` dan rasio `net / comparableReplacementPrice` dari pembanding kategori yang dikelola admin atau referensi yang dimasukkan pengguna. Rasio 0 menghasilkan nilai 0; rasio di atas 0 sampai 0,10 menghasilkan 25; di atas 0,10 sampai 0,30 menghasilkan 50; di atas 0,30 sampai 0,60 menghasilkan 75; dan di atas 0,60 menghasilkan 100. Pembanding harus lebih besar dari nol. Ketika pemilik tidak mengetahui estimasi yang diperlukan dan tidak ada pembanding kategori, komponen ini tetap belum lengkap. Dasar dan sumber estimasi ditampilkan, sehingga pengguna mengetahui bahwa nilai ekonominya dapat bergantung pada laporan pemilik.

Rubrik ini adalah aturan produk awal untuk diimplementasikan dan diuji dengan contoh barang pada setiap kategori. Pertanyaan enam indikator, deklarasi keselamatan, dan kasus batas sembilan kategori/subkategori MVP dirinci pada [rubrik implementasi](docs/06-category-rubric-draft.md); sumber ekonomi dan batas angka pada [K02](docs/10-mvp-implementation-decisions.md#o05--sumber-nilai-ekonomi-dan-batas-formula). Admin dapat menerbitkan versi aturan berikutnya setelah ditinjau; perubahan versi tidak mengubah hasil historis.

### 5.3 Rekomendasi

Recommendation Engine menghasilkan **kelayakan dan alasan untuk setiap opsi**, lalu mengurutkan opsi yang layak. Keputusan ini menggunakan Score per komponen dan aturan keamanan/kategori; satu Score total tidak otomatis memaksakan satu tindakan.

Status setiap opsi adalah `ELIGIBLE`, `INELIGIBLE`, atau `NEEDS_DATA`. Pada Assessment `PARTIAL_ECONOMIC`, Resell berstatus `NEEDS_DATA`; Repair, Exchange, dan Donate tetap dapat dinilai dari komponen serta pemeriksaan keselamatan yang lengkap. `NEEDS_DATA` tidak disamakan dengan larangan permanen.

- **Repair:** ada masalah yang dapat ditangani dan biaya serta kebutuhan perbaikannya masuk akal menurut data yang tersedia.
- **Resell:** kondisi dapat diungkapkan dengan jujur dan barang layak ditransfer; potensi ekonomi mendukung penawaran.
- **Exchange:** Item dapat ditransfer dan berguna bagi pihak lain; preferensi pertukaran diisi saat membuat Listing.
- **Donate:** Item aman dan memiliki kegunaan bagi penerima. Nilai ekonomi tinggi tidak melarang donasi.
- **Tidak layak ditawarkan:** data keselamatan belum cukup atau Item termasuk kondisi terlarang; tampilkan alasan dan petunjuk penanganan yang sesuai. Daftar larangan dikelola admin.

Pemilik dapat memilih tindakan lain yang berstatus `ELIGIBLE`. Ketidaklayakan hanya memblokir tindakan terkait, bukan menyembunyikan Item dari pemiliknya. `recommendation-v1` mengurutkan opsi layak sebagai Repair, Resell, Exchange, Donate, lalu `NEEDS_DATA`, kemudian `INELIGIBLE`; urutan navigasi ini bukan klaim tindakan terbaik secara objektif.

Pada `recommendation-v1`, aturan awalnya: Repair layak jika ada masalah dan `Repairability ≥ 50`; Resell layak jika `Condition ≥ 50` serta `Economic Value ≥ 50`; Exchange layak jika `Reuse Potential ≥ 50`; Donate layak jika `Reuse Potential ≥ 50`. Semua opsi tersebut tetap tunduk pada pemeriksaan keselamatan dan larangan kategori. Barang yang gagal ambang masih dapat disimpan dan diperbaiki; alasan tiap opsi ditampilkan. Ambang ini adalah kebijakan produk awal yang berversi dan perlu dievaluasi dari kasus nyata, bukan bukti ilmiah bahwa tindakan tersebut selalu optimal.

## 6. Listing, Offer, dan status

### 6.1 Status Listing

`DRAFT → PENDING_REVIEW → ACTIVE → RESERVED → CLOSED`

Cabang tambahan: `PENDING_REVIEW → REJECTED`, `ACTIVE → SUSPENDED/WITHDRAWN/PAUSED`, `PAUSED → PENDING_REVIEW → ACTIVE` setelah Assessment dan moderasi ulang, serta `RESERVED → ACTIVE` ketika transaksi batal dan Item tetap layak. Listing yang berubah secara material tidak tampil sebagai penawaran aktif selama `PAUSED`.

Listing perlu snapshot Assessment, Score bila tersedia, harga atau preferensi sesuai tipe, lokasi umum, foto, metode serah terima, serta kebijakan kondisi. Admin meninjau Listing sebelum aktif. Listing Donate/Exchange dengan Assessment `PARTIAL_ECONOMIC` menampilkan bahwa Score total belum tersedia. Satu Item tidak memiliki dua Listing `ACTIVE` atau `RESERVED` sekaligus.

### 6.2 Status Offer

`PENDING → ACCEPTED / REJECTED / WITHDRAWN / EXPIRED`; untuk Resell, `PENDING ↔ COUNTERED` sampai salah satu pihak menerima harga final atau mengakhiri negosiasi. Setiap perubahan nominal membuat revisi yang tercatat. `ACCEPTED` terjadi hanya bila reservasi Item dan pembuatan Transaction berhasil.

Offer berlaku tujuh hari sejak dibuat atau revisi Counteroffer terakhir; setelah itu statusnya `EXPIRED` dan tidak dapat diterima tanpa Offer baru. Offer merujuk revisi Listing yang dilihat penawar. Perubahan material yang membuat Listing `PAUSED` mengakhiri Offer revisi lama sebagai `EXPIRED` dengan alasan `LISTING_REVISED`. Penawaran lain ketika Item telah reserved tidak dapat diterima, tetapi masa berlakunya tetap berjalan. Bila Transaction batal dan Listing kembali aktif, Offer yang belum kedaluwarsa harus divalidasi ulang sebelum dapat diterima. Tenggat ditampilkan kepada pengguna.

### 6.3 Status Transaction

`AWAITING_HANDOVER → ONE_SIDE_CONFIRMED → COMPLETED`, atau `AWAITING_HANDOVER/ONE_SIDE_CONFIRMED → CANCELLED / DISPUTED`. Pada Exchange, `ONE_SIDE_CONFIRMED` berarti belum semua konfirmasi penyerahan dan penerimaan seluruh Item lengkap, termasuk laporan tambahan uang bila disepakati. Transaksi dalam sengketa memerlukan hasil admin yang tercatat: lanjutkan proses, batalkan dan lepaskan reservasi, atau selesaikan melalui prosedur yang sama dengan jejak keputusan.

Target serah terima adalah 14 hari sejak Offer diterima, dengan pengingat dalam aplikasi pada hari ke-7 dan ke-12. Setelah target lewat, Transaction ditandai terlambat dan masuk antrean tindak lanjut admin; status, reservasi, dan ownership tidak berubah otomatis. Jika belum ada konfirmasi, satu pihak dapat meminta pembatalan dengan alasan dan pihak lain harus menyetujuinya. Jika sudah ada konfirmasi, pembatalan tetap memerlukan persetujuan formal kedua pihak atau putusan sengketa. Penolakan, tidak adanya respons, atau perbedaan fakta dapat diajukan sebagai sengketa. Pembukaan sengketa membekukan penyelesaian otomatis. Putusan admin mencatat alasan, bukti yang dirujuk, dan apakah penyelesaian terjadi melalui konfirmasi kedua pihak atau otorisasi admin; admin tidak mengganti owner melalui edit Item biasa.

Penyelesaian memeriksa kembali owner, status seluruh Item, status Listing, dan idempotency key. Perubahan Transaction, owner, Passport, serta Impact ditulis dalam transaksi database yang sesuai; kegagalan salah satu membatalkan seluruh penyelesaian. Pada Exchange lanjutan, laporan tambahan uang menjadi syarat penyelesaian biasa tetapi tetap berasal dari pengguna; pembayaran di luar Valora tidak diverifikasi sistem. Putusan admin yang sah tidak membuat laporan uang palsu.

## 7. Chat dalam MVP

### 7.1 Tujuan dan akses

Chat membantu bertanya tentang kondisi, menegosiasikan penawaran, serta mengatur serah terima. Guest harus login sebelum mengirim pesan. Satu Conversation terikat pada Listing dan pasangan pihak; Conversation dapat dihubungkan ke Offer/Transaction ketika ada kesepakatan. Pemilik tidak bisa membuat chat kepada dirinya sendiri.

### 7.2 Kemampuan wajib

- Membuka percakapan dari detail Listing yang `ACTIVE`.
- Mengirim dan menerima pesan teks, melihat urutan waktu, indikator pesan belum dibaca, daftar percakapan, dan histori berhalaman.
- Menghubungkan konteks Listing/Offer/Transaction dalam header percakapan.
- Mempertahankan chat antara dua pihak saat Listing menjadi `RESERVED` dan hingga Transaction selesai atau batal.
- Mengarsipkan percakapan yang selesai; percakapan baru tidak dapat dibuat pada Listing `CLOSED`.
- Melaporkan pesan atau pengguna; pengguna yang diblokir tidak dapat memulai pesan baru. Pembatasan spam dan frekuensi kirim berlaku.

Percakapan adalah sarana komunikasi, **bukan persetujuan sistem**. Teks seperti “saya setuju Rp400.000” tidak mengubah harga formal sampai Offer/Counteroffer disetujui pada tombol yang sesuai. Data lokasi rinci atau kontak yang dibagikan di chat terlihat hanya oleh peserta, sesuai kebijakan privasi.

Admin hanya membuka isi Conversation yang terkait laporan atau sengketa dengan alasan akses yang tercatat; admin tidak mendapat akses bebas ke semua chat melalui dashboard. Notifikasi MVP berupa unread count, indikator, dan pengingat tenggat Transaction di dalam aplikasi. Email/push notification dapat ditambahkan kemudian.

## 8. Passport dan Impact

### 8.1 Valora Passport

Setiap Item memiliki ID permanen dan timeline. Jenis event awal: `REGISTERED`, `ASSESSMENT_CREATED`, `REPAIR_RECORDED`, `LISTED`, `TRANSFERRED_BY_SALE`, `TRANSFERRED_BY_EXCHANGE`, `TRANSFERRED_BY_DONATION`, dan `CORRECTION`. Event memiliki waktu kejadian, waktu pencatatan, asal (`USER_REPORTED`, `SYSTEM_CONFIRMED`, atau `ADMIN_CORRECTED`), referensi entitas, dan tingkat visibilitas.

Tahun pembelian yang ditulis pemilik tidak boleh ditampilkan sebagai tanggal pendaftaran oleh sistem. Riwayat publik menampilkan peristiwa dan kondisi relevan tanpa nama pemilik lama, alamat, isi chat, atau biaya privat. Pemilik dapat melihat detail Item miliknya; admin melihat detail yang diperlukan untuk moderasi dengan audit akses yang sesuai. Riwayat penilaian tidak dihapus ketika penilaian baru dibuat.

Owner baru dapat melihat ringkasan Repair historis yang relevan dengan Item. Bukti foto dan catatan rinci dari owner lama hanya tersedia bila owner lama secara eksplisit menandainya untuk diteruskan; biaya privat, kontak, alamat, dan isi chat tidak berpindah bersama ownership.

Passport publik tersedia untuk Item dengan Listing `ACTIVE` atau `RESERVED`, dan tetap tersedia setelah ada Transaction `COMPLETED` pada Item tersebut. Jika Listing ditarik sebelum transfer pertama melalui Valora, akses publik ke Passport ditutup kembali tanpa menghapus event internal. Pembatasan moderasi atas riwayat publik harus memiliki alasan dan audit.

### 8.2 Valora Impact

| Metrik | Definisi awal |
| --- | --- |
| `Items Revalued` | Banyaknya Item unik yang pertama kali memperoleh Assessment lengkap dalam periode yang dipilih; total platform menghitung sekali per Item dan metrik pengguna diatribusikan kepada pembuat Assessment lengkap pertama. Assessment ulang oleh owner baru tidak menambah hitungan. |
| `Repairs Recorded` | Banyaknya RepairRecord tersimpan, diberi label sebagai laporan pengguna. |
| `Completed Transfers` | Banyaknya Transaction `COMPLETED` yang melibatkan akun; pada total platform, satu Transaction dihitung sekali. |
| `Estimated Transfer Weight` | Jumlah berat Item yang memiliki nilai berat dan berpindah pada Transaction `COMPLETED`; Exchange menghitung berat masing-masing Item. Pada ringkasan pengguna, berat diatribusikan kepada pihak yang menyerahkan Item. Label menunjukkan volume perpindahan, sehingga Item yang berpindah dua kali dapat berkontribusi dua kali. Berat tidak diketahui tidak diisi dengan angka karangan. |
| `Confirmed Sale Value` | Jumlah harga akhir Resell yang dikonfirmasi dalam Transaction selesai, diatribusikan kepada penjual; bukan bukti pembayaran diterima. Exchange dan Donate tidak menambah metrik ini. |

Metrik per pengguna dan metrik platform dipisahkan. Event penyelesaian menjadi sumber data Impact; pembatalan atau koreksi membuat penyesuaian yang dapat dilacak. Tidak ada klaim `CO₂ saved` atau `limbah yang pasti dicegah` tanpa metodologi khusus.

## 9. Admin, laporan, dan sengketa

Admin memiliki dashboard operasional berisi antrean moderasi, laporan baru, sengketa, Listing aktif/ditangguhkan, transaksi, pengguna, rubrik kategori, dan ringkasan aktivitas. Admin dapat menerima/menolak Listing dengan alasan, menangguhkan akun atau Listing, mengelola daftar kategori dan kelayakan, serta menangani laporan.

Gerbang moderasi memeriksa kelengkapan informasi keselamatan wajib lebih dulu. Setelah lengkap, kebijakan kategori membedakan kondisi **terlarang**, **perlu tinjauan khusus admin**, dan **boleh ditawarkan dengan pengungkapan kondisi**. Kondisi terlarang tidak diterbitkan; kasus meragukan masuk review dengan penanda risiko; kondisi yang boleh ditawarkan tetap menunggu persetujuan admin sebelum `ACTIVE`. Score tinggi tidak mengesampingkan aturan ini. Daftar kasus per kategori dan versi kebijakannya ada pada [kebijakan moderasi MVP](docs/09-moderation-policy-draft.md) dan [rubrik keselamatan](docs/06-category-rubric-draft.md).

Laporan dapat ditautkan ke Listing, User, Message, atau Transaction. Alur: `OPEN → IN_REVIEW → RESOLVED/DISMISSED`; hasil serta bukti dicatat. Sengketa Transaction memiliki rekaman terpisah dan tidak menghapus chat atau Passport. Admin tidak dapat mengganti current owner lewat edit profil Item biasa; penyelesaian sengketa yang berujung transfer harus melewati prosedur terotorisasi dan tercatat.

Perubahan rubrik Score berlaku untuk Assessment baru. Admin dapat memicu evaluasi ulang, tetapi Assessment lama tetap pada versinya. Setiap tindakan admin yang mengubah visibilitas, akses, atau hasil sengketa masuk `AdminAction`.

## 10. Valora AI Explainer dalam MVP

### 10.1 Tugas

Pada halaman Score, pengguna memilih **“Jelaskan hasil saya”**. Backend mengirim snapshot Assessment, komponen yang tersedia beserta kontribusinya bila Score lengkap, fakta input yang sudah dikonfirmasi, alasan rekomendasi dari rule engine, serta larangan/keterbatasan kategori. AI mengembalikan ringkasan, kekuatan Item, keterbatasan data, alasan tindakan yang disarankan, dan langkah berikutnya dalam bahasa Indonesia.

Untuk Assessment `PARTIAL_ECONOMIC`, AI hanya menerima komponen yang tersedia dan menjelaskan data ekonomi yang masih dibutuhkan. AI tidak menyimpulkan Score total atau label ketika keduanya belum dihitung sistem.

### 10.2 Batas sistem

- Score, subscore, status kelayakan, harga, dan kepemilikan ditentukan sistem berdasarkan data dan aturan; AI hanya menjelaskan.
- AI tidak membuat fakta yang tidak ada pada input, mengklaim telah memeriksa fisik barang, atau membuat perbandingan harga pasar tanpa sumber.
- Hasil AI divalidasi terhadap struktur keluaran dan nilai Assessment yang sah. Jika gagal, sistem memakai penjelasan template dari komponen serta aturan yang sama.
- Panggilan AI berlangsung dari backend; penggunaan dibatasi per pengguna/Assessment dan hasil valid dapat disimpan sementara untuk mengendalikan latensi serta biaya.
- Teks pengguna dan listing diperlakukan sebagai data, bukan instruksi untuk mengubah aturan sistem.

Analisis kondisi otomatis dari foto, tutorial AI interaktif, estimasi harga berbasis pembanding terverifikasi, dan AI Recommendation yang lebih maju masuk Future Features. Foto tetap menjadi bagian wajib dari Item dan Listing sesuai aturan kategori.

## 11. Keamanan, privasi, dan kualitas

- Validasi input dan hak akses dilakukan pada setiap operasi API. Aksi owner memeriksa `currentOwnerId` terkini.
- Unggahan foto dibatasi tipe/ukuran, diperiksa, dan tidak membocorkan metadata atau alamat yang tidak diperlukan pada tampilan publik.
- Chat dan koordinasi serah terima tersedia hanya untuk peserta; tindakan report, block, dan audit admin tersedia.
- Status, ownership, dan pembuatan Passport/Impact diuji terhadap dua offer yang diterima bersamaan, penyelesaian ganda, pembatalan, serta kegagalan di tengah Exchange.
- Sistem mencatat kesalahan dan menyediakan pesan yang dapat ditindaklanjuti ketika AI, upload, chat realtime, atau jaringan gagal. Riwayat pesan tetap dapat diambil melalui API bila koneksi realtime terputus.
- Tampilan desktop dan seluler responsif, dengan label status dan alasan tindakan yang dapat dibaca.

## 12. Arah UI dan teknis

### 12.1 Prinsip visual

**Arah desain:** editorial marketplace dengan foto besar, navigasi sederhana, ruang putih yang lapang, judul tegas, sudut membulat, dan grid rapi. Referensi pengguna menjadi dasar komposisi, dengan identitas putih/hijau/cream Valora dan berbagai kategori barang. Cara Kerja serta Impact memakai tata letak yang sesuai dengan informasi masing-masing. [Design system MVP](docs/08-design-system.md) menjelaskan migrasi; [DESIGN.md](apps/web/DESIGN.md) mencatat token yang telah dikodekan.

**Aturan visual wajib:**

- **Tanpa shadow** pada kartu, header, tombol, dropdown, dialog, serta panel dashboard. Pemisahan memakai ruang kosong, perbedaan latar yang halus, atau garis 1 px.
- **Sudut membulat terukur.** Kontrol/foto kecil memakai radius 12 px, kartu/panel 16 px, dan hero 24 px (20 px pada ponsel). Tombol dan filter kategori berbentuk pill. Kanvas halaman, header, dan footer memakai radius 0. Hindari glassmorphism, blur dekoratif, dan gradient mencolok.
- **Kanvas publik memenuhi layar.** Halaman memakai lebar 100%, margin luar 0, serta tanpa border atau bingkai rounded besar. Isi mengikuti lebar layar dengan gutter 24 px di desktop/tablet dan 16 px di ponsel. Dashboard admin boleh sekitar 1.360 px untuk tabel dengan gutter yang jelas.
- **Navbar publik sticky.** Header tetap di tepi atas dengan latar putih tanpa border atau shadow; lingkaran tipis ikon dipertahankan. Sisi kanan memakai dua tautan teks serta ikon bulat pengingat, penawaran, dan akun. Ikon memiliki area interaksi 44 px; tautan privat tamu menuju login dengan tujuan kembali. Tautan teks tersedia dalam menu pada ponsel, sedangkan ikon tetap terlihat.
- White menjadi permukaan halaman, Cream menjadi aksen panel editorial, serta Sage menjadi bidang sekunder. Paragraf panjang menggunakan kolom baca yang lebih sempit.
- Hirarki terbentuk dari tipografi, foto, ritme antarbagian, dan alignment. Elemen visual hiasan digunakan sedikit; antarmuka tidak bergantung pada dekorasi untuk menunjukkan status.
- Foto produk menampilkan barang sebenarnya dengan crop konsisten. Kondisi, harga, jenis listing, dan Score terlihat jelas tanpa menutupi foto dengan banyak label promosi.

### 12.2 Token desain MVP

| Token | Nilai | Penggunaan |
| --- | --- | --- |
| Forest / Ink | `#1B3A28` | Navigasi aktif, teks utama penting, tombol primer. |
| Green | `#2D5E3A` | Aksen sekunder terukur. |
| Muted | `#5B6D60` | Keterangan tambahan. |
| Cream | `#F5F3EE` | Latar section editorial yang halus. |
| White | `#FFFFFF` | Permukaan konten dan form. |
| Sage | `#DDE6D8` | Latar informasi sekunder. |
| Lime | `#D2E2A9` | Aksen kecil seperti indikator; gunakan teks gelap di atasnya. |
| Line | `#CAD4C7` | Pemisah, garis tabel, dan border input. |
| Surface line | `#E2E8DF` | Garis halus pada kartu, kontrol, dan pemisah publik baru. |
| Soft sage | `#EDF1EA` | Bidang editorial Passport dan ringkasan pendukung. |
| Danger | `#A33A2B` | Status kesalahan dengan teks/ikon eksplisit. |
| Warning text | `#8C5A10` | Teks peringatan yang terbaca di atas Cream/White. |
| Info | `#315B72` | Status informasi dengan teks/ikon eksplisit. |

Warna status kesalahan, peringatan, dan keberhasilan harus tetap mudah dibedakan dan dilengkapi teks atau ikon. Semua peran teks memakai `Plus Jakarta Sans`: isi dan metadata berbobot 500, label/tombol 600, serta judul dan angka utama 700. Teks isi 14–16 px dengan jarak baris lapang; variasi ukuran dan font dijaga sedikit. Spasi menggunakan skala konsisten 8, 16, 24, 32, 48, 64, dan 96 px. Angka Score dapat besar tanpa dekorasi gauge yang rumit. Badge “TERVERIFIKASI” tanpa objek verifikasi yang nyata dan dijelaskan tidak boleh ditampilkan.

### 12.3 Layout responsif dan komponen

- **Desktop:** kanvas publik `width: 100%` dengan tinggi minimum satu viewport; isi `width: calc(100% - 48px)` tanpa batas maksimum. Preview Listing tiga kolom dengan filter kategori pill di atas grid.
- **Tablet:** hingga 1.023 px, gutter isi 24 px; preview Listing dua kolom.
- **Ponsel:** hingga 639 px, permukaan putih selebar viewport dengan isi bergutter 16 px; preview Listing satu kolom. Kategori dapat digeser di dalam barisnya tanpa membuat halaman scroll horizontal. Harga, kondisi, dan tombol tindakan tetap mudah ditemukan.
- **Header:** logo Valora dan navigasi ringkas dalam container yang sama dengan konten; tanpa shadow atau bar mengambang. Pemisah tipis dapat dipakai ketika perlu.
- **Kartu Item:** foto berasio konsisten, kategori/jenis listing kecil, judul, kondisi, harga jika relevan, dan Valora Score dengan label `menurut data pemilik` bila belum diverifikasi. Jika Score total belum tersedia pada Donate/Exchange, tampilkan status tersebut secara eksplisit tanpa angka pengganti. Kartu rata tanpa shadow; hover memakai perubahan border/warna atau garis bawah, bukan elevasi.
- **Tombol dan form:** tombol primer Forest, tombol sekunder outline, input bergaris tipis dengan radius 12 px, serta fokus keyboard terlihat jelas. Tombol memakai bentuk pill; CTA hero primer putih di atas foto hijau gelap.
- **Status:** label kecil dengan teks yang eksplisit (`ACTIVE`, `RESERVED`, `COMPLETED`, dan sebagainya). Jenis Listing memakai pill kecil. Jangan mengandalkan warna saja.

Tahap redesign pertama menerapkan pola ini pada Beranda, Cara Kerja, dan Impact publik melalui `PublicShell` serta CSS `.valora-surface`. Market penuh, akun, dan dashboard masih memakai layout sebelumnya sampai tahap masing-masing; tautan kategori dari Beranda sudah menginisialisasi filter Market.

### 12.4 Pola per halaman

| Halaman | Pola layout |
| --- | --- |
| Landing | Hero foto berbagai barang di dalam container dengan CTA Market; pengantar, dua panel care/Passport, kategori dan Listing aktif dari API, empat langkah, serta CTA pencatatan barang. |
| Market | Judul singkat, pencarian dan filter yang mudah dibaca, grid Item datar dengan foto sebagai fokus. Informasi barang bekas dan jenis transaksi mengutamakan kejelasan dibanding badge promosi. |
| Detail Listing | Dua kolom: galeri foto di kiri, informasi kondisi, Score, harga/preferensi, dan CTA chat/offer di kanan. Konten turun menjadi satu kolom di ponsel. |
| User Dashboard | Ringkasan barang dan tindakan berikutnya, status offer dan chat belum dibaca, lalu Passport/Impact. Gunakan baris, tabel, dan panel datar dengan pemisah tipis; setiap angka memiliki konteks. |
| Valora Score | Angka utama, empat komponen yang dapat ditelusuri, alasan rekomendasi, label asal data, lalu tombol tindakan. AI Explainer hadir sebagai bagian penjelasan yang tenang, bukan widget mengambang. |
| Passport | Timeline vertikal rapi dengan tanggal, jenis peristiwa, dan label sumber (`dilaporkan pemilik` atau `tercatat sistem`). Informasi privat tidak masuk tampilan publik. |
| Impact | Angka dan definisi metrik dalam blok datar; catatan `estimasi` terlihat pada berat/nilai yang dilaporkan. Hindari visual yang menyiratkan klaim CO₂ tanpa data. |
| Chat | Dua panel pada desktop: daftar percakapan dan isi pesan, dipisahkan garis tipis. Pada ponsel, daftar dan percakapan menjadi dua layar. Hubungan dengan Listing/Offer/Transaction terlihat pada header. |
| Admin Dashboard | Sidebar sederhana, ringkasan antrean, tabel dan filter yang padat namun terbaca. Status dan aksi moderasi jelas; gaya visual sama dengan halaman publik tanpa memaksakan foto dekoratif pada area kerja. |

### 12.5 Kriteria pemeriksaan UI

Periksa desktop 1.440 px, layar lebar 1.920 px, tablet 768 px, dan ponsel 390 px. Kanvas memenuhi layar dengan gutter sesuai; tidak ada scroll horizontal halaman atau elemen penting yang terpotong. Komponen memakai `box-shadow: none`, radius sesuai peran, fokus keyboard terlihat, dan hierarki yang dipahami tanpa warna. CTA hero tetap terlihat pada layar awal ponsel. Periksa loading, data kosong, kegagalan API/foto, judul panjang, harga rupiah, serta metrik Impact yang belum tersedia. Foto, kondisi, jenis Listing, harga, dan disclosure Score dibaca tanpa klaim verifikasi tambahan.

### 12.6 Arah teknis

**Stack yang direncanakan:** Next.js + TypeScript; NestJS + TypeScript; PostgreSQL; Prisma; REST + OpenAPI; TanStack Query; React Hook Form + Zod; Tailwind CSS + shadcn/ui; Cloudinary. Chat memakai API untuk histori dan jalur realtime dengan fallback pemuatan ulang. Backend memisahkan modul Auth, Items, Assessments, Repairs, Listings, Offers, Chat, Transactions, Passport, Impact, Reports, Admin, dan AI Explainer. Perpindahan ownership serta event turunannya memakai satu transaksi database dengan perlindungan konflik.

## 13. Cakupan MVP dan Future Features

**MVP wajib:** Authentication; peran User/Admin; dashboard terpisah; Item dan foto; Assessment serta Score deterministik; Recommendation; Repair Record; Market dengan pencarian dan filter; Listing Resell/Exchange/Donate; Offer dan Counteroffer Resell; Chat serta unread count; Transaction dan koordinasi serah terima; ownership transfer; Passport; Impact; report, sengketa, dan moderasi admin; AI Explainer dengan fallback template.

Untuk penilaian lomba, alur MVP harus dapat didemonstrasikan dengan akun dan data contoh yang diberi label sebagai data demo. Status transaksi, statistik, dan metrik Impact dalam demonstrasi berasal dari data aplikasi yang dijalankan, bukan angka pemasaran yang dikarang. Paket demo dan cara akses juri dirancang dari kebutuhan karya saat ini; bila panduan lomba diberikan kemudian, keduanya dapat disesuaikan. Kesiapan menerima transaksi nyata menjadi keputusan terpisah.

**Future Features:** payment gateway/escrow; integrasi pengiriman; marketplace jasa repair; notifikasi email/push; lampiran chat tambahan; gamification, badge, dan community challenge; peta; tutorial repair AI interaktif berbasis konten terkurasi; estimasi harga dari data pembanding.

**Perluasan Exchange lanjutan:** paket 1–3 Item per pihak, tambahan uang opsional, counteroffer bergantian, riwayat immutable, reservasi seluruh barang dan konfirmasi uang oleh pemberi/penerima. Batas pembayaran manual, migrasi dan kontrak OpenAPI 1.17.0 tercatat pada [Exchange lanjutan](docs/32-advanced-exchange.md).

**Perluasan setelah MVP:** Favorit menyimpan Listing privat di akun, menyediakan
tombol hati dan halaman `/app/favorit`, serta mempertahankan nama saat disimpan
ketika Listing tidak tersedia tanpa membuka detail/foto lama. Perilaku, batas,
kontrak, dan verifikasi ada pada [fitur Favorit](docs/23-favorites.md). Fitur ini
tidak mengubah cakupan wajib MVP tahap 1–6. Koleksi bernama, pencarian tersimpan,
dan pemberitahuan perubahan harga menjadi pengembangan berikutnya.

**Perluasan pusat notifikasi:** riwayat privat aktivitas penawaran dan transaksi,
preview lonceng desktop/mobile, filter, dan penandaan dibaca. Pengingat MVP
tetap tersedia; email/push dan notifikasi pesan/moderasi belum termasuk.
Lihat [Pusat Notifikasi](docs/24-notification-center.md).

**Perluasan Passport QR:** pemilik dapat menyimpan QR sejak barang didaftarkan;
pengunjung dapat berbagi Passport publik yang dapat diakses. QR hanya berisi
tautan kanonis barang, tetap sama lintas pemilik, serta menyediakan salin
tautan dan unduh PNG. Kelayakan publik dan pembatasan moderasi tetap berlaku.
Konfigurasi domain dan verifikasi ada pada [Passport QR](docs/25-passport-qr.md).

Pada MVP, pilihan metode pembayaran dan serah terima hanya dicatat sebagai kesepakatan/koordinasi para pihak; Valora tidak memproses atau memverifikasi keduanya. Tampilan Transaction harus menjelaskan batas ini sebelum para pihak mengonfirmasi.

Penyusunan implementasi mengikuti dependensi data dan status agar seluruh fitur MVP bekerja sebagai satu produk: domain Item dan Assessment → Listing/Offer/Chat → Transaction/ownership → Passport/Impact → moderasi dan pengujian alur ujung ke ujung. Urutan ini bukan pemotongan cakupan MVP.

## 14. Kriteria penerimaan produk

1. **Penilaian:** input sama dan `ruleVersion` sama menghasilkan komponen, Score bila lengkap, serta rekomendasi yang sama; Assessment tidak lengkap tidak menampilkan angka rekaan. `PARTIAL_ECONOMIC` dapat dipakai untuk Donate/Exchange yang lolos pemeriksaan lain, tetapi tidak untuk Resell; Score total tetap kosong sampai lengkap.
2. **AI:** penjelasan merujuk pada komponen serta input yang benar; tidak mengubah Score; fallback tetap memberi penjelasan saat layanan AI gagal.
3. **Repair:** kondisi dapat diperbarui, Assessment baru dibuat jika input penilaian berubah, owner tetap, dan Passport memuat event berlabel laporan pemilik.
4. **Resell:** pengguna lain mengirim offer, bernegosiasi melalui fitur formal, kedua pihak mengonfirmasi serah terima, owner berubah sekali, dan Passport/Impact bertambah sesuai definisi.
5. **Exchange:** dua Item memenuhi syarat dan direservasi; penyelesaian menukar kedua owner dan menulis dua Passport; kegagalan salah satu operasi tidak meninggalkan transfer sepihak.
6. **Donate:** pemilik memilih satu permintaan, kedua pihak konfirmasi, owner berpindah, dan nilai penjualan tidak bertambah.
7. **Chat:** kedua pihak dapat mengirim serta membaca pesan sebelum offer dan selama transaksi; unread count bekerja; user lain tidak dapat membaca percakapan; isi chat tidak mengubah kesepakatan formal.
8. **Konflik:** dua offer tidak dapat diterima bersamaan untuk Item yang sama; pembatalan melepaskan reservasi; permintaan completion berulang tidak menggandakan event.
9. **Admin:** Listing dengan informasi keselamatan wajib yang kosong tertahan; kondisi terlarang tidak terbit; kasus meragukan ditandai untuk review khusus; kondisi yang boleh ditawarkan mengungkap kekurangannya; semua Listing menunggu persetujuan admin. Laporan chat/listing dapat diproses; sengketa dan tindakan admin menghasilkan alasan serta audit.
10. **Privasi dan klaim:** Passport publik tidak menampilkan identitas pemilik terdahulu atau detail chat; Impact mengikuti definisi metrik dan menandai angka estimasi serta laporan pengguna.
11. **Batas transaksi MVP:** tidak ada checkout atau integrasi kurir; harga final Resell tersimpan sebagai kesepakatan, bukan bukti pembayaran; konfirmasi serah terima berasal dari para pihak dan sengketa dapat dilaporkan.

## 15. Indikator hasil setelah produk digunakan

Selain keberhasilan teknis, pantau jumlah Item dengan Assessment lengkap, persentase Item yang berlanjut ke Repair atau Listing, percakapan yang menghasilkan Offer, rasio Offer diterima menjadi Transaction selesai, jumlah transaksi bermasalah, jumlah sengketa yang terselesaikan, penggunaan dan kegagalan AI Explainer, serta tingkat koreksi data kondisi oleh pengguna. Target numerik ditentukan setelah data penggunaan awal tersedia; PRD tidak mengklaim besaran dampak yang belum terukur.

**Perluasan Pencarian Tersimpan:** pengguna dapat menyimpan kriteria Market privat
dan menerima satu notifikasi per listing yang pertama kali terbit dan cocok.
Pengelolaan dasar, watermark aktivasi, serta pemrosesan antrean persisten
dicatat pada [Pencarian Tersimpan](docs/26-saved-searches.md).

**Perluasan Profil Publik dan Ulasan:** akun aktif memiliki profil berisi identitas
minimal, barang aktif, dan pengalaman dari transaksi selesai. Foto publik opsional
dan dinonaktifkan secara default. Pembeli/penerima mengulas penjual/donor; Exchange
mengizinkan kedua peserta mengulas, sekali dalam 30 hari sejak selesai. Rating
1–5 wajib, komentar opsional, dan satu balasan final tersedia. Privasi, koreksi,
laporan, moderasi serta retensi dicatat pada
[Profil Publik dan Ulasan](docs/27-public-profiles-reviews.md).


**Perluasan Chat:** teks dan maksimal tiga foto privat per pesan, tanda dibaca
berdasarkan pesan terlihat, notifikasi yang dikelompokkan per percakapan,
dan profil publik dari header chat. Pengiriman idempoten, pemulihan respons,
bukti kasus serta retensi dicatat pada [Peningkatan Chat](docs/28-chat-enhancements.md).


**Perluasan koordinasi serah terima:** peserta dapat mengusulkan dan menyepakati jadwal/lokasi atau perkiraan penerimaan dengan alamat privat per penerima. Tenggat tetap 14 hari; konfirmasi formal mengunci koordinasi dan tetap menjadi dasar transfer kepemilikan. Resi manual beralasan, linimasa transaksi, pengingat 24/2 jam, akses admin lima menit serta retensi terdokumentasi pada [Koordinasi Serah Terima](docs/29-handover-coordination.md).

**Perluasan AI Explainer:** penjelasan manual dari hasil penilaian terstruktur melalui gateway 9router, tanpa identitas/teks bebas. Score dan kelayakan tetap berasal dari aturan Valora. Kuota default 20/pengguna/hari dan 200/global/hari, cache 24 jam, fallback rubrik, serta ACL dan pemeriksaan state sebelum respons dicatat pada [AI Explainer](docs/30-ai-explainer.md).

**Perluasan Analisis Foto AI:** bantuan manual pada formulir barang baru/edit untuk nama, kategori/subkategori, deskripsi dan kondisi/kendala visual dari 1–3 foto. Saran dipilih per kolom dan diterapkan ke formulir sebelum disimpan; fungsi, keamanan, harga dan Score tidak disimpulkan. Foto terpilih tanpa metadata serta katalog aktif dikirim ke 9router. Kuota harian dan kapasitas generasi dibagi dengan AI Explainer, cache privat 24 jam dan pemeriksaan izin/state sebelum respons; rincian pada [Analisis Foto AI](docs/31-ai-photo-analysis.md).


## Perluasan: panduan perawatan & perbaikan interaktif

Enam panduan bawaan berversi tersedia untuk pemilik barang tanpa Assessment wajib. Sesi privat menyimpan persiapan, progres, jeda, foto dan pertanyaan. AI memilih penjelasan dari katalog; pengguna menandai tindakan dan meninjau hasil sebelum pencatatan. Mulai mengerjakan menjeda Listing dan mengakhiri penawaran terkait; Market ditahan selama sesi berjalan. MAINTENANCE dibedakan dari REPAIR dan tidak menambah REPAIRS_RECORDED. Sesi tidak berpindah kepada pemilik baru. Rincian kontrak, privasi, retensi, rollout dan batas pemeriksaan ada pada [docs/33-ai-repair-tutorials.md](docs/33-ai-repair-tutorials.md).
