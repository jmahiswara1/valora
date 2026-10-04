# Domain, Score, Passport, Impact, dan privasi

## Identitas data dan batas konsistensi

`Item` memiliki ID permanen dan tepat satu `currentOwnerId`. `Assessment` adalah snapshot penilaian berversi, bukan kolom Score yang terus ditimpa pada Item. `Listing` menawarkan satu Item dan menyimpan snapshot Assessment yang dipakai ketika diajukan. `Offer` menyimpan niat pihak lain; `Transaction` menyimpan kesepakatan final dan konfirmasi. `OwnershipTransfer`, `PassportEvent`, dan `ImpactEvent` dihasilkan saat penyelesaian dan tidak boleh muncul dua kali untuk peristiwa yang sama.

| Entitas | Relasi/kendala penting |
| --- | --- |
| Item | Satu owner saat ini; beberapa Assessment, RepairRecord, dan Listing historis. |
| Assessment | Terkait satu Item, menyimpan `status`, snapshot jawaban, komponen yang tersedia, Score nullable, sumber data, `ruleVersion`, dan versi rekomendasi. Snapshot yang sudah diterbitkan immutable. |
| Listing | Satu Item, satu tipe (`RESELL`, `EXCHANGE`, `DONATE`); paling banyak satu `ACTIVE` atau `RESERVED` per Item. |
| Offer | Satu Listing dan penawar; pada Exchange merujuk satu Item milik penawar; revisi Counteroffer Resell harus terlacak. |
| Transaction | Satu Offer yang diterima; harga final Resell disalin dari revisi yang disetujui; konfirmasi per peran/Item dapat diaudit. |
| OwnershipTransfer | Satu transfer per Item per Transaction `COMPLETED`; Exchange menghasilkan dua transfer dalam operasi yang sama. |
| PassportEvent / ImpactEvent | Append-only dengan kunci sumber unik; koreksi adalah event/penyesuaian baru. |

**Syarat saat menerima Offer:** cek akun aktif, owner terkini, Assessment/listing masih berlaku, tipe Offer sesuai, Item belum reserved, dan Item Exchange tidak berada dalam Listing aktif lain. Cek ulang di dalam transaksi database yang mengunci data terkait. Pembatasan unik di database tetap diperlukan karena pemeriksaan di aplikasi saja rentan terhadap dua permintaan bersamaan.

**Syarat saat menyelesaikan Transaction:** status dan semua konfirmasi sah, owner kedua Item sesuai snapshot, Listing masih reserved oleh Transaction ini, serta idempotency key dan kunci sumber event belum dipakai. Perubahan owner, status, transfer, Passport, dan Impact commit bersama atau gagal bersama. Penyelesaian ulang mengembalikan hasil yang sama tanpa membuat event baru.

## Assessment dan Score

Empat komponen bernilai 0–100. Formula PRD:

```text
Score = round(0.30 × Condition
            + 0.25 × Repairability
            + 0.25 × Economic Value
            + 0.20 × Reuse Potential)
```

Jawaban pilihan dipetakan ke 0, 25, 50, 75, atau 100 menurut rubrik kategori. `Condition` adalah rata-rata fungsi, kondisi fisik, dan kelengkapan. `Repairability` adalah rata-rata metode perbaikan dan dukungan bagian; nilainya 100 jika tidak perlu perbaikan. `Reuse Potential` mengikuti tingkat kegunaan setelah tindakan yang layak. Label Score: 0–39 `Low`, 40–69 `Moderate`, 70–100 `High Circular Potential`. Score adalah indeks menurut input dan rubrik Valora, bukan verifikasi fisik atau appraisal.

**Aturan determinisme `score-v1`:** nilai indikator disimpan sebagai bilangan bulat; rata-rata komponen dan total dibulatkan ke bilangan bulat terdekat dengan aturan `.5` ke atas untuk nilai non-negatif. Total memakai komponen yang sudah dibulatkan. Seluruh contoh batas dan snapshot `ruleVersion` harus diuji sebelum aturan diterbitkan.

`Economic Value` memakai nominal rupiah: `net = max(0, estimatedResaleValue − estimatedRepairCost)`, lalu rasio `net / comparableReplacementPrice`, dengan pembanding harus `> 0`:

| Rasio | Nilai komponen |
| --- | ---: |
| `0` | 0 |
| `> 0` sampai `0,10` | 25 |
| `> 0,10` sampai `0,30` | 50 |
| `> 0,30` sampai `0,60` | 75 |
| `> 0,60` | 100 |

