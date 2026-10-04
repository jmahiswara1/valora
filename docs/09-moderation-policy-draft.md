# Kebijakan moderasi kategori dan Listing untuk MVP

**Status:** prinsip tiga perlakuan, penahanan informasi keselamatan yang belum lengkap, dan matriks kasus awal per kategori **disepakati** sebagai D18 dalam [PRD v1.14](../PRD.md). Pertanyaan, kasus batas, serta operasi ditetapkan pada [rubrik](06-category-rubric-draft.md) dan [K01–K05](10-mvp-implementation-decisions.md). Dokumen ini menjelaskan kebijakan produk untuk MVP lomba, bukan bukti bahwa Valora memeriksa fisik barang.

## Tujuan dan batas

Moderasi menjaga agar Listing memiliki informasi yang cukup, sesuai rubrik kategori, dan tidak menyembunyikan risiko yang dilaporkan. **Disepakati:** setiap Listing diperiksa admin sebelum `ACTIVE`; Score tinggi tidak mengesampingkan pemeriksaan keselamatan atau larangan kategori. Admin mencatat alasan keputusan. Valora tidak mengklaim telah memeriksa barang secara langsung, memverifikasi pembayaran, atau menjamin transaksi.

Rubrik aktif harus menyebut subkategori yang dapat dipublikasikan. Pada MVP, Barang Hobi hanya mencakup alat musik, permainan papan, dan peralatan seni/kerajinan. Subkategori Hobi lain tetap dapat disimpan sebagai draft Item. Matriks perlakuan kasus awal di bawah sudah disetujui; pertanyaan wajib, pilihan jawaban kategori, dan contoh kasus batas ada pada [rubrik MVP](06-category-rubric-draft.md).

## Gerbang informasi dan tiga perlakuan — disepakati

Pemeriksaan awal memberi alasan yang dapat dibaca owner. **Pertama**, data wajib, Assessment terkini, rubrik aktif, dan kelayakan tipe Listing diperiksa. Data keselamatan wajib yang belum lengkap menahan pengajuan. **Setelah itu**, kondisi yang diketahui diperlakukan sebagai terlarang, perlu review khusus admin, atau boleh dengan pengungkapan jelas. Semua Listing yang dapat diajukan tetap melewati review admin sebelum `ACTIVE`. Istilah pada tabel adalah hasil kebijakan, bukan enum API yang sudah disahkan.

| Hasil | Pemicu | Aksi |
| --- | --- | --- |
| Belum dapat diajukan | Kategori/subkategori belum punya rubrik aktif; Assessment tidak terkini; deklarasi kondisi/keselamatan wajib kosong; data ekonomi kurang untuk Resell; atau tipe Listing tidak `ELIGIBLE`. | Tahan pengajuan dan tunjukkan data/aturan yang perlu dipenuhi. Item dan Repair tetap dapat dikelola. Ini gerbang sebelum tiga perlakuan moderasi. |
| Terlarang menurut kebijakan kategori | Kondisi termasuk larangan kategori yang sudah diterbitkan. | Jangan terbitkan Listing. Tampilkan alasan spesifik dan jalur koreksi bila data yang dilaporkan salah. |
| Perlu tinjauan khusus admin | Jawaban atau foto menandakan risiko yang perlu dinilai, informasi saling bertentangan, atau laporan pengguna menimbulkan keraguan. | Kirim ke admin dengan penanda risiko dan pertanyaan tambahan. Tidak tampil di Market selama review. |
| Boleh dengan pengungkapan kondisi | Kondisi diizinkan menurut kebijakan kategori bila dijelaskan kepada calon penerima. | Tampilkan pengungkapan yang relevan pada snapshot Listing; ajukan ke review admin biasa sebelum `ACTIVE`. |

Jawaban “tidak tahu” pada pertanyaan keselamatan wajib tidak diperlakukan sebagai “aman” dan tidak menghasilkan Listing publik. Sistem meminta data tambahan; kasus yang sudah memiliki data minimum tetapi masih meragukan masuk review khusus. Foto membantu admin membaca laporan, tetapi tidak menggantikan deklarasi kondisi atau inspeksi fisik. Tiga perlakuan ini berlaku sama untuk Resell, Exchange, dan Donate; RepairRecord tetap dapat dicatat pada Item privat.

## Matriks kasus per kategori — disepakati untuk MVP

Contoh berikut disetujui sebagai **aturan awal MVP** untuk kondisi yang disebutkan. Ini bukan daftar menyeluruh; kasus baru dan kasus batas memerlukan kebijakan kategori berversi serta keputusan admin yang beralasan. Semua contoh berangkat dari kondisi yang dilaporkan pengguna atau terlihat pada data Listing; Valora tidak mengesahkan kondisi fisik barang.

