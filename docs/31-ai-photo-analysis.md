# Analisis foto barang dengan AI

Perluasan setelah MVP · PRD 1.26 · OpenAPI 1.16.0.

## Alur pengguna

Pada `/app/barang/baru` dan `/app/barang/[id]/edit`, bagian **Foto barang** tampil sebelum informasi dasar. Pengguna dapat menyimpan hingga delapan foto dan memilih satu sampai tiga untuk dianalisis. Foto pertama dipilih sebagai pilihan awal. Tombol **Analisis foto dengan AI** memulai proses secara manual; membuka halaman, fokus kembali, atau jaringan pulih tidak memicu generasi.

Foto terpilih dikirim ke layanan AI. Formulir mengingatkan agar tidak menyertakan wajah, alamat atau dokumen pribadi. Backend hanya mengirim foto yang sudah dihapus metadatanya serta katalog kategori aktif. Identitas akun, nama berkas, nilai formulir, harga dan riwayat barang tidak dikirim.

Hasil berisi ringkasan serta pilihan per kolom:

| Kolom | Batas saran |
| --- | --- |
| Nama barang | Nama berdasarkan objek yang terlihat, tanpa merek/model yang tidak terbaca |
| Kategori + subkategori | Satu pilihan atomik, hanya kode dari katalog aktif |
| Cerita singkat | Deskripsi tampilan; tidak mengarang asal atau riwayat penggunaan |
| Kondisi saat ini | Ciri visual dengan batasan “Pada foto, terlihat …” |
| Kendala atau kerusakan | Masalah yang terlihat; tidak mengklaim ketiadaan kerusakan tersembunyi |

Kolom kosong dipilih otomatis. Kolom terisi tidak dipilih, dan perubahan manual membatalkan pilihan saran pada kolom tersebut, termasuk selama AI masih bekerja. **Terapkan pilihan** hanya mengisi formulir. Pengguna tetap perlu meninjau dan menekan **Simpan barang** atau **Simpan perubahan**. Fungsi, kelengkapan paket, harga awal, tahun pembelian dan berat diisi sendiri.

Pengamatan dan permintaan foto tambahan berada dalam disclosure native yang dapat dibuka/ditutup tanpa permintaan AI atau penggunaan kuota. Status `NEEDS_PHOTOS` meminta foto tambahan ketika barang tidak cukup jelas, berupa ilustrasi, atau berisi beberapa objek utama berbeda. Saran yang belum dapat didukung foto bernilai `null`.

## Kontrak API

`POST /api/v1/items/photo-analysis` memerlukan sesi aktif dan CSRF. Input:

```json
{
  "itemId": "UUID opsional untuk barang tersimpan",
  "expectedVersion": 1,
  "mediaIds": [],
  "uploadTicketIds": []
}
```

`itemId` dan `expectedVersion` wajib hadir bersama. `mediaIds` hanya dapat dipakai dengan barang tersimpan. Gabungan referensi harus unik dan berjumlah 1–3. Barang harus milik aktor saat ini, tidak diarsipkan, tidak direservasi, dan memiliki versi yang sama. Hanya foto barang biasa yang diizinkan; bukti Repair/kasus dan lampiran pesan tidak diterima. Tiket harus milik aktor, bertujuan `ITEM`, sudah diunggah, belum dikonsumsi, belum kedaluwarsa, dan terikat pada barang edit yang sama atau `null` untuk barang baru.

Output menggunakan schema ketat `PhotoAnalysis`:

- `status`: `READY | NEEDS_PHOTOS | UNAVAILABLE`.
- `summary`, `suggestions`, `observations`, `requestedPhotos`.
- `cached`, `generatedAt`, `expiresAt`, `reason`, `retryAt`.
- Lima kelompok saran memakai `title`, `categoryCode`, `subcategoryCode`, `description`, `conditionSummary`, `issueSummary`, semuanya nullable.

Hasil tidak mengubah Item, Assessment, Score, Listing atau ownership. Respons yang ditolak ACL/state merupakan error HTTP; kegagalan provider atau batas layanan menggunakan `UNAVAILABLE` dengan saran kosong. Tidak ada template yang mengarang pengamatan foto.

## Foto dan penyimpanan

Foto lokal diunggah saat analisis menggunakan alur tiket yang ada: JPEG/PNG/WebP maksimal 8 MiB, validasi isi dan maksimal 20 juta piksel, penghapusan metadata, WebP. Analisis tidak mengonsumsi tiket. Formulir mempertahankan tiket di memori dan menggunakannya lagi saat menyimpan; tiket yang kedaluwarsa setelah 15 menit diunggah ulang. Tidak ada foto atau tiket yang disimpan ke browser storage.

Backend membaca storage lokal melalui referensi sah dan menyiapkan WebP maksimal 1280px, tanpa metadata. Total data gambar untuk provider dibatasi 3 MiB. Gambar dikirim inline sebagai `image_url` data URL, tanpa signed URL privat atau fetch URL yang diberikan pengguna. Semua foto terpilih diperiksa kembali setelah persiapan, sebelum cache hit dan sebelum hasil provider dikembalikan. Snapshot mencakup katalog, versi barang, izin media dan tiket.

