# Rubrik kategori `score-v1` untuk MVP

**Status:** spesifikasi implementasi O05–O06 untuk MVP lomba, 28 September 2026. Kontrak Score berasal dari PRD; rincian formulir dan kasus batas di bawah adalah baseline rancangan. [Matriks moderasi kasus awal](09-moderation-policy-draft.md) sudah disetujui. Semua konfigurasi yang dipakai Assessment disimpan sebagai versi immutable.

## Kontrak penilaian yang sudah diputuskan PRD

Setiap Assessment menyimpan snapshot jawaban, asal data, versi rubrik kategori, dan waktu. Indikator pilihan dipetakan ke `0`, `25`, `50`, `75`, atau `100`. Empat komponen adalah `Condition`, `Repairability`, `Economic Value`, dan `Reuse Potential` dengan bobot `30/25/25/20`. Assessment `COMPLETE` menghasilkan Score dan label; jika hanya ekonomi yang kurang, `PARTIAL_ECONOMIC` menampilkan tiga komponen tanpa Score total. Jika data non-ekonomi atau keselamatan kurang, statusnya `INCOMPLETE` dan Listing diblokir.

Form kategori wajib menghasilkan data untuk enam indikator berikut, ditambah deklarasi risiko dan data ekonomi. Pertanyaan dapat memakai bahasa yang berbeda per kategori, tetapi arti dan pemetaan nilainya harus tetap terdokumentasi dalam versi rubrik.

| Indikator | Dipakai oleh | Isi yang harus ditangkap |
| --- | --- | --- |
| Fungsi | Condition | Sejauh mana fungsi utama barang berjalan pada kondisi sekarang. |
| Kondisi fisik | Condition | Kerusakan/keausan yang dapat diamati dan dilaporkan. |
| Kelengkapan | Condition | Bagian yang diperlukan untuk penggunaan normal. |
| Metode perbaikan | Repairability | Kelayakan tindakan perbaikan untuk masalah yang dilaporkan. |
| Dukungan perbaikan | Repairability | Ketersediaan bagian, bahan, keahlian, atau rujukan yang dibutuhkan. |
| Kegunaan setelah tindakan layak | Reuse Potential | Seberapa berguna barang bagi penerima setelah tindakan yang realistis dan diungkapkan. |

Jika barang tidak membutuhkan perbaikan, `Repairability = 100` sesuai PRD dan pertanyaan metode/dukungan diberi alasan `NOT_NEEDED`, bukan nilai hasil tebakan. Jika perbaikan diperlukan, dua indikator Repairability wajib dijawab. Deklarasi risiko/kondisi terlarang diproses **sebelum** kelayakan Listing; Score tinggi tidak mengesampingkan larangan. Jawaban “tidak tahu” pada data keselamatan membuat Listing `INCOMPLETE` atau memerlukan review yang ditentukan kebijakan kategori, bukan dianggap aman.

## Lima pilihan indikator

Enam indikator memakai lima pilihan tetap pada tabel di bawah. Setiap pilihan ditampilkan dengan objek kategori/subkategori dari matriks istilah berikutnya, sehingga pengguna membaca keadaan barangnya, bukan angka Score. Angka hanya disimpan sebagai hasil pemetaan jawaban.

| Nilai | Fungsi | Kondisi fisik | Kelengkapan |
| ---: | --- | --- | --- |
| 0 | Fungsi inti tidak berjalan. | Kerusakan berat; pemakaian tidak layak tanpa penanganan. | Bagian inti yang diperlukan tidak ada. |
| 25 | Sebagian besar fungsi inti gagal. | Kerusakan besar yang menghalangi penggunaan normal. | Beberapa bagian penting tidak ada. |
| 50 | Fungsi sebagian berjalan dengan batas yang jelas. | Kerusakan sedang; masih dapat dipakai dengan batasan yang diungkapkan. | Ada bagian pendukung yang hilang dan memengaruhi penggunaan. |
| 75 | Fungsi utama berjalan dengan masalah kecil. | Keausan/kerusakan ringan. | Bagian inti lengkap; aksesori kecil mungkin tidak ada. |
| 100 | Fungsi berjalan sesuai tujuan. | Tidak ada kerusakan berarti yang dilaporkan. | Semua bagian yang dinyatakan wajib untuk penggunaan normal tersedia. |