| Kategori/subkategori | Tidak dipublikasikan pada kondisi ini | Review khusus | Boleh dengan pengungkapan |
| --- | --- | --- | --- |
| Elektronik | Baterai dilaporkan menggembung atau kabel daya terbuka. | Daya tidak stabil, panas yang tidak dijelaskan, atau foto berlawanan dengan laporan fungsi. | Goresan casing atau aksesori opsional hilang, jika fungsi utama dan kelengkapan wajib jelas. |
| Furnitur | Rangka penyangga utama dilaporkan patah atau tidak stabil. | Bekas perbaikan struktur dengan kekuatan yang belum jelas. | Lecet permukaan atau warna pudar tanpa gangguan fungsi. |
| Pakaian | Kontaminasi yang dilaporkan belum ditangani dan memengaruhi kelayakan pakai. | Kebersihan, noda, atau kerusakan bahan yang belum dapat dijelaskan dari input. | Warna pudar atau jahitan kecil yang tidak menghalangi pemakaian. |
| Buku | Pertumbuhan jamur yang dilaporkan masih ada pada buku. | Halaman penting rusak/hilang atau kondisi lembap yang belum jelas. | Sampul aus atau anotasi, selama keterbacaan dan kelengkapan inti dijelaskan. |
| Peralatan rumah tangga | Kebocoran gas atau komponen listrik terbuka yang dilaporkan. | Fungsi panas/daya tidak stabil atau subjenis sumber daya belum jelas. | Penyok kosmetik tanpa gangguan fungsi yang dilaporkan. |
| Peralatan olahraga | Struktur perlengkapan pelindung atau penahan beban dilaporkan rusak. | Riwayat benturan/umur pakai perlengkapan keselamatan tidak jelas. | Lecet pada barang non-pelindung yang fungsi utamanya tetap jelas. |
| Alat musik | Komponen listrik terbuka pada instrumen bertenaga listrik yang dilaporkan. | Retak struktur, fungsi tidak konsisten, atau perbaikan terdahulu belum dijelaskan. | Lecet finishing atau kebutuhan penyeteman, dengan fungsi dan kebutuhan tindakan diungkapkan. |
| Permainan papan | Komponen inti yang diperlukan untuk bermain dilaporkan hilang sehingga fungsi permainan tidak terpenuhi. | Jumlah komponen pada foto, daftar, dan deskripsi saling berbeda. | Kotak aus atau kartu sedikit tertekuk bila isi permainan tetap lengkap. |
| Peralatan seni/kerajinan | Bahan tidak teridentifikasi atau alat dilaporkan rusak sehingga bagian kerja berisiko. | Kemasan bahan terbuka, kondisi/isi belum jelas, atau foto tidak sesuai label. | Keausan kosmetik pada alat yang fungsi dan jenis bahannya dijelaskan. |