Nilai estimasi penjualan, biaya perbaikan, harga pembanding, dan sumber masing-masing harus disimpan sesuai [K02](10-mvp-implementation-decisions.md#o05--sumber-nilai-ekonomi-dan-batas-formula). Harga Listing sendiri tidak boleh dipakai diam-diam sebagai pembanding pasar. Bila hanya ekonomi yang kurang, ketiga komponen lain tetap ada dan status menjadi `PARTIAL_ECONOMIC`; Score dan label bernilai `null`, bukan nol. `COMPLETE` mensyaratkan keempat komponen. `INCOMPLETE` berarti data non-ekonomi atau keselamatan masih kurang. `Items Revalued` bertambah ketika Assessment sah pertama kali menjadi `COMPLETE`, sesuai definisi PRD.

## Rekomendasi deterministik

Setiap tindakan menerima satu status dan daftar alasan terstruktur:

| Tindakan | `ELIGIBLE` bila | `NEEDS_DATA` bila |
| --- | --- | --- |
| Repair | Ada masalah, `Repairability ≥ 50`, dan tindakan aman menurut kategori. | Data masalah/perbaikan/keselamatan yang diperlukan belum lengkap. |
| Resell | Assessment `COMPLETE`, `Condition ≥ 50`, `Economic Value ≥ 50`, dan aman ditransfer. | Komponen ekonomi atau data wajib lain yang diperlukan belum lengkap. |
| Exchange | `Reuse Potential ≥ 50`, Item aman ditransfer, dan preferensi pertukaran diisi saat Listing. | Data reuse/keselamatan belum lengkap. |
| Donate | `Reuse Potential ≥ 50` dan Item aman serta berguna bagi penerima. | Data reuse/keselamatan belum lengkap. |

Jika data lengkap tetapi ambang atau aturan keamanan gagal, statusnya `INELIGIBLE` dengan alasan. Aturan keamanan/larangan selalu mengalahkan ambang numerik. Nilai ekonomi tinggi tidak melarang Donate. `recommendation-v1` menampilkan semua opsi `ELIGIBLE` lebih dulu dengan urutan tetap Repair, Resell, Exchange, Donate; opsi `NEEDS_DATA` kemudian `INELIGIBLE` muncul sesudahnya. Urutan adalah prioritas navigasi produk, bukan klaim bahwa satu tindakan objektif paling baik.

## Rubrik kategori MVP

PRD menyebut tujuh kategori awal, dengan Hobi dipecah menjadi tiga subkategori MVP. [Rubrik implementasi](06-category-rubric-draft.md) memuat objek pertanyaan untuk enam indikator, pilihan 0/25/50/75/100, deklarasi keselamatan, kasus batas, dan gerbang versi immutable. Tabel berikut adalah ringkasan:

| Kategori | Fokus pertanyaan | Risiko awal yang ditangani kebijakan moderasi |
| --- | --- | --- |
| Elektronik | Fungsi utama, baterai/daya, kelengkapan, akses servis/suku cadang. | Baterai rusak atau komponen listrik terbuka. |
| Furnitur | Stabilitas, struktur/sambungan, kelengkapan, cara perbaikan. | Struktur tidak stabil atau kontaminasi. |
| Pakaian | Kelayakan pakai, kondisi bahan, kelengkapan, cara perbaikan. | Kebersihan/kontaminasi yang tidak layak ditransfer. |
| Buku | Keterbacaan, halaman, jilid, kondisi penyimpanan. | Jamur atau kerusakan yang mengganggu keselamatan. |
| Peralatan rumah tangga | Fungsi, bagian pendukung, riwayat masalah, cara perbaikan. | Risiko listrik, panas, atau gas sesuai subkategori. |
| Peralatan olahraga | Fungsi, struktur, komponen, umur pakai yang relevan. | Perlengkapan keselamatan yang tidak layak dipakai ulang. |
| Barang hobi | Subkategori, fungsi, kelengkapan, dukungan perbaikan. | Risiko berbeda per subkategori; taksonomi perlu dipersempit. |

Daftar risiko di atas menjelaskan jenis deklarasi yang diuji, bukan bukti bahwa Item tertentu aman. Hasil moderasi awal yang disepakati ada pada [matriks kebijakan](09-moderation-policy-draft.md); aturan terbit setelah contoh uji versi terkait lulus.

Pertanyaan, pilihan jawaban, dan contoh perhitungan ada pada [rubrik kategori MVP](06-category-rubric-draft.md).

## Passport, Impact, dan koreksi

Passport menyimpan event dengan waktu kejadian dan waktu pencatatan, asal `USER_REPORTED`/`SYSTEM_CONFIRMED`/`ADMIN_CORRECTED`, referensi entitas, serta visibilitas. Event lama tidak dihapus. Tahun pembelian yang dilaporkan tidak boleh menjadi tanggal pendaftaran sistem. Event koreksi menunjuk event yang dikoreksi dan alasan, tanpa menulis ulang sejarah.

| Metrik Impact | Sumber dan batas |
| --- | --- |
| Items Revalued | Satu kali per Item ketika pertama mendapat Assessment `COMPLETE`; diatribusikan kepada User yang membuat Assessment lengkap pertama. |
| Repairs Recorded | RepairRecord tersimpan, berlabel laporan pengguna; koreksi/penghapusan logis perlu menghasilkan penyesuaian yang dapat ditelusuri. |
| Completed Transfers | Transaction `COMPLETED`; total platform menghitung satu Transaction sekali, sedangkan ringkasan pengguna menampilkan transaksi yang melibatkannya. |
| Estimated Transfer Weight | Berat yang diketahui pada setiap Item yang berpindah; Exchange menjumlahkan dua Item. Pada ringkasan User, berat diatribusikan kepada pihak yang menyerahkan Item. Berat tak diketahui tidak diimputasi. |
| Confirmed Sale Value | Harga final Resell pada Transaction selesai, diatribusikan kepada penjual; bukan bukti pembayaran diterima. |

**Model koreksi K06:** ImpactEvent dan penyesuaiannya memakai kunci sumber unik (`metric`, `sourceType`, `sourceId`, `itemId` bila relevan). Ringkasan dibangun dari ledger event/penyesuaian, bukan angka yang ditambah secara terpisah di banyak tempat. Metrik tidak menyebut CO₂ saved atau limbah yang pasti dicegah. [Aturan koreksi lengkap](10-mvp-implementation-decisions.md#o09--koreksi-impact-dan-ownership).

## Atribusi Impact dan koreksi (K06)

Prinsip `Items Revalued` sekali per Item dan berat transfer kepada pihak yang menyerahkan telah **disepakati**. Ringkasan platform dihitung dari event unik; perpindahan owner berikutnya tidak memindahkan kredit historis. Detail koreksi RepairRecord dan Transaction mengikuti K06.

| Metrik | Total platform | Ringkasan User |
| --- | --- | --- |
| `Items Revalued` | Satu kali per Item saat Assessment `COMPLETE` pertama. | Satu kali kepada User yang membuat Assessment lengkap pertama; Assessment ulang oleh owner baru tidak menambah hitungan. |
| `Repairs Recorded` | Satu kali per RepairRecord yang sah. | Kepada User yang mencatat Repair pada saat itu. Koreksi satu record tidak membuat Repair baru. |
| `Completed Transfers` | Satu kali per Transaction `COMPLETED`. | Satu kali untuk masing-masing pihak yang terlibat; jumlah ringkasan User tidak dipakai sebagai total platform. |
| `Estimated Transfer Weight` | Berat tiap Item yang berpindah per Transaction; Exchange menghitung dua Item. | Berat Item yang diserahkan oleh User tersebut. Penerima tetap melihat detail transfer di Passport/Transaction. |
| `Confirmed Sale Value` | Harga final Resell pada Transaction selesai. | Hanya kepada penjual. |

Jika RepairRecord dibatalkan karena kesalahan atau Transaction historis memerlukan koreksi, ledger menulis penyesuaian bertanda positif/negatif dengan alasan dan sumber; agregat dihitung ulang tanpa menghapus event lama. Dashboard menampilkan definisi periode dan label estimasi/asal data di dekat angka. Koreksi ownership terotorisasi harus memeriksa owner terkini dan transfer lanjutan sebelum memindahkan Item; lihat [K06](10-mvp-implementation-decisions.md#o09--koreksi-impact-dan-ownership).

## Matriks visibilitas awal

| Data | Publik | Owner saat ini | Peserta Transaction/Chat | Admin |
| --- | --- | --- | --- | --- |
| Listing aktif, foto publik, kondisi yang dipublikasikan, Score/sumber | Ya | Ya | Ya | Untuk moderasi |
| Timeline Passport publik tanpa identitas lama | Ya | Ya | Ya | Untuk moderasi |
| Identitas dan alamat rinci pemilik lama | Tidak | Tidak otomatis | Hanya data pihak yang memang dibagikan dalam transaksi terkait | Hanya kasus yang beralasan dan diaudit |
| Chat | Tidak | Hanya bila peserta | Hanya percakapan yang diikuti | Hanya terkait laporan/sengketa, dengan alasan akses |
| Ringkasan Repair historis yang relevan | Bila diterbitkan untuk publik | Ya, termasuk dari owner lama | Pembuat record melihat miliknya | Sesuai tugas dan audit |
| Biaya Repair privat dan detail profil | Tidak | Hanya milik pembuat data; biaya owner lama tidak ikut | Tidak otomatis | Sesuai kebutuhan kasus dan audit |
| Bukti foto dan catatan rinci Repair lama | Tidak kecuali sengaja diterbitkan terpisah | Hanya jika pembuat lama secara eksplisit membagikannya untuk owner berikutnya | Pembuat record melihat miliknya | Hanya kasus yang beralasan dan diaudit |

Visibilitas dasar dan batas Repair lintas owner pada matriks ini sudah **disepakati**. Pembatasan `LIMITED`/`HIDDEN` dan retensi data demo mengikuti [K04–K05](10-mvp-implementation-decisions.md). Foto publik harus dilepas dari metadata yang tidak diperlukan, termasuk informasi lokasi bila ada.

Proyeksi event dan aturan akses yang lebih rinci ada pada [kebijakan privasi Passport](07-passport-privacy-draft.md).