| Nilai | Metode perbaikan | Dukungan perbaikan | Kegunaan setelah tindakan layak |
| ---: | --- | --- | --- |
| 0 | Belum ada cara perbaikan yang layak berdasarkan data. | Bagian/bahan/keahlian yang diperlukan tidak tersedia menurut data. | Tidak layak atau tidak aman ditawarkan. |
| 25 | Cara perbaikan sangat tidak pasti atau hanya untuk kasus khusus. | Dukungan sulit diperoleh dan belum jelas. | Berguna hanya dalam situasi sangat terbatas. |
| 50 | Perbaikan mungkin dilakukan, tetapi memerlukan usaha/biaya yang perlu dijelaskan. | Dukungan mungkin ada tetapi belum pasti. | Berguna bagi penerima tertentu. |
| 75 | Metode perbaikan jelas dengan kebutuhan yang wajar. | Bagian/bahan/keahlian relatif mudah diakses. | Dapat digunakan oleh banyak penerima. |
| 100 | Tindakan perbaikan sederhana dan jelas, atau tidak diperlukan. | Dukungan tersedia jelas, atau tidak diperlukan. | Siap digunakan dengan kegunaan luas. |

Nilai pada tabel adalah **indeks rubrik berdasarkan laporan pengguna**, bukan hasil inspeksi teknisi. Jangkar `0` pada kegunaan tidak otomatis menentukan metode pembuangan; kebijakan kategori harus memberi petunjuk penanganan yang sesuai tanpa klaim keselamatan yang belum diverifikasi.

## Istilah dan objek pertanyaan per kategori

Tabel ini menetapkan objek bagi keenam indikator. Form menampilkan pertanyaan `Sejauh mana [objek] ...?` bersama **lima kalimat pilihan** dari tabel jangkar. Contoh: untuk Elektronik/Fungsi, pilihan 0 berbunyi “Fungsi inti perangkat tidak berjalan” dan pilihan 75 “Fungsi utama perangkat berjalan dengan masalah kecil”. Frasa pada tabel ini menggantikan kata “barang”/“fungsi inti” pada jangkar; versi rubrik menyimpan teks yang telah dirender sehingga hasil historis tidak berubah ketika copy diperbarui.

| Kategori | Fungsi | Kondisi fisik | Kelengkapan | Metode perbaikan | Dukungan perbaikan | Kegunaan setelah tindakan |
| --- | --- | --- | --- | --- | --- | --- |
| Elektronik | fungsi utama perangkat, termasuk daya dan kontrol | bodi, port, dan komponen terpasang | komponen wajib agar perangkat dapat digunakan | tindakan servis masalah yang dilaporkan | suku cadang atau teknisi untuk tindakan itu | penggunaan perangkat oleh pemilik berikutnya |
| Furnitur | fungsi duduk/simpan/kerja sesuai jenis | rangka, sambungan, dan permukaan | bagian penopang dan pengikat wajib | tindakan memperbaiki sambungan/struktur/finishing | bahan dan keahlian furnitur | penggunaan pada ruang berikutnya |
| Pakaian | fungsi pakai sesuai jenis dan ukuran | kain, jahitan, serta penutup | pasangan/bagian wajib dari pakaian | tindakan jahit atau penggantian bagian | bahan dan jasa jahit | pemakaian oleh penerima dengan ukuran sesuai |
| Buku | keterbacaan dan penggunaan isi | halaman, jilid, sampul, serta kelembapan | halaman/volume inti | perbaikan jilid atau halaman | bahan dan jasa perbaikan buku | penggunaan isi oleh pembaca berikutnya |
| Peralatan rumah tangga | fungsi utama alat sesuai subjenis | bodi, bagian panas/daya, dan sambungan | bagian wajib untuk operasi normal | servis sesuai sumber daya alat | suku cadang/teknisi sesuai subjenis | pemakaian rumah tangga berikutnya |
| Peralatan olahraga | fungsi menurut cabang olahraga | struktur, pengikat, dan keausan | bagian pelindung/penahan beban yang wajib | tindakan perbaikan sesuai jenis alat | bagian dan keahlian yang sesuai | penggunaan olahraga berikutnya |
| Hobi — alat musik | menghasilkan suara/kontrol sesuai instrumen | badan, senar/tuts, dan sambungan | bagian wajib untuk dimainkan | penyeteman atau perbaikan komponen | suku cadang dan teknisi instrumen | pemakaian oleh pemain berikutnya |
| Hobi — permainan papan | dapat dimainkan menurut aturan inti | papan, kartu, token, dan kotak | komponen inti sesuai daftar isi | penggantian/perbaikan komponen | komponen pengganti atau cetak ulang yang layak | permainan lengkap bagi penerima |
| Hobi — seni/kerajinan | alat/bahan dapat dipakai sesuai label | alat kerja, wadah, dan kemasan bahan | bagian alat/bahan yang diperlukan | perbaikan alat atau penanganan bahan | komponen dan keahlian sesuai bahan | penggunaan kreatif berikutnya |