Kolom pertama berarti **tidak mempublikasikan Item dalam kondisi yang dilaporkan**, bukan larangan menyimpan Item privat atau mencatat Repair. Setelah perbaikan dan Assessment baru, owner dapat mengajukan Listing sesuai versi kebijakan yang berlaku. Kondisi yang tidak dapat dinilai cukup dari input pengguna tidak diberi label aman oleh Valora. Pertanyaan wajib dan kasus batas mengikuti [rubrik](06-category-rubric-draft.md#pertanyaan-keselamatan-wajib-dan-hasil-awal).

Rujukan keselamatan untuk meninjau kandidat tertentu: [CDC tentang helm yang rusak atau pernah mengalami benturan](https://www.cdc.gov/heads-up/media/pdfs/helmets/headsup_helmetfactsheet_bike_508.pdf), [EPA tentang bahan berpori yang berjamur](https://www.epa.gov/mold/what-are-basic-mold-cleanup-steps), dan [CPSC tentang risiko komponen penghantar listrik yang terbuka pada produk tertentu](https://www.cpsc.gov/Newsroom/News-Releases/2026/CPSC-Warns-Consumers-to-Stop-Using-Male-to-Male-Extension-Cords-Secures-Delisting-Commitments-from-e-Commerce-Platforms). Rujukan ini mendukung review risiko, bukan menetapkan daftar larangan Indonesia untuk seluruh kategori.

Sebelum Valora dioperasikan untuk perdagangan nyata di Indonesia, daftar barang juga perlu diperiksa terhadap aturan perdagangan yang berlaku pada saat itu. [JDIH Kementerian Perdagangan](https://jdih.kemendag.go.id/peraturan/peraturan-menteri-perdagangan-republik-indonesia-nomor-19-tahun-2026-tentang-penyelenggaraan-usaha-perdagangan-melalui-sistem-elektronik-1) mencatat Permendag 19/2026 sebagai berlaku dan mencabut Permendag 31/2023. Dokumen ini belum menyimpulkan kewajiban hukum Valora atau status hukum masing-masing contoh barang.

## Checklist review Listing

1. Periksa Item milik pengaju, status akun, kategori/subkategori aktif, Assessment terkini, dan kelayakan tipe Listing. Untuk Resell diperlukan `COMPLETE`; Donate/Exchange boleh `PARTIAL_ECONOMIC` bila data lain dan keselamatan lengkap.
2. Bandingkan judul, deskripsi, foto, kondisi, kelengkapan, dan jawaban Assessment. Minta perbaikan jika klaim saling bertentangan atau foto tidak memperlihatkan barang yang ditawarkan dengan cukup jelas.
3. Periksa penanda risiko dan aturan kategori versi yang berlaku. Keputusan memakai alasan yang dapat dijelaskan; Score tidak menjadi alasan tunggal untuk menerbitkan.
4. Periksa informasi khusus tipe: nominal rupiah untuk Resell; preferensi Item untuk Exchange; dan ketiadaan harga jual pada Donate. Lokasi publik maksimal kota; alamat rinci dan kontak tidak ditampilkan pada Listing.
5. Pastikan klaim “terverifikasi”, “aman”, “seperti baru”, statistik promosi, atau klaim dampak hanya tampil bila ada dasar yang diizinkan kebijakan produk. Persetujuan admin berarti Listing lolos pemeriksaan data platform, bukan kondisi fisik terverifikasi.
6. Simpan keputusan `APPROVE`, `REQUEST_CHANGES`, atau `REJECT` beserta alasan, aturan yang dipakai, admin, waktu, dan snapshot Listing yang ditinjau. Nama aksi final/enum mengikuti kontrak API nanti; status Listing publik tetap mengikuti PRD.

Admin melihat data yang diperlukan untuk review Listing. Akses isi chat hanya untuk Report atau sengketa terkait, dengan alasan dan audit. Bukti privat tidak diterbitkan hanya karena admin melihatnya.

## Setelah Listing terbit

| Situasi | Respons |
| --- | --- |
| Perubahan material oleh owner pada Listing `ACTIVE` | **Disepakati:** pindah ke `PAUSED`, akhiri Offer revisi lama dengan `LISTING_REVISED`, lalu wajib Assessment dan review ulang sebelum `ACTIVE`. |
| Laporan atas Listing `ACTIVE` | Admin dapat memindahkan ke `SUSPENDED` dengan alasan/audit bila perlu mencegah penawaran baru; periksa laporan dan beri hasil kepada pihak yang berhak. Kembali ke `PENDING_REVIEW` atau `WITHDRAWN` sesuai K01. |
| Laporan saat Transaction berjalan dan Listing `RESERVED` | Jangan memindahkan owner atau membatalkan Transaction otomatis. Buka Report/sengketa, pertahankan bukti dan konfirmasi yang sudah ada, batasi aksi baru sesuai hasil review. Putusan mengikuti prosedur sengketa PRD. |
| Laporan atas riwayat Passport | Koreksi fakta melalui event `CORRECTION`; admin dapat memilih `LIMITED` atau `HIDDEN` dengan alasan/audit sesuai K04. |
| Akun ditangguhkan | Cegah pengajuan/penawaran baru sesuai keputusan admin; transaksi yang sudah berjalan masuk penanganan kasus agar status dan ownership tidak berubah diam-diam. Verifikasi akun dan retensi mengikuti K05. |

Pelapor dapat menerima status penanganan tanpa mendapat data privat pihak lain. Owner mendapat alasan yang cukup untuk memperbaiki atau mengajukan banding; catatan internal yang mengungkap identitas pelapor atau bukti privat tetap dibatasi.

## Data kebijakan dan audit

- Setiap aturan kategori memuat `policyVersion`, kategori/subkategori, pertanyaan wajib, daftar kondisi yang perlu review/dilarang, tanggal berlaku, penyusun/penyetujunya, dan contoh uji. Versi yang sudah dipakai Listing tidak diedit di tempat.
- Review menyimpan snapshot Listing/Assessment, penanda risiko, keputusan, alasan, admin, waktu, dan versi kebijakan. Perubahan keputusan menambah `AdminAction` baru; riwayat tidak ditimpa.
- Penolakan atau penangguhan memberi alasan yang dapat dipahami owner. Keputusan publik tidak membuka data pelapor, bukti privat, atau catatan admin internal.
- Daftar larangan harus diuji terhadap kasus batas, termasuk Score tinggi pada Item yang tetap tidak layak ditawarkan, jawaban keselamatan kosong, foto yang bertentangan dengan deskripsi, dan perubahan kondisi setelah persetujuan.

## Pemeriksaan minimum sebelum implementasi moderasi

1. Form mengirim `SAFETY_DATA_MISSING` saat deklarasi wajib bernilai `TIDAK_TAHU`, termasuk ketika foto terlihat baik.
2. Kondisi terlarang tidak bisa menjadi Listing publik walau Score tinggi; Repair dan Item privat tetap tersedia.
3. Kasus review khusus masuk antrean berbeda dengan alasan dan snapshot; admin tetap harus menulis keputusan.
4. Keputusan `APPROVE`, `REQUEST_CHANGES`, atau `REJECT` merujuk `ListingRevision`, `Assessment`, `rubricVersion`, dan `policyVersion` yang sama.
5. Penangguhan dan pencabutan pembatasan Passport menambah `AdminAction`, tidak mengubah event historis.
6. Akses chat admin hanya melalui Report/sengketa terotorisasi; keputusan tidak mengungkap data pelapor atau bukti privat pada halaman publik.