Penyimpanan edit tetap melewati `expectedVersion` dan aturan perubahan material yang sudah ada. Perubahan deskripsi/kategori/kondisi/kendala dapat membuat penilaian lama historis dan menjeda Listing. AI tidak melewati aturan tersebut. Foto tambahan difinalisasi setelah detail tersimpan; kegagalan parsial diberi pesan dan versi hasil simpan dipertahankan untuk mencoba lagi.

Formulir menyembunyikan saran lama ketika foto yang dipilih berubah, item/versinya berubah, simpan dimulai, navigasi atau sesi berubah. Respons yang datang setelah pembatalan tidak diterapkan. Penolakan akses/state menghapus hasil lama; kegagalan sementara untuk foto sama mempertahankan hasil sebelumnya. Saran kedaluwarsa tidak dapat diterapkan.

## Konfigurasi

Hanya backend membaca kredensial:

```dotenv
AI_PHOTO_ANALYSIS_ENABLED=false
AI_PHOTO_MODEL=
AI_BASE_URL=http://localhost:20128/v1
AI_MODEL=ag/gemini-3.8-flash-high
AI_API_KEY=
AI_TIMEOUT_MS=60000
AI_USER_DAILY_LIMIT=20
AI_APP_DAILY_LIMIT=200
```

Model foto yang kosong menggunakan `AI_MODEL`. Flag foto terpisah dari `AI_EXPLAINER_ENABLED`. Dukungan multimodal model/gateway harus diperiksa sebelum flag diaktifkan. `.env.example` tetap nonaktif; konfigurasi lokal telah diaktifkan setelah gambar sintetis diterima melalui provider dan menghasilkan pengamatan visual yang sesuai. Jangan commit `.env.local` atau kunci API.

Provider memakai endpoint Chat Completions dengan konten gambar dan teks katalog. Respons dibatasi 128 KiB, bukan stream, tanpa tool call/refusal, dengan `finish_reason: stop`. Output harus tepat JSON sesuai schema. Panjang teks, kode kategori/subkategori serta sejumlah klaim yang tidak dibenarkan diperiksa. Teks ditampilkan sebagai teks React biasa, tanpa HTML/Markdown aktif. Instruksi pada foto diperlakukan sebagai data tidak tepercaya.

## Kuota, cache dan concurrency

Analisis foto dan AI Explainer berbagi kuota default **20 generasi per pengguna per hari**, **200 global per hari**, reset 00.00 WIB, dan maksimal **dua generasi bersamaan lintas proses**. Namespace bucket harian Explainer dipertahankan, sehingga penggunaan sebelumnya tidak direset. Kedua fitur mereservasi kuota dalam gate transaksi database yang sama. Cache hit, join dan penolakan kuota/sibuk tidak menghabiskan kuota; generasi outbound yang sudah direservasi tetap dihitung saat provider gagal.

Cache privat 24 jam menggunakan hash aktor, konteks barang/versi, bytes foto terpilih, katalog kategori, gateway, model dan versi prompt. Mengunggah ulang bytes yang sama tidak memerlukan generasi baru jika konteks tetap sama. Identitas aktor mencegah penggunaan cache lintas akun. Kegagalan provider dicache 30 detik. Lease token 90 detik memadukan permintaan identik dan mencegah worker lama menghapus lease pengganti. Cleanup berkala membuang cache/lease kedaluwarsa.

Batas endpoint: sepuluh permintaan/menit/aktor, termasuk cache hit. Provider memiliki timeout maksimal 60 detik, join menunggu maksimal 70 detik, browser memakai 75 detik untuk endpoint ini. Tidak ada retry otomatis. Retry hanya melalui tindakan pengguna dan cooldown yang ditampilkan; pengisian manual tetap tersedia.

## Migrasi dan bukti implementasi

Migrasi additive `20261011010000_photo_analysis` menambahkan `PhotoAnalysisCache` dan `PhotoAnalysisLease`. Migrasi diterapkan ke database development tanpa reset/seed. Kontrak OpenAPI lengkap menggunakan versi 1.16.0.

Pemeriksaan implementasi: build kontrak/API dan build produksi web, typecheck web, lint API/web; koneksi 9router dengan gambar sintetis tanpa data pribadi; endpoint foto dan cache hit lewat akun demo; peninjauan browser desktop 1440px, mobile 390px dan 320px. Pilihan per kolom, isian manual, penerapan tanpa simpan dan penggunaan ulang tiket ditinjau dengan respons browser mock. Formulir dengan API nyata juga menghasilkan `READY` dari aset kursi editorial yang sudah ada, tanpa menyimpan Item baru. Prompt dan validasi menolak klaim fungsi/stabilitas yang tidak dapat dibuktikan dari foto. Review UI terpisah menghasilkan disposition `ship` pada bukti visual dan source frontend; tidak mengklaim verifikasi keamanan backend. Bukti visual berada di `.impeccable/review/photo-analysis/` (development only).

Suite tes otomatis tambahan tidak dibuat atau dijalankan pada sesi implementasi ini. Skenario regresi berikut masih dapat dijalankan saat pengujian diminta: ACL aktor lain/sesi dicabut, perpindahan ownership atau reservation saat provider pending, versi berubah, expiry tiket/cache/lease, persaingan kuota lintas proses dan lintas fitur, payload tidak valid/berlebihan, output provider tidak sesuai, kegagalan parsial save, serta penggunaan manual ketika AI tidak tersedia.