**Keputusan subkategori Hobi awal:** alat musik, permainan papan, dan peralatan seni/kerajinan. Barang koleksi dan subkategori lain dapat disimpan sebagai draft, tetapi belum dapat dipublikasikan sampai rubrik tersendiri diterbitkan. Pilihan lima tingkat memakai jangkar yang sama dengan objek spesifik di atas; `HOBBY` tanpa subkategori tidak dapat menghasilkan Assessment untuk Listing.

## Data ekonomi dalam rupiah

Form meminta `estimatedResaleValue`, `estimatedRepairCost`, `comparableReplacementPrice > 0`, serta asal setiap angka: acuan kategori admin yang diterbitkan, acuan yang diberikan pengguna, atau estimasi pengguna. Harga Listing tidak boleh otomatis menjadi pembanding. Bila barang tidak memerlukan Repair, biaya repair yang digunakan dalam formula adalah `Rp0` dengan alasan `NOT_NEEDED`; selain itu perkiraan biaya harus memiliki sumber atau tetap belum lengkap. Rasio dan tingkat `Economic Value` mengikuti tabel pada [aturan domain](03-domain-and-scoring.md#assessment-dan-score) dan [kasus batas O05](10-mvp-implementation-decisions.md#o05--sumber-nilai-ekonomi-dan-batas-formula).

**Aturan pembulatan yang ditetapkan:** rata-rata komponen dibulatkan ke bilangan bulat terdekat dengan `.5` ke atas; total dihitung dari komponen yang sudah dibulatkan lalu dibulatkan dengan aturan sama. Semua operasi nominal memakai bilangan bulat rupiah. Versi rubrik/aturan yang telah diterbitkan tidak diedit di tempat; perubahan membuat versi baru.

## Contoh uji perhitungan — barang elektronik

Contoh fiktif keyboard berdasarkan input pengguna: fungsi `75`, fisik `50`, kelengkapan `100`, metode repair `50`, dukungan `75`, kegunaan ulang `75`. Estimasi jual `Rp450.000`, biaya repair `Rp50.000`, pembanding `Rp800.000`; ketiganya harus disertai sumber dan tidak dianggap harga pasar terverifikasi.

```text
Condition = round((75 + 50 + 100) / 3) = 75
Repairability = round((50 + 75) / 2) = 63
Economic Value: (450000 - 50000) / 800000 = 0,50 -> 75
Reuse Potential = 75
Score = round(0,30×75 + 0,25×63 + 0,25×75 + 0,20×75) = 72
Label = High Circular Potential
```

Jika hanya angka ekonomi tidak tersedia, tiga komponen di atas tetap tampil, `score = null`, dan Resell `NEEDS_DATA`. Exchange/Donate dapat `ELIGIBLE` bila pemeriksaan keselamatan serta aturan kategorinya lulus. Contoh ini tidak membuktikan kondisi fisik keyboard.

## Pertanyaan keselamatan wajib dan hasil awal

Setiap baris adalah satu kelompok deklarasi wajib. Untuk setiap pertanyaan, pilihan adalah `TIDAK`, `YA`, atau `TIDAK_TAHU`; `TIDAK_TAHU` menahan pengajuan dengan `SAFETY_DATA_MISSING`. `YA` pada kondisi terlarang memblokir pengajuan; `YA` pada pemicu review khusus menandai antrean admin; kondisi yang diizinkan harus muncul sebagai pengungkapan pada Listing. Pertanyaan hanya muncul bila relevan dengan subjenis, tetapi subjenis itu sendiri wajib diisi.

| Kategori/subkategori | Pertanyaan wajib yang membedakan kasus | Terlarang / review khusus / pengungkapan |
| --- | --- | --- |
| Elektronik | Sumber daya dan jenis baterai? Ada baterai menggembung atau kabel terbuka? Ada panas/daya tidak stabil? Fungsi dan aksesori wajib apa yang hilang? | Menggembung/terbuka → terlarang; panas/daya tak stabil → review; goresan/aksesori opsional hilang → ungkap. |
| Furnitur | Apakah rangka penyangga stabil dan utuh? Ada perbaikan struktur terdahulu? Ada kerusakan hanya pada permukaan? | Rangka patah/tidak stabil → terlarang; kekuatan repair tak jelas → review; lecet/warna pudar → ungkap. |
| Pakaian | Sudah dibersihkan? Ada kontaminasi belum ditangani? Noda/kerusakan bahan atau jahitan apa yang tersisa? | Kontaminasi belum ditangani → terlarang; kebersihan/noda tak jelas → review; pudar/jahitan kecil → ungkap. |
| Buku | Ada jamur yang masih tumbuh atau kondisi lembap? Halaman inti lengkap dan terbaca? Ada anotasi/sampul aus? | Jamur aktif → terlarang; halaman inti atau lembap tak jelas → review; anotasi/sampul aus → ungkap. |
| Peralatan rumah tangga | Jenis sumber daya: listrik, gas, panas, atau manual? Ada kebocoran gas/komponen listrik terbuka? Fungsi panas/daya stabil? | Kebocoran/komponen terbuka → terlarang; sumber daya atau fungsi tidak jelas → review; penyok kosmetik → ungkap. |
| Peralatan olahraga | Apakah alat pelindung/penahan beban? Struktur dan pengikat utuh? Ada benturan berat atau umur pakai yang tidak jelas? | Struktur pelindung/penahan beban rusak → terlarang; riwayat benturan/umur pakai tak jelas → review; lecet barang nonpelindung → ungkap. |
| Hobi — alat musik | Apakah instrumen bertenaga listrik? Ada komponen listrik terbuka? Ada retak struktur/fungsi tidak konsisten atau repair belum dijelaskan? | Komponen terbuka → terlarang; retak/fungsi/repair belum jelas → review; lecet/penyeteman → ungkap. |
| Hobi — permainan papan | Berapa komponen inti menurut daftar? Ada komponen inti hilang? Apakah foto, daftar, dan deskripsi cocok? | Komponen inti hilang → terlarang; jumlah berbeda → review; kotak aus/kartu sedikit tertekuk → ungkap. |
| Hobi — seni/kerajinan | Jenis bahan dan labelnya diketahui? Kemasan/isi jelas? Ada bagian kerja alat yang rusak dan berisiko? | Bahan tak teridentifikasi/alat berisiko → terlarang; kemasan/isi/foto berbeda → review; keausan kosmetik → ungkap. |

Kasus `YA` yang terlarang tidak menjadi `INCOMPLETE` hanya karena hasilnya buruk: Assessment dapat merekam indikator yang lengkap, tetapi rekomendasi transfer `INELIGIBLE` dan Listing ditolak. Kasus `TIDAK_TAHU` pada deklarasi keselamatan membuat Assessment `INCOMPLETE` sampai dijelaskan. Jika foto bertentangan dengan deklarasi yang lengkap, masukkan review khusus; admin tidak menyatakan inspeksi fisik telah dilakukan.

## Kasus batas penerimaan rubrik

1. Elektronik dengan enam indikator tinggi tetapi baterai dilaporkan menggembung: Score boleh dihitung dari jawaban lengkap, namun semua Listing `INELIGIBLE` karena larangan keselamatan.
2. Furnitur stabil dengan lecet permukaan: dapat diajukan dengan pengungkapan, tetap menunggu review admin.
3. Buku dengan jawaban jamur `TIDAK_TAHU`: `INCOMPLETE`, bukan aman dan bukan review biasa.
4. Peralatan olahraga pelindung dengan riwayat benturan belum jelas tetapi pertanyaan wajib lain lengkap: review khusus, bukan otomatis `ACTIVE`.
5. Permainan papan dengan komponen inti hilang: tidak dapat dipublikasikan walau nilai ekonomi atau foto tampak baik.
6. Hobi tanpa salah satu dari tiga subkategori: Item draft boleh disimpan, Assessment dan Listing belum dapat diterbitkan.
7. Perubahan jawaban keselamatan, foto yang menunjukkan kondisi berbeda, atau versi rubrik: Assessment lama historis; Listing terdampak `PAUSED` dan harus ditinjau ulang.
8. Batas rasio dan pembulatan mengikuti [O05](10-mvp-implementation-decisions.md#o05--sumber-nilai-ekonomi-dan-batas-formula); `PARTIAL_ECONOMIC` tidak pernah menampilkan Score total.

## Gerbang penerbitan versi rubrik

1. Render lima pilihan untuk keenam indikator menggunakan objek sembilan kategori/subkategori pada tabel; tampilkan teks pilihannya dan simpan teks serta nilai dalam versi rubrik.
2. Terbitkan pertanyaan keselamatan dan keputusan dari tabel di atas bersama [kebijakan moderasi](09-moderation-policy-draft.md). Foto membantu review, tidak menggantikan deklarasi.
3. Acuan pembanding admin hanya dipublikasikan jika mempunyai sumber, tanggal, dan wilayah. Jika tidak ada dan pengguna tidak punya angka, gunakan `PARTIAL_ECONOMIC`.
4. Jalankan contoh kasus batas di atas serta `0`, `0,10`, `0,30`, `0,60`, data kosong, dan tanpa repair.
5. Alasan rekomendasi dan AI Explainer memakai snapshot aturan yang sama; perubahan rubrik tidak menulis ulang Assessment historis.
